"""End-to-end checks for Clocktower Companion.

Run:  python3 tests/test_app.py   (needs Python Playwright + Chromium)
Serves the repo on a random local port, drives the app in a phone-sized
browser, checks the solver's conclusions, and saves screenshots to tests/screens/.
"""
import functools, http.server, json, os, pathlib, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / 'tests' / 'screens'
SHOTS.mkdir(exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Handler = functools.partial(Quiet, directory=str(ROOT))
httpd = socketserver.TCPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{httpd.server_address[1]}/index.html'

failures = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: failures.append(msg)

NAMES = ['Ann', 'Ben', 'Cat', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal']

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.goto(URL)
    page.evaluate('localStorage.clear()'); page.reload()

    # ── Setup through the UI ──
    page.once('dialog', lambda d: d.accept('\n'.join(NAMES)))
    page.click('[data-act="paste-players"]')
    check(page.locator('.plist li').count() == 8, '8 players added from pasted list')
    check('5' in page.locator('.dist div').first.inner_text(), '8 players → 5 Townsfolk shown')
    ids = page.evaluate('window.__companion.state.players.map(p => p.id)')
    pid = dict(zip(NAMES, ids))
    page.select_option('#me-sel', pid['Ann'])
    page.select_option('#mychar-sel', 'empath')
    check(page.evaluate('window.__companion.state.myAlign') == 'good', 'choosing Empath sets alignment good')
    page.screenshot(path=str(SHOTS / '1-setup.png'), full_page=True)

    # ── Claims via the player sheet ──
    page.click('[data-tab="town"]')
    def claim(name, char):
        page.click(f'.token[data-pid="{pid[name]}"]')
        page.select_option('#claim-sel', char)
        page.click('[data-act="close-sheet"]')
    claim('Ben', 'chef'); claim('Cat', 'washerwoman'); claim('Dan', 'saint'); claim('Eve', 'soldier')
    claim('Fay', 'soldier'); claim('Gus', 'investigator'); claim('Hal', 'undertaker')
    page.screenshot(path=str(SHOTS / '2-town.png'), full_page=True)

    # ── Log info through the form: my Empath 0 → neighbours Hal & Ben clear ──
    page.click('[data-tab="info"]')
    page.click('[data-act="new-ev"]')
    sel = page.evaluate('window.__companion.state')
    # Template auto-picks Empath with my two alive neighbours (Hal and Ben).
    check(page.locator('#ev-tpl').input_value() == 'empath', 'info form picks the Empath template from my character')
    on = page.locator('.sheet .chip-btn.on').all_inner_texts()
    check(sorted(on) == ['Ben', 'Hal'], f'Empath neighbours auto-filled (got {on})')
    page.click('[data-act="draft-n"][data-v="0"]')
    page.click('[data-act="save-draft"]')
    check(page.locator('.entry').count() == 1, 'Empath info saved')

    # Gus (Investigator) says one of Eve/Fay is the Poisoner.
    page.click('[data-act="new-ev"]')
    page.select_option('#ev-src', pid['Gus'])
    check(page.locator('#ev-tpl').input_value() == 'ping', 'template follows the source player\'s claim')
    page.click(f'.sheet [data-act="draft-player"][data-pid="{pid["Eve"]}"]')
    page.click(f'.sheet [data-act="draft-player"][data-pid="{pid["Fay"]}"]')
    page.select_option('#ev-char', 'poisoner')
    page.click('[data-act="save-draft"]')
    page.screenshot(path=str(SHOTS / '3-info.png'), full_page=True)

    # ── Night death + nomination ──
    page.click('[data-act="next-phase"] >> nth=0')  # → Day 1
    page.click('[data-tab="days"]')
    page.click('[data-act="new-nom"]')
    page.select_option('#nom-a', pid['Cat']); page.select_option('#nom-b', pid['Eve'])
    for n in ['Ann', 'Cat', 'Gus', 'Hal', 'Ben']:
        page.click(f'.sheet [data-act="nom-voter"][data-pid="{pid[n]}"]')
    page.click('[data-act="nom-exec"]'); page.click('[data-act="save-nom"]')
    st = page.evaluate('window.__companion.state')
    eve = next(p for p in st['players'] if p['name'] == 'Eve')
    check(eve['dead'] and eve['death']['how'] == 'execution', 'executed nominee is marked dead by execution')
    check(page.locator('table.simple tr').count() == 2, 'nomination listed')
    page.screenshot(path=str(SHOTS / '4-votes.png'), full_page=True)

    # ── Analysis ──
    page.click('[data-tab="read"]')
    page.screenshot(path=str(SHOTS / '5-analysis.png'), full_page=True)
    a = page.evaluate('''() => { const c = window.__companion; const sc = SCRIPTS['trouble-brewing'];
        const r = c.Engine.analyze(c.state, sc); const out = {};
        c.state.players.forEach(p => { if (r.players[p.id]) out[p.name] = r.players[p.id]; }); return {players: out, prior: r.prior, teams: r.topTeams.length}; }''')
    P = a['players']
    for n, v in P.items(): print(f'   {n}: evil {v["evil"]:.2f} demon {v["demon"]:.2f}')
    check(P['Ann']['evil'] == 0, 'I (good) am never evil')
    check(P['Ben']['evil'] < a['prior'] and P['Hal']['evil'] < a['prior'], 'Empath 0 lowers both neighbours')
    check(P['Eve']['evil'] > a['prior'] and P['Fay']['evil'] > a['prior'], 'double Soldier claim + Investigator ping raise Eve/Fay')
    check(P['Eve']['demon'] < P['Fay']['demon'], 'executed-and-game-continued lowers Eve\'s Demon chance')
    tips = page.locator('.tip').all_inner_texts()
    check(any('both claim Soldier' in t or 'all claim Soldier' in t for t in tips), 'tip flags duplicate Soldier claims')
    check(any('Saint' in t for t in tips), 'tip warns about the Saint claim')

    # ── Engine: chef / clockmaker / FT semantics on a fixed seating ──
    r = page.evaluate('''() => {
      const mk = (n) => Array.from({length: n}, (_, i) => ({ id: 'p'+i, name: 'P'+i, claims: [], dead: false, gut: 0, lock: '' }));
      const sc = SCRIPTS['trouble-brewing'];
      const base = { players: mk(7), meId: 'p0', myAlign: 'good', myChar: 'chef', evidence: [], noms: [], phase: {kind:'day', n:1} };
      // Storyteller-grade facts: chef 1 pair, p3 is evil, p4 is good → p2 must be the other evil.
      const s1 = { ...base, evidence: [ {id:'a', source:'st', type:'chef', n:1, when:{kind:'night',n:1}},
        {id:'b', source:'st', type:'align', players:['p3'], evil:true, when:{kind:'night',n:1}},
        {id:'c', source:'st', type:'align', players:['p4'], evil:false, when:{kind:'night',n:1}} ] };
      const r1 = Engine.analyze(s1, sc);
      // FT "no" on p1,p2 → neither is the Demon.
      const s2 = { ...base, evidence: [ {id:'d', source:'p0', type:'ft', players:['p1','p2'], yes:false, when:{kind:'night',n:1}} ] };
      const r2 = Engine.analyze(s2, sc);
      // Evil me: analysis knows the team.
      const s3 = { ...base, myAlign: 'evil', myChar: 'imp', knownEvil: ['p5'] };
      const r3 = Engine.analyze(s3, sc);
      return { p2: r1.players.p2.evil, p1: r1.players.p1.evil, ftp1: r2.players.p1.demon, ftp3: r2.players.p3.demon,
               evil5: r3.players.p5.evil, evil3: r3.players.p3.evil, dem0: r3.players.p0.demon,
               err: Engine.analyze({ ...base, players: mk(4) }, sc).error };
    }''')
    check(r['p2'] > 0.9, f'chef 1 pair + p3 evil + p4 good → p2 evil ({r["p2"]:.2f})')
    check(r['p1'] < 0.1, f'... and p1 good ({r["p1"]:.2f})')
    check(r['ftp1'] < 0.05 < r['ftp3'], 'Fortune Teller "no" clears both of being the Demon')
    check(r['evil5'] == 1 and r['evil3'] == 0 and r['dem0'] == 1, 'evil player: known team is fixed')
    check(bool(r['err']), 'fewer than 5 players → friendly error')

    # ── Custom script import (official script-tool format) ──
    page.click('[data-tab="setup"]')
    script = '[{"id":"_meta","name":"Test Script"},"washerwoman","fortune_teller","no_dashii","pit-hag","scarlet_woman","lil_monsta","balloonist"]'
    (SHOTS / 'script.json').write_text(script)
    page.set_input_files('#script-file', str(SHOTS / 'script.json'))
    page.wait_for_function('window.__companion.state.scriptId === "custom"')
    cs = page.evaluate('window.__companion.state.customScript')
    check(cs['name'] == 'Test Script', 'custom script name read from _meta')
    check(cs['characters'][:5] == ['washerwoman', 'fortuneteller', 'nodashii', 'pithag', 'scarletwoman'], f'official ids normalised ({cs["characters"]})')
    check(cs['custom'].get('lilmonsta', {}).get('team') == 'demon', 'unknown-to-base characters filled from the extra list')

    # ── Guide ──
    page.click('[data-tab="guide"]')
    check(page.locator('details.char').count() >= 7, 'guide lists characters')
    page.evaluate("window.__companion.state.scriptId = 'sects-violets'"); page.click('[data-tab="guide"]')
    page.fill('[data-input="guide-filter"]', 'vortox')
    check(page.locator('details.char:not([open])').count() == 1 and 'Vortox' in page.locator('details.char:not([open])').inner_text(), 'guide search filters')
    page.fill('[data-input="guide-filter"]', '')
    page.screenshot(path=str(SHOTS / '6-guide.png'), full_page=False)

    # ── Persistence ──
    page.reload()
    check(page.evaluate('window.__companion.state.players.length') == 8, 'state survives reload')

    # ── Notebook: true role vs public story ──
    page.click('[data-tab="town"]')
    me_token = page.locator(f'.token[data-pid="{pid["Ann"]}"]')
    check('Empath' not in me_token.inner_text(), 'the town circle does not show my true role')
    me_token.click()
    check('Empath' in page.locator('.truth-card').inner_text(), 'my sheet shows my true role privately')
    page.select_option('#claim-sel', 'monk')
    check('Bluffing as' in page.locator('.truth-card').inner_text(), 'claiming another role is shown as a bluff')
    s = page.evaluate('window.__companion.state')
    check(s['myChar'] == 'empath' and s['players'][0]['claims'][-1]['char'] == 'monk', 'true role and public claim are stored separately')
    check(page.evaluate("Engine.claimOf(window.__companion.state, window.__companion.state.players[0])") == 'empath', 'analysis still uses my true role')
    page.click('[data-act="new-note"]')
    page.click(f'.sheet [data-act="note-target"][data-pid="{pid["Ben"]}"]')
    page.fill('#note-text', 'Real Empath number was 1')
    page.click('[data-act="save-note"]')
    page.click('[data-act="new-note"]')
    page.click('[data-act="note-story"][data-v="public"]')
    page.click(f'.sheet [data-act="note-target"][data-pid="{pid["Ben"]}"]')
    page.fill('#note-text', 'Told everyone I protected Ben')
    page.click('[data-act="save-note"]')
    tl = page.locator('.timeline').inner_text()
    check('Private truth' in tl and 'Told the table' in tl.replace('TOLD', 'Told'), 'my timeline labels truth and public story')
    page.screenshot(path=str(SHOTS / '8-notebook.png'), full_page=False)
    page.click('[data-act="close-sheet"]')
    page.click(f'.token[data-pid="{pid["Ben"]}"]')
    ben_tl = page.locator('.timeline').inner_text()
    check('protected Ben' in ben_tl, "public notes appear on the other player's timeline")
    check('Real Empath' not in ben_tl, "private notes never appear on another player's timeline")
    page.click('[data-act="new-note"]')
    page.click('[data-act="note-kind"][data-v="did"]')
    page.fill('#note-text', 'Says they poisoned nobody')
    page.click('[data-act="save-note"]')
    check('Says they poisoned nobody' in page.locator('.timeline').inner_text(), "another player's claimed action is on their timeline")
    page.click('[data-act="close-sheet"]')
    page.reload()
    check(len(page.evaluate('window.__companion.state.notes')) == 3, 'notes survive reload')
    old = page.evaluate('''() => { const s = JSON.parse(JSON.stringify(window.__companion.state)); s.v = 1; delete s.notes;
        const m = Engine.sanitizeGame(s, { v: 2, tab: 'setup', scriptId: 'trouble-brewing', notes: [] });
        return { v: m.v, notes: m.notes.length, players: m.players.length, ev: m.evidence.length }; }''')
    check(old['v'] == 2 and old['notes'] == 0 and old['players'] == 8 and old['ev'] == 2, f'a version 1 save upgrades without losing data ({old})')
    page.evaluate("window.__companion.state.players[0].claims = []")

    # ── Nominations can be corrected ──
    def player_state(name):
        return page.evaluate('(n) => window.__companion.state.players.find(p => p.name === n)', name)
    def nominate(target, voters=(), executed=True):
        page.click('[data-act="new-nom"]')
        page.select_option('#nom-a', pid['Cat']); page.select_option('#nom-b', pid[target])
        for v in voters: page.click(f'.sheet [data-act="nom-voter"][data-pid="{pid[v]}"]')
        if executed: page.click('[data-act="nom-exec"]')
        page.click('[data-act="save-nom"]')
    page.click('[data-tab="days"]')
    page.click('tr[data-act="edit-nom"]'); page.click('[data-act="del-nom"]')
    check(not player_state('Eve')['dead'], 'deleting an execution brings the player back')
    nominate('Fay'); nominate('Gus')
    check(not player_state('Fay')['dead'] and player_state('Gus')['dead'], 'moving an execution brings the first player back')
    page.click('tr[data-act="edit-nom"] >> nth=1'); page.click('[data-act="nom-exec"]'); page.click('[data-act="save-nom"]')
    check(not player_state('Gus')['dead'], 'unmarking an execution brings the player back')

    # ── Ghost votes ──
    page.click(f'[data-act="quick-death"][data-pid="{pid["Hal"]}"]')
    check(player_state('Hal')['death']['when']['kind'] == 'night', 'a death tapped during the day is recorded as last night')
    nominate('Dan', ['Hal'], executed=False)
    check(player_state('Hal')['deadVoteUsed'], 'a dead voter spends their ghost vote')
    page.click('tr[data-act="edit-nom"] >> nth=2'); page.click('[data-act="del-nom"]')
    check(not player_state('Hal')['deadVoteUsed'], 'deleting the vote refunds the ghost vote')
    nominate('Dan', ['Ben'], executed=False)
    page.evaluate('''(id) => { const q = window.__companion.state.players.find(p => p.id === id);
        q.dead = true; q.death = { how: 'night', when: { kind: 'night', n: 2 } }; }''', pid['Ben'])
    page.click('tr[data-act="edit-nom"] >> nth=2'); page.click('[data-act="save-nom"]')
    check(not player_state('Ben')['deadVoteUsed'], 'a vote cast while alive does not spend a ghost vote')

    # ── Names and game files cannot inject code ──
    bad = '<img src=x onerror="window.__xss=1">'
    page.evaluate('''(b) => { const s = window.__companion.state; s.myChar = 'empath'; s.myAlign = 'good'; s.scriptId = 'trouble-brewing';
        const e = s.players.find(p => p.name === 'Eve'); e.name = b; }''', bad)
    page.click('[data-tab="read"]'); page.wait_for_timeout(100)
    check(page.evaluate('window.__xss === undefined'), 'player names are not run as code in tips')
    check(any(bad in t for t in page.locator('.tip').all_inner_texts()), 'the odd name is still shown as plain text')
    hostile = {'players': [{'id': f'x"><img src=x onerror="window.__xss=2">', 'name': 'Bad'}, {'id': 'ok1', 'name': bad, 'claims': [{'char': 'chef"><img src=x onerror="window.__xss=3">'}]}],
               'phase': {'kind': 'day', 'n': '<img src=x onerror="window.__xss=4">'}, 'scriptId': '__proto__', 'tab': 'nope',
               'noms': [{'id': 'n1', 'day': 1, 'nominator': 'ok1', 'nominee': 'ok1', 'votes': '<img src=x onerror="window.__xss=5">', 'voters': []}],
               'customScript': {'name': bad, 'characters': ['constructor', 'ok'], 'custom': {'ok': {'name': bad, 'team': '"><img src=x onerror="window.__xss=6">'}}}}
    (SHOTS / 'hostile.json').write_text(json.dumps(hostile))
    page.click('[data-tab="setup"]')
    page.set_input_files('#game-file', str(SHOTS / 'hostile.json'))
    page.wait_for_function('window.__companion.state.players.length === 1')
    for t in ['town', 'info', 'days', 'read', 'guide', 'setup']: page.click(f'[data-tab="{t}"]')
    page.wait_for_timeout(100)
    check(page.evaluate('window.__xss === undefined'), 'a hostile game file cannot run code')
    st = page.evaluate('window.__companion.state')
    check(st['phase']['n'] == 1 and st['noms'][0]['votes'] == 0 and st['scriptId'] == 'trouble-brewing', 'malformed game values are replaced with safe ones')
    page.evaluate('''() => { const s = window.__companion.state; s.customScript = null; }''')

    # ── Installable app ──
    manifest = page.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
    sizes = {i['sizes'] for i in manifest['icons'] if i['type'] == 'image/png'}
    check({'192x192', '512x512'} <= sizes and any(i.get('purpose') == 'maskable' for i in manifest['icons']), 'manifest has install icons')
    for src in [i['src'] for i in manifest['icons']] + ['icons/apple-touch-icon.png']:
        check(page.evaluate('(u) => fetch(u).then(r => r.ok)', src), f'{src} is served')

    # Desktop width renders too
    page.set_viewport_size({'width': 1280, 'height': 900}); page.click('[data-tab="town"]')
    page.screenshot(path=str(SHOTS / '7-town-desktop.png'))
    check(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'no horizontal scroll on desktop')
    page.set_viewport_size({'width': 360, 'height': 780})
    for t in ['setup', 'town', 'info', 'days', 'read', 'guide']:
        page.click(f'[data-tab="{t}"]')
        if page.evaluate('document.documentElement.scrollWidth > innerWidth'): check(False, f'no horizontal scroll at 360px on {t}')

    # ── Redesign: navigation, touch targets, tablet layout ──
    page.evaluate('''() => { localStorage.clear(); }''')
    page.reload()
    page.once('dialog', lambda d: d.accept('\n'.join(NAMES)))
    page.click('[data-act="paste-players"]')
    ids = page.evaluate('window.__companion.state.players.map(p => p.id)')
    pid = dict(zip(NAMES, ids))
    page.select_option('#me-sel', pid['Ann']); page.select_option('#mychar-sel', 'empath')
    page.evaluate("""(id) => { const s = window.__companion.state; s.players.find(p => p.id === id).claims = [{ char: 'chef', when: { kind: 'night', n: 1 } }]; }""", pid['Ben'])
    page.set_viewport_size({'width': 390, 'height': 844}); page.click('[data-tab="town"]')
    check(page.locator('#tabs button').count() == 5, 'bottom navigation has five destinations')
    check(page.locator('.topbar [data-tab="setup"]').is_visible(), 'setup is reachable from the top bar')
    small = page.evaluate('''() => [...document.querySelectorAll('#tabs button, .topbar .icon-btn')].filter(b => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length''')
    check(small == 0, 'main navigation meets the 44px touch target')
    page.screenshot(path=str(SHOTS / '9-phone-town.png'))
    page.click(f'.token[data-pid="{pid["Ben"]}"]'); page.wait_for_timeout(300)
    page.screenshot(path=str(SHOTS / '10-phone-sheet.png'))
    page.click('[data-act="close-sheet"]')
    for size in [(768, 1024), (820, 1180)]:
        page.set_viewport_size({'width': size[0], 'height': size[1]}); page.wait_for_timeout(200)
        for t in ['setup', 'town', 'info', 'days', 'read', 'guide']:
            page.click(f'[data-tab="{t}"]')
            if page.evaluate('document.documentElement.scrollWidth > innerWidth'): check(False, f'no horizontal scroll at {size[0]}px on {t}')
    page.screenshot(path=str(SHOTS / '11-tablet-portrait.png'))
    page.set_viewport_size({'width': 1180, 'height': 820}); page.wait_for_timeout(250)
    page.click('[data-tab="town"]')
    check(page.locator('#town-pane .token').count() == 8 and page.locator('#view .suspect').count() == 7, 'tablet shows the town beside suspects')
    page.click('[data-tab="days"]')
    check(page.locator('#town-pane .token').count() == 8 and page.locator('[data-act="new-nom"]').is_visible(), 'town stays visible beside votes')
    page.screenshot(path=str(SHOTS / '12-tablet-landscape.png'))
    page.click(f'#town-pane .token[data-pid="{pid["Ben"]}"]'); page.wait_for_timeout(320)
    box = page.locator('#sheet').bounding_box()
    check(box['x'] > 600 and box['height'] > 800, 'player details open as a side drawer on tablets')
    page.screenshot(path=str(SHOTS / '13-tablet-drawer.png'))
    page.click('[data-act="close-sheet"]')
    page.click('.topbar [data-tab="setup"]')
    check(page.locator('#town-pane').is_hidden(), 'setup uses the full width')
    for size in [(1024, 768), (1180, 820)]:
        page.set_viewport_size({'width': size[0], 'height': size[1]}); page.wait_for_timeout(200)
        for t in ['town', 'info', 'days', 'read', 'guide', 'setup']:
            page.click(f'[data-tab="{t}"]')
            if page.evaluate('document.documentElement.scrollWidth > innerWidth'): check(False, f'no horizontal scroll at {size[0]}px on {t}')
    check(page.evaluate('window.__companion.state.players.length') == 8, 'layout changes keep the game')

    check(not errors, f'no console errors {errors}')
    browser.close()

httpd.shutdown()
print(f'\n{"ALL PASSED" if not failures else str(len(failures)) + " FAILED"}')
sys.exit(1 if failures else 0)
