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
def pick(btn, char):
    """Drive the character picker: open it from its field, tap a character."""
    page.click(f'#{btn}-btn')
    page.wait_for_selector('#picker:not([hidden])')
    if page.locator(f'#picker .pick[data-char="{char}"]').first.is_hidden():
        page.click('#picker details.pick-off > summary')
    page.click(f'#picker .pick[data-char="{char}"]')
    page.wait_for_selector('#picker', state='hidden')

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
    pick('mychar', 'empath')
    check(page.evaluate('window.__companion.state.myAlign') == 'good', 'choosing Empath sets alignment good')
    page.screenshot(path=str(SHOTS / '1-setup.png'), full_page=True)

    # ── Claims via the player sheet ──
    page.click('[data-tab="town"]')
    def claim(name, char):
        page.click(f'.token[data-pid="{pid[name]}"]')
        pick('claim', char)
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
    pick('ev', 'poisoner')
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
    pick('claim', 'monk')
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
    page.select_option('#me-sel', pid['Ann']); pick('mychar', 'empath')
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

    # ═══ Phase 4: picker, role prompts, fast capture, undo ═══
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(400)  # let the debounced resize render finish before clearing storage
    page.evaluate('localStorage.clear()'); page.reload()
    page.once('dialog', lambda d: d.accept('\n'.join(NAMES)))
    page.click('[data-act="paste-players"]')
    ids = page.evaluate('window.__companion.state.players.map(p => p.id)')
    pid = dict(zip(NAMES, ids))
    S = lambda: page.evaluate('window.__companion.state')
    depth = lambda: page.evaluate('window.__companion.undoDepth')
    snap = lambda: json.dumps(S(), sort_keys=True)
    def player_by(name): return next(p for p in S()['players'] if p['name'] == name)
    def open_player(name):
        if page.locator('#sheet').is_visible(): page.click('#sheet [data-act="close-sheet"]')
        page.click(f'#view .token[data-pid="{pid[name]}"]')
        page.wait_for_selector('#sheet:not([hidden])')
    def set_claim(name, char):
        page.evaluate("([n, c]) => { const p = window.__companion.state.players.find(x => x.name === n); p.claims = c ? [{ char: c, when: { kind: 'night', n: 1 } }] : []; }", [name, char])
    def columns():
        return page.evaluate("""() => { const bs = [...document.querySelector('#picker-list > .pick-grid').querySelectorAll('.pick')];
            const t = bs[0].getBoundingClientRect().top; return bs.filter(b => Math.abs(b.getBoundingClientRect().top - t) < 2).length; }""")
    no_hscroll = lambda: page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    undo_toast = lambda: page.click('.toast .toast-undo')

    # Your own true role, chosen from the grid in Setup
    page.select_option('#me-sel', pid['Ann'])
    page.click('#mychar-btn'); page.wait_for_selector('#picker:not([hidden])')
    check(page.evaluate("document.activeElement.id") != 'picker-q', 'opening the picker does not focus the search box')
    heads = page.evaluate("[...document.querySelectorAll('#picker-list > h3')].map(h => h.textContent)")
    check(heads == ['Townsfolk', 'Outsider', 'Minion', 'Demon'], f'picker groups the script by team in order ({heads})')
    small = page.evaluate("""() => [...document.querySelectorAll('#picker .pick, #picker .pick-none')].filter(b => b.offsetParent).filter(b => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length""")
    check(small == 0, 'picker touch targets are at least 44px')
    check(page.evaluate("document.querySelector('#picker details.pick-off').open") is False, '"Not on this script" starts collapsed')
    check(page.locator('#picker .pick-none').is_visible(), 'a clear option is offered for your character')
    page.keyboard.press('Escape')
    check(page.locator('#picker').is_hidden(), 'Escape closes the picker')
    pick('mychar', 'empath')
    check('Empath' in page.locator('#mychar-btn').inner_text() and S()['myChar'] == 'empath' and S()['myAlign'] == 'good', 'one tap picks and closes (true role)')

    # Claims: grid, selected mark, layout at 360px, screenshot
    page.click('[data-tab="town"]')
    open_player('Ben')
    page.click('#claim-btn'); page.wait_for_selector('#picker:not([hidden])')
    page.set_viewport_size({'width': 360, 'height': 780}); page.wait_for_timeout(250)
    cols360 = columns()
    check(cols360 >= 3 and no_hscroll() and page.evaluate("document.querySelector('#picker').scrollWidth <= document.querySelector('#picker').clientWidth"), f'picker fits 360px with no horizontal scroll ({cols360} columns)')
    page.screenshot(path=str(SHOTS / '14-picker-phone.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.fill('#picker-q', 'mon')
    check(page.locator('#picker .pick[data-char="monk"]').is_visible() and not page.locator('#picker .pick[data-char="imp"]').is_visible(), 'search filters by name')
    check(page.evaluate("document.activeElement.id") == 'picker-q', 'typing keeps focus in the search box')
    page.fill('#picker-q', 'qqqq')
    check('No characters match' in page.locator('#picker-list').inner_text(), 'search shows an empty state')
    page.fill('#picker-q', 'chef'); page.keyboard.press('Enter')
    check(page.locator('#picker').is_hidden() and player_by('Ben')['claims'][-1]['char'] == 'chef', 'a search plus Enter picks the single match')
    check('Chef' in page.locator('#claim-btn').inner_text(), 'the claim field shows the pick')

    # Duplicate-claim indicator; off-script picks
    open_player('Cat')
    page.click('#claim-btn'); page.wait_for_selector('#picker:not([hidden])')
    check(page.locator('#picker .pick[data-char="chef"] .pk-dup').inner_text().strip() == 'Ben', 'a character already claimed by Ben shows his name')
    check(page.locator('#picker .pick[data-char="monk"] .pk-dup').count() == 0, 'unclaimed characters show no indicator')
    page.keyboard.press('Escape')
    open_player('Ben'); page.click('#claim-btn'); page.wait_for_selector('#picker:not([hidden])')
    check(page.locator('#picker .pick[data-char="chef"]').get_attribute('aria-pressed') == 'true' and page.locator('#picker .pick[data-char="chef"] .pk-dup').count() == 0, 'the current pick is marked, and your own claim is not flagged as a duplicate')
    page.keyboard.press('Escape')
    open_player('Cat'); pick('claim', 'zombuul')
    check(player_by('Cat')['claims'][-1]['char'] == 'zombuul', 'a character from outside the script can be picked')
    page.click('#claim-btn'); page.fill('#picker-q', 'vortox')
    check(page.evaluate("document.querySelector('#picker details.pick-off').open") is True, 'searching opens "Not on this script" when it has matches')
    page.click('#picker .pick[data-char="vortox"]')
    check(player_by('Cat')['claims'][-1]['char'] == 'vortox' and 'not on script' in page.locator('#claim-btn').inner_text(), 'off-script claim is shown as such')
    page.click('#claim-btn'); page.click('#picker .pick-none')
    check(player_by('Cat')['claims'] == [], 'the clear option removes the claim')

    # A draft survives the picker, and Escape closes only the picker
    open_player('Dan')
    page.click('[data-act="new-note"]')
    page.click('.sheet [data-act="note-kind"][data-v="learned"]')
    page.click(f'.sheet [data-act="note-target"][data-pid="{pid["Eve"]}"]')
    page.fill('#note-text', 'draft stays')
    page.click('#note-btn'); page.wait_for_selector('#picker:not([hidden])')
    page.keyboard.press('Escape')
    check(page.locator('#picker').is_hidden() and page.locator('#sheet').is_visible(), 'Escape closes only the picker, not the sheet underneath')
    check(page.input_value('#note-text') == 'draft stays', 'the draft text is intact after Escape')
    pick('note', 'monk')
    check(page.input_value('#note-text') == 'draft stays' and 'Monk' in page.locator('#note-btn').inner_text()
          and page.locator('.sheet .chip-btn.on').all_inner_texts() == ['Eve'] and 'Learned' in page.locator('.sheet .seg button.on').inner_text(), 'picking keeps text, players and kind in the form')
    page.keyboard.press('Escape')
    check(page.locator('#sheet').is_hidden() and S()['notes'] == [], 'a second Escape closes the sheet and discards the draft')

    # Role prompts open the right form
    CASES = [('monk', 'Who did they protect?', 'note', 'Protected'), ('soldier', 'Did they survive a Demon attack?', 'note', 'Survived'),
             ('empath', 'What number did they get?', 'empath', None), ('slayer', 'Who did they shoot?', 'slayer', None),
             ('fortuneteller', 'Who did they check, and what result?', 'fortune', None), ('undertaker', 'Who did they see executed?', 'ischar', None),
             ('washerwoman', 'Which two players were they shown, and as what?', 'ping', None), ('clockmaker', 'What number did they get?', 'clock', None),
             ('seamstress', 'Who did they check, and same or different?', 'seam', None), ('oracle', 'How many dead players are evil?', 'oracle', None),
             ('flowergirl', 'Did the Demon vote today?', 'flower', None), ('juggler', 'What did they guess, and how many were right?', 'note', 'Juggler')]
    for char, text, form, starter in CASES:
        set_claim('Dan', char); open_player('Dan')
        texts = page.locator('.sheet .prompt').all_inner_texts()
        check(any(text in t for t in texts) and len(texts) <= 2, f'{char}: prompt "{text}" shown')
        page.click('.sheet .prompt >> nth=0')
        if form == 'note':
            check(page.locator('#note-text').input_value().startswith(starter) and 'Dan' in page.locator('.sheet h2').inner_text(), f'{char}: opens the timeline note with a starter')
            page.click('[data-act="cancel-note"]')
        else:
            check(page.locator('#ev-tpl').input_value() == form and page.locator('#ev-src').input_value() == pid['Dan'], f'{char}: opens the structured {form} form with the source set')
            page.click('[data-act="cancel-ev"]')
        check('Dan' in page.locator('.sheet h2').inner_text() and page.locator('#claim-btn').is_visible(), f'{char}: back returns to the player sheet')
    set_claim('Dan', 'saint'); open_player('Dan')
    check(page.locator('.sheet .prompt').count() == 0, 'a character with no action or info gets no prompt')
    set_claim('Dan', 'nonexistent-custom'); open_player('Dan')
    check(page.locator('.sheet .prompt').count() == 0, 'unknown characters simply get no prompt')
    set_claim('Dan', 'empath'); open_player('Ann')
    check('What number did you get?' in page.locator('.sheet .prompt').first.inner_text(), 'prompts on your own sheet are phrased for you')
    page.click('.sheet .prompt >> nth=0')
    check(page.locator('#ev-tpl').input_value() == 'empath' and page.locator('#ev-src').input_value() == pid['Ann'], 'my own true-role prompt opens structured info with me as the source')
    page.click('[data-act="cancel-ev"]')

    # Faster capture: save returns to the player's sheet; one tap for another entry
    ev0 = len(S()['evidence'])
    open_player('Dan'); page.click('.sheet .prompt >> nth=0')
    page.click('[data-act="draft-n"][data-v="1"]'); page.click('[data-act="save-draft"]:not([data-more])')
    check(page.locator('#sheet').is_visible() and 'Dan' in page.locator('.sheet h2').inner_text() and page.locator('#ev-tpl').count() == 0, 'saving info returns to the player sheet')
    check(len(S()['evidence']) == ev0 + 1 and 'Empath' in page.locator('.timeline').inner_text(), 'the info appears on their timeline')
    page.click('.sheet .prompt >> nth=0')
    page.click('[data-act="save-draft"][data-more="1"]')
    check(page.locator('#ev-tpl').input_value() == 'empath' and page.locator('#ev-src').input_value() == pid['Dan'] and len(S()['evidence']) == ev0 + 2, 'Save & add another keeps the source and opens a fresh form')
    page.click('[data-act="cancel-ev"]')
    set_claim('Dan', 'monk'); open_player('Dan'); n0 = len(S()['notes'])
    page.click('.sheet .prompt >> nth=0')
    page.click(f'.sheet [data-act="note-target"][data-pid="{pid["Eve"]}"]'); page.click('[data-act="save-note"]:not([data-more])')
    check(page.locator('#note-text').count() == 0 and 'Dan' in page.locator('.sheet h2').inner_text() and len(S()['notes']) == n0 + 1, 'saving a note returns to the player sheet')
    page.click('.sheet .prompt >> nth=0'); page.click('[data-act="save-note"][data-more="1"]')
    check(page.input_value('#note-text') == '' and 'Did' in page.locator('.sheet .seg button.on').inner_text() and len(S()['notes']) == n0 + 2, 'Save & add another opens a blank note of the same kind')
    page.click('[data-act="cancel-note"]')

    # The bluffing rule: a fake story is a public note, never evidence
    set_claim('Ann', 'chef'); open_player('Ann')
    check('What number did you get?' in page.locator('.sheet .prompt').first.inner_text() and 'told the table' in page.locator('.prompts label').inner_text(), 'while bluffing, prompts follow the public claim')
    ev0, n0 = len(S()['evidence']), len(S()['notes'])
    page.click('.sheet .prompt >> nth=0')
    check(page.locator('#ev-tpl').count() == 0 and page.locator('#note-text').is_visible(), 'a bluff prompt opens the note form, not the info form')
    check('What I told the table' in page.locator('.sheet .seg button.on').all_inner_texts()[0], 'a bluff prompt is preset to "What I told the table"')
    page.click('[data-act="save-note"]:not([data-more])')
    last = S()['notes'][-1]
    check(last['story'] == 'public' and last['player'] == pid['Ann'] and len(S()['notes']) == n0 + 1 and len(S()['evidence']) == ev0, 'a bluff prompt saves a public note and adds zero evidence')
    set_claim('Ann', 'monk'); open_player('Ann'); page.click('.sheet .prompt >> nth=0')
    check('What I told the table' in page.locator('.sheet .seg button.on').all_inner_texts()[0], 'bluffing as a role with no template is also public')
    page.click('[data-act="cancel-note"]')
    set_claim('Ann', 'empath'); open_player('Ann'); page.click('.sheet .prompt >> nth=0')
    check(page.locator('#ev-tpl').input_value() == 'empath', 'telling the truth still opens structured info')
    page.click('[data-act="cancel-ev"]')
    set_claim('Ann', ''); open_player('Ann')
    check(page.locator('.sheet .prompt').count() >= 1, 'with no public claim, prompts follow your true role')
    page.click('#sheet [data-act="close-sheet"]')

    # Undo
    d0 = depth()
    open_player('Eve')
    check(depth() == d0, 'opening a sheet creates no undo step')
    page.fill('#pnotes', 'typing one letter at a time'); page.click('#sheet [data-act="close-sheet"]'); page.click('[data-tab="info"]'); page.click('[data-tab="town"]')
    check(depth() == d0, 'typing and switching tabs create no undo steps')
    open_player('Eve'); st0 = snap()
    pick('claim', 'saint')
    check(depth() == d0 + 1 and page.locator('.toast').count() == 1 and page.locator('.toast .toast-undo').is_visible(), 'setting a claim shows one toast with Undo')
    undo_toast()
    check(snap() == st0 and player_by('Eve')['claims'] == [] and 'no claim' in page.locator('#claim-btn').inner_text(), 'Undo restores the exact prior state and refreshes the open sheet')
    pick('claim', 'saint'); page.click('#claim-btn'); page.click('#picker .pick-none')
    check(player_by('Eve')['claims'] == [], 'clearing a claim works')
    undo_toast()
    check(player_by('Eve')['claims'][-1]['char'] == 'saint', 'Undo brings a cleared claim back')
    set_claim('Eve', '')
    # notes
    n0 = len(S()['notes']); st0 = snap()
    page.click('[data-act="new-note"]'); page.fill('#note-text', 'Undo me'); page.click('[data-act="save-note"]:not([data-more])')
    check(len(S()['notes']) == n0 + 1 and 'Undo me' in page.locator('.timeline').inner_text(), 'note saved from the sheet')
    undo_toast()
    check(snap() == st0 and 'Undo me' not in page.locator('#sheet').inner_text() and 'Eve' in page.locator('.sheet h2').inner_text(), 'Undo removes a saved note and stays on the player sheet')
    page.click('[data-act="new-note"]'); page.fill('#note-text', 'Delete me'); page.click('[data-act="save-note"]:not([data-more])')
    st1 = snap()
    page.click('.timeline .tl-item[data-act="edit-note"]:has-text("Delete me")'); page.click('[data-act="del-note"]')
    check(len(S()['notes']) == n0, 'note deleted')
    undo_toast(); check(snap() == st1, 'Undo brings a deleted note back')
    # death
    st0 = snap()
    page.click('.sheet [data-act="death"][data-v="night"]')
    check(player_by('Eve')['dead'], 'death recorded')
    undo_toast()
    check(not player_by('Eve')['dead'] and snap() == st0 and 'on' in (page.locator('.sheet [data-act="death"][data-v=""]').get_attribute('class') or ''), 'Undo reverses a death toggle')
    # the toast must not block the sheet's buttons or the nav
    page.click('.sheet [data-act="death"][data-v="night"]'); page.click('[data-act="new-note"]')
    blocked = page.evaluate("""() => { const hit = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).closest(sel) !== null; };
        const t = document.querySelector('.toast').getBoundingClientRect(), sh = document.querySelector('#sheet').getBoundingClientRect();
        return { undo: hit('.toast-undo'), save: hit('[data-act="save-note"]'), clear: t.bottom <= sh.top + 1 }; }""")
    check(blocked['undo'] and blocked['save'] and blocked['clear'], f'the toast leaves the sheet buttons tappable ({blocked})')
    page.click('[data-act="cancel-note"]'); undo_toast()
    page.click('#sheet [data-act="close-sheet"]')
    page.click('[data-act="next-phase"] >> nth=0')
    r = page.evaluate("""() => { const t = document.querySelector('.toast').getBoundingClientRect(), n = document.querySelector('#tabs').getBoundingClientRect(); return t.bottom <= n.top && t.top > 0; }""")
    check(r and page.locator('.toast .toast-undo').is_visible(), 'the toast sits above the bottom navigation')
    undo_toast()
    check(S()['phase'] == {'kind': 'night', 'n': 1}, 'Undo reverses a phase change')
    page.click('[data-act="next-phase"] >> nth=0'); page.click('[data-act="prev-phase"]')
    check(S()['phase'] == {'kind': 'night', 'n': 1}, 'going back a phase works')
    undo_toast(); check(S()['phase']['kind'] == 'day', 'Undo reverses going back a phase')
    # nominations
    page.click('[data-tab="days"]'); st0 = snap()
    page.click('[data-act="new-nom"]'); page.select_option('#nom-a', pid['Cat']); page.select_option('#nom-b', pid['Fay'])
    page.click('[data-act="nom-exec"]'); page.click('[data-act="save-nom"]')
    check(player_by('Fay')['dead'] and len(S()['noms']) == 1, 'nomination saved with an execution')
    undo_toast(); check(snap() == st0 and not player_by('Fay')['dead'], 'Undo reverses a saved nomination and its execution')
    page.click('[data-act="new-nom"]'); page.select_option('#nom-a', pid['Cat']); page.select_option('#nom-b', pid['Fay']); page.click('[data-act="save-nom"]')
    st1 = snap()
    page.click('tr[data-act="edit-nom"]'); page.click('[data-act="del-nom"]')
    check(len(S()['noms']) == 0, 'nomination deleted')
    undo_toast(); check(snap() == st1, 'Undo brings a deleted nomination back')
    # player removal
    page.click('.topbar [data-tab="setup"]'); st0 = snap()
    page.once('dialog', lambda d: d.accept())
    page.click(f'.plist li[data-pid="{pid["Hal"]}"] [data-act="del-player"]')
    check(len(S()['players']) == 7, 'player removed')
    undo_toast()
    check(snap() == st0 and page.locator('.plist li').count() == 8, 'Undo restores a removed player with their data')
    # undo is never saved
    ls = page.evaluate("localStorage.getItem('botc-companion-v1')")
    check('undo' not in ls.lower() and not any('undo' in k.lower() for k in S().keys()), 'the undo history is not part of the saved game')
    ev_n = len(S()['evidence'])
    page.once('dialog', lambda d: d.accept()); page.click('[data-act="new-game"]')
    check(len(S()['evidence']) == 0 and S()['myChar'] == '', 'New game clears the data')
    undo_toast(); check(len(S()['evidence']) == ev_n and S()['myChar'] == 'empath', 'Undo restores a game cleared by New game')
    # history is bounded, and the toast expires
    page.evaluate("for (let i = 0; i < 40; i++) document.querySelector('[data-act=\"next-phase\"]').click()")
    check(depth() == 30, f'the undo stack is bounded at 30 (got {depth()})')
    page.wait_for_timeout(6300)
    check(page.locator('.toast').count() == 0, 'the undo toast goes away after about 6 seconds')
    # loading a game, then undoing while a sheet for a vanished player is open
    other = {'players': [{'id': 'zz1', 'name': 'Zed'}, {'id': 'zz2', 'name': 'Yan'}], 'scriptId': 'trouble-brewing'}
    (SHOTS / 'other.json').write_text(json.dumps(other))
    page.set_input_files('#game-file', str(SHOTS / 'other.json'))
    page.wait_for_function('window.__companion.state.players.length === 2')
    page.click('[data-tab="town"]'); page.click('#view .token >> nth=0'); page.wait_for_selector('#sheet:not([hidden])')
    undo_toast()
    check(page.locator('#sheet').is_hidden() and len(S()['players']) == 8, 'Undo of a loaded game closes a sheet whose player no longer exists')
    # picker text is escaped
    bad = '<img src=x onerror="window.__xss=9">'
    page.evaluate("(b) => { const s = window.__companion.state; s.players[1].name = b; s.players[1].claims = [{ char: 'chef', when: { kind: 'night', n: 1 } }]; }", bad)
    page.click('[data-tab="town"]'); open_player('Cat'); page.click('#claim-btn'); page.wait_for_timeout(100)
    check(page.evaluate('window.__xss === undefined') and bad in page.locator('#picker .pick[data-char="chef"] .pk-dup').inner_text(), 'names in the duplicate indicator are escaped')
    page.keyboard.press('Escape'); page.keyboard.press('Escape')

    # Picker on tablets: more columns, no horizontal scroll, screenshots
    page.evaluate("(n) => { window.__companion.state.players[1].name = n; }", 'Ben')
    for w, h, shot in [(768, 1024, '16-picker-tablet-portrait.png'), (1180, 820, '15-picker-tablet.png')]:
        page.set_viewport_size({'width': w, 'height': h}); page.wait_for_timeout(250); page.click('[data-tab="town"]')
        page.click(f'{"#town-pane" if w >= 900 else "#view"} .token[data-pid="{pid["Ben"]}"]'); page.wait_for_selector('#sheet:not([hidden])')
        page.click('#claim-btn'); page.wait_for_selector('#picker:not([hidden])'); page.wait_for_timeout(300)
        c = columns()
        check(c > cols360 and no_hscroll(), f'picker uses more columns at {w}px ({c} vs {cols360} on a phone) with no horizontal scroll')
        page.screenshot(path=str(SHOTS / shot))
        page.keyboard.press('Escape'); page.keyboard.press('Escape')
    page.set_viewport_size({'width': 390, 'height': 844})

    # ── Undo never erases later edits, and can step back more than once ──
    page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(200)
    page.click('[data-tab="town"]')
    target = page.evaluate('(() => { const s = window.__companion.state; return s.players.find(p => p.id !== s.meId).id; })()')
    field = lambda k: page.evaluate('([id, k]) => window.__companion.state.players.find(p => p.id === id)[k]', [target, k])
    page.click(f'.token[data-pid="{target}"]')
    page.click('[data-act="gut"][data-v="0"]'); page.click('[data-act="lock"][data-v=""]')
    page.click('[data-act="gut"][data-v="1"]'); page.click('[data-act="lock"][data-v="good"]')
    page.click('.toast .toast-undo')
    check(field('lock') == '' and field('gut') == 1, 'first undo reverses only the latest change')
    page.click('.toast .toast-undo')
    check(field('gut') == 0, 'undo can step back a second time')
    page.click('[data-act="gut"][data-v="2"]')
    page.fill('#pnotes', 'Typed after the last action')
    check(page.locator('.toast .toast-undo').count() == 0 and page.evaluate('window.__companion.undoDepth') == 0, 'typing a note ends the undo history')
    check(field('notes') == 'Typed after the last action' and field('gut') == 2, 'typed notes and earlier changes are kept')
    page.click('[data-act="close-sheet"]')

    check(not errors, f'no console errors {errors}')
    browser.close()

httpd.shutdown()
print(f'\n{"ALL PASSED" if not failures else str(len(failures)) + " FAILED"}')
sys.exit(1 if failures else 0)
