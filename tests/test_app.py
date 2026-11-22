"""End-to-end checks for Clocktower Companion.

Run:  python3 tests/test_app.py   (needs Python Playwright + Chromium)
Serves the repo on a random local port, drives the app in a phone-sized
browser, checks the solver's conclusions, and saves screenshots to tests/screens/.
"""
import functools, http.server, json, os, pathlib, re, socketserver, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / 'tests' / 'screens'
SHOTS.mkdir(exist_ok=True)

# Per-path tweaks so tests can simulate a bad network: DELAY seconds, a fixed STATUS, or a replacement BODY (bytes) with its type.
DELAY, STATUS, BODY = {}, {}, {}
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        path = self.path.split('?')[0]
        if path in DELAY: time.sleep(DELAY[path])
        if path in STATUS or path in BODY:
            body, ctype = BODY.get(path, (b'server error', 'text/plain'))
            self.send_response(STATUS.get(path, 200)); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.end_headers()
            try: self.wfile.write(body)
            except OSError: pass
            return
        try: super().do_GET()
        except OSError: pass  # the browser gave up on a slow reply
Handler = functools.partial(Quiet, directory=str(ROOT))
class Server(socketserver.ThreadingMixIn, socketserver.TCPServer): daemon_threads = True
httpd = Server(('127.0.0.1', 0), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{httpd.server_address[1]}/index.html'
BASE = URL.rsplit('/', 1)[0]

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

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import types, launch_checks
LAUNCH = types.SimpleNamespace(check=check, URL=URL, BASE=BASE, ROOT=ROOT, SHOTS=SHOTS, DELAY=DELAY, STATUS=STATUS, BODY=BODY, numbers={})

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    if os.environ.get('LAUNCH_ONLY'):  # development shortcut: only the launch-readiness checks
        launch_checks.run(browser, LAUNCH); browser.close(); httpd.shutdown()
        print(f'\n{"ALL PASSED" if not failures else str(len(failures)) + " FAILED"}'); sys.exit(1 if failures else 0)
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
    for t in ['town', 'info', 'days', 'read', 'bluff', 'guide', 'setup']: page.click(f'[data-tab="{t}"]')
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
    for t in ['setup', 'town', 'info', 'days', 'read', 'bluff', 'guide']:
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
    check(page.locator('#tabs button').count() == 6, 'bottom navigation has six destinations')
    check(page.locator('.topbar [data-tab="setup"]').is_visible(), 'setup is reachable from the top bar')
    small = page.evaluate('''() => [...document.querySelectorAll('#tabs button, .topbar .icon-btn')].filter(b => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length''')
    check(small == 0, 'main navigation meets the 44px touch target')
    page.screenshot(path=str(SHOTS / '9-phone-town.png'))
    page.click(f'.token[data-pid="{pid["Ben"]}"]'); page.wait_for_timeout(300)
    page.screenshot(path=str(SHOTS / '10-phone-sheet.png'))
    page.click('[data-act="close-sheet"]')
    for size in [(768, 1024), (820, 1180)]:
        page.set_viewport_size({'width': size[0], 'height': size[1]}); page.wait_for_timeout(200)
        for t in ['setup', 'town', 'info', 'days', 'read', 'bluff', 'guide']:
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
        for t in ['town', 'info', 'days', 'read', 'bluff', 'guide', 'setup']:
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
    tiny = """() => { const cells = [...document.querySelectorAll('#picker .pick, #picker .pick-none')].filter(b => !b.closest('details:not([open])'));
      return { cells: cells.length, small: cells.filter(b => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length }; }"""
    shown = page.evaluate(tiny)
    check(shown['cells'] > 0 and shown['small'] == 0, 'picker touch targets are at least 44px')
    check(page.evaluate("document.querySelector('#picker details.pick-off').open") is False, '"Not on this script" starts collapsed')
    page.click('#picker details.pick-off > summary')
    expanded = page.evaluate(tiny)
    check(expanded['cells'] > shown['cells'] and expanded['small'] == 0, 'off-script picker cells are at least 44px when expanded')
    page.click('#picker details.pick-off > summary')
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
    check('What number did you get?' in page.locator('.sheet .prompt').first.inner_text() and 'told the table' in page.locator('.prompts .field').inner_text(), 'while bluffing, prompts follow the public claim')
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

    # ── Bluff Studio: rules ──
    rules = page.evaluate("""() => {
      const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, claims: [], dead: false, death: null, gut: 0, lock: '', notes: '' }));
      const sc = SCRIPTS['trouble-brewing'];
      const line = (kind, whenKind, n, targets = [], text = 'x') => ({ id: 'l' + Math.random(), player: 'p0', when: { kind: whenKind, n }, kind, targets, char: '', text, story: 'public' });
      const game = (cover, build = () => {}, extra = {}) => {
        const s = { players: mk(8), meId: 'p0', myChar: 'imp', myAlign: 'evil', knownEvil: ['p3'], knownDemon: null, phase: { kind: 'day', n: 3 },
          evidence: [], noms: [], notes: [], bluff: { demonBluffs: [], plan: [] }, ...extra };
        if (cover) s.players[0].claims = [{ char: cover, when: { kind: 'day', n: 1 } }];
        build(s); return s;
      };
      const has = (s, re) => Engine.bluffCheck(s, sc).issues.some(i => re.test(i.text));
      const kill = (s, i, how, kind, n) => { s.players[i].dead = true; s.players[i].death = { how, when: { kind, n } }; };
      const opts = (s) => Object.fromEntries(Engine.bluffOptions(s, sc).map(o => [o.id, o]));
      const o = opts(game('', s => { s.bluff.demonBluffs = ['soldier']; s.players[2].claims = [{ char: 'chef', when: { kind: 'day', n: 1 } }]; }));
      return {
        truthful: Engine.bluffCheck(game('imp'), sc).isBluff === false,
        offScript: has(game('clockmaker'), /not on this script/),
        rival: has(game('chef', s => { s.players[2].claims = [{ char: 'chef', when: { kind: 'day', n: 1 } }]; }), /P2 also claims/),
        teammate: has(game('chef', s => { s.players[3].claims = [{ char: 'chef', when: { kind: 'day', n: 1 } }]; }), /Your teammate P3/),
        notDemonBluff: has(game('chef', s => { s.bluff.demonBluffs = ['monk']; }), /not one of the Demon/),
        isDemonBluff: has(game('monk', s => { s.bluff.demonBluffs = ['monk']; }), /is one of the Demon/),
        chefNight2: has(game('chef', s => { s.bluff.plan = [line('learned', 'night', 2)]; }), /only learns something on Night 1/),
        chefDay1Ok: !has(game('chef', s => { s.bluff.plan = [line('learned', 'day', 1)]; }), /only learns/),
        monkNight1: has(game('monk', s => { s.bluff.plan = [line('did', 'night', 1, ['p1'])]; }), /does not act on Night 1/),
        monkDied: has(game('monk', s => { kill(s, 1, 'night', 'night', 2); s.bluff.plan = [line('did', 'night', 2, ['p1'])]; }), /protected P1 on Night 2/),
        undertakerNone: has(game('undertaker', s => { s.bluff.plan = [line('learned', 'night', 2)]; }), /Nobody was executed on Day 1/),
        undertakerWrong: has(game('undertaker', s => { kill(s, 1, 'execution', 'day', 1); s.bluff.plan = [line('learned', 'night', 2, ['p2'])]; }), /P2 was not executed/),
        undertakerOk: !has(game('undertaker', s => { kill(s, 1, 'execution', 'day', 1); s.bluff.plan = [line('learned', 'night', 2, ['p1'])]; }), /executed/),
        undertakerFuture: !has(game('undertaker', s => { s.phase = { kind: 'day', n: 1 }; s.bluff.plan = [line('learned', 'night', 2)]; }), /Nobody was executed/),
        soldierDied: has(game('soldier', s => kill(s, 0, 'night', 'night', 2)), /died at night/),
        saintExecuted: has(game('saint', s => kill(s, 0, 'execution', 'day', 1)), /disproves a healthy Saint/),
        ravenAlive: has(game('ravenkeeper', s => { s.bluff.plan = [line('learned', 'night', 2)]; }), /only learns something after dying/),
        ravenDied: !has(game('ravenkeeper', s => { kill(s, 0, 'night', 'night', 2); s.bluff.plan = [line('learned', 'night', 2)]; }), /after dying|no ability/),
        afterDeath: has(game('empath', s => { kill(s, 0, 'execution', 'day', 1); s.bluff.plan = [line('learned', 'night', 2)]; }), /would have no ability/),
        slayerTwice: has(game('slayer', s => { s.bluff.plan = [line('did', 'day', 1), line('did', 'day', 2)]; }), /once per game/),
        slayerNight: has(game('slayer', s => { s.bluff.plan = [line('did', 'night', 2)]; }), /during the day/),
        virginMissed: has(game('virgin', s => { s.players[2].claims = [{ char: 'chef', when: { kind: 'day', n: 1 } }];
          s.noms = [{ id: 'n', day: 1, nominator: 'p2', nominee: 'p0', voters: [], votes: 0, executed: false }]; }), /real Virgin would have triggered/),
        tooManyOutsiders: has(game('saint', s => { s.players[1].claims = [{ char: 'recluse', when: { kind: 'day', n: 1 } }];
          s.players[2].claims = [{ char: 'butler', when: { kind: 'day', n: 1 } }]; s.players[4].claims = [{ char: 'drunk', when: { kind: 'day', n: 1 } }]; }), /at most 3/),
        changedClaim: has(game('chef', s => { s.players[0].claims = [{ char: 'monk', when: { kind: 'day', n: 1 } }, { char: 'chef', when: { kind: 'day', n: 2 } }]; }), /changed your claim/),
        gap: has(game('empath', s => { s.bluff.plan = [line('learned', 'night', 1)]; }), /no story yet for Night 2, Night 3/),
        demonBluffRanksFirst: Engine.bluffOptions(game('', s => { s.bluff.demonBluffs = ['soldier']; }), sc)[0].id === 'soldier',
        takenIsRisky: o.chef.rating === 'risky' && o.chef.takenBy[0] === 'P2',
        noDrunk: !o.drunk, noOwnRole: !opts(game('', s => { s.myChar = 'chef'; s.myAlign = 'good'; })).chef,
        virginRisky: o.virgin.score < o.washerwoman.score,
      };
    }""")
    for name, ok in rules.items(): check(ok is True, f'bluff rule: {name}')

    # ── Bluff Studio: flow and privacy ──
    page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(250)
    seed = {'v': 3, 'players': [{'id': f'p{i}', 'name': n, 'claims': []} for i, n in enumerate(NAMES)], 'meId': 'p0', 'myChar': 'imp', 'myAlign': 'evil',
            'knownEvil': ['p3'], 'phase': {'kind': 'day', 'n': 1}, 'evidence': [], 'noms': [], 'notes': [], 'tab': 'bluff'}
    page.evaluate("(s) => localStorage.setItem('botc-companion-v1', JSON.stringify(s))", seed); page.reload()
    gs = lambda: page.evaluate('window.__companion.state')
    check(page.locator('#view h2').first.inner_text() == 'Bluff Studio', 'Bluff tab opens the studio')
    pick('dbluff-0', 'soldier'); pick('dbluff-1', 'chef'); pick('dbluff-2', 'monk')
    check(gs()['bluff']['demonBluffs'] == ['soldier', 'chef', 'monk'], 'the Demon\'s three bluffs are stored')
    pick('dbluff-1', 'soldier')
    check(gs()['bluff']['demonBluffs'].count('soldier') == 1, 'a Demon bluff cannot be stored twice')
    page.click('.toast .toast-undo')
    check(gs()['bluff']['demonBluffs'] == ['soldier', 'chef', 'monk'], 'Demon bluff changes can be undone')
    page.click('[data-act="use-bluff"][data-char="chef"]')
    check(gs()['players'][0]['claims'][-1]['char'] == 'chef' and gs()['myChar'] == 'imp', 'using a bluff sets the public claim only')
    check('one of the Demon' in page.locator('#view').inner_text(), 'story check confirms a Demon bluff')
    page.click('[data-act="plan-new"]')
    page.click('[data-act="note-kind"][data-v="learned"]')
    page.select_option('#note-when', 'night:2')
    page.fill('#note-text', 'Secret plan line')
    page.click('[data-act="save-note"]')
    check(len(gs()['bluff']['plan']) == 1 and page.locator('#sheet').is_hidden(), 'a planned line saves and returns to the studio')
    check('only learns something on Night 1' in page.locator('#view').inner_text(), 'story check flags a planned line that breaks the rules')
    page.screenshot(path=str(SHOTS / '17-bluff-phone.png'))
    page.screenshot(path=str(SHOTS / '18-bluff-phone-full.png'), full_page=True)
    check(not any('Secret plan line' in json.dumps(x) for x in page.evaluate("Engine.timeline(window.__companion.state, 'p1')")), 'planned lines stay off other timelines')
    check(not any('Secret plan line' in json.dumps(x) for x in page.evaluate("Engine.timeline(window.__companion.state, 'p0')")), 'planned lines stay off the public timeline')
    page.click('[data-act="plan-edit"]'); page.select_option('#note-when', 'day:1')
    page.click(f'.sheet [data-act="note-target"][data-pid="p1"]'); page.click('[data-act="save-note"]')
    page.click('[data-act="plan-told"]')
    g = gs()
    check(g['bluff']['plan'] == [] and g['notes'][-1]['story'] == 'public' and g['evidence'] == [], 'marking as told makes a public note and adds no evidence')
    check(any('Secret plan line' in json.dumps(x) for x in page.evaluate("Engine.timeline(window.__companion.state, 'p1')")), 'told lines appear on the named player\'s timeline')
    page.click('.toast .toast-undo')
    check(len(gs()['bluff']['plan']) == 1 and gs()['notes'] == [], 'marking as told can be undone')
    page.click('[data-act="plan-told"]')
    page.click('[data-act="edit-note"]'); page.click('[data-act="cancel-note"]')
    check(page.locator('#sheet').is_hidden() and page.locator('#view h2').first.inner_text() == 'Bluff Studio', 'editing a told line returns to the studio')
    page.reload()
    check(gs()['tab'] == 'bluff' and gs()['bluff']['demonBluffs'] == ['soldier', 'chef', 'monk'], 'studio data survives reload')
    clean = page.evaluate("""() => Engine.sanitizeGame({ players: [{ id: 'a', name: 'A' }], meId: 'a',
      bluff: { demonBluffs: ['chef', 'x"><img', 'monk', 'soldier', 'mayor'], plan: [{ id: 'k', when: { kind: 'day', n: 'x' }, kind: 'nope', targets: ['a', 'zz'], text: 5 }, { id: 'b"ad' }] } },
      { v: 3, tab: 'setup', scriptId: 'trouble-brewing', bluff: { demonBluffs: [], plan: [] } }).bluff""")
    check(clean['demonBluffs'] == ['chef', 'monk', 'soldier'] and len(clean['plan']) == 1 and clean['plan'][0]['kind'] == 'said' and clean['plan'][0]['targets'] == ['a'], 'malformed bluff data is cleaned on load')
    old_save = page.evaluate("""() => Engine.sanitizeGame({ v: 2, players: [{ id: 'a', name: 'A' }], notes: [] }, { v: 3, tab: 'setup', scriptId: 'trouble-brewing' }).bluff""")
    check(old_save == {'demonBluffs': [], 'plan': []}, 'older saves gain an empty studio')
    page.evaluate("""() => { const s = window.__companion.state; s.players[1].name = '<img src=x onerror="window.__xss=9">'; s.players[1].claims = [{ char: 'chef', when: { kind: 'day', n: 1 } }]; }""")
    page.click('[data-tab="guide"]'); page.click('[data-tab="bluff"]'); page.wait_for_timeout(100)
    check(page.evaluate('window.__xss === undefined'), 'names cannot inject code into the studio')
    page.evaluate("""() => { const s = window.__companion.state; s.players[1].name = 'Ben'; }""")
    page.click('[data-tab="read"]')
    check(page.locator('[data-goto="bluff"]').is_visible(), 'evil Suspects tab links to the studio')
    page.click('[data-goto="bluff"]')
    for w, h in [(360, 780), (768, 1024), (1180, 820)]:
        page.set_viewport_size({'width': w, 'height': h}); page.wait_for_timeout(220)
        page.click('[data-tab="bluff"]')
        check(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'studio fits at {w}px')
        tab_ok = page.evaluate("""() => [...document.querySelectorAll('#tabs button')].every(b => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })""")
        check(tab_ok, f'six nav items keep 44px targets at {w}px')
    page.screenshot(path=str(SHOTS / '19-bluff-tablet.png'))
    page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(220)


    # ── Phase 6: coaching data ──
    data = page.evaluate("""() => {
      const fields = ['pitch', 'say', 'reveal', 'prep', 'risk'];
      const need = [];
      for (const id of ['trouble-brewing', 'bad-moon-rising', 'sects-violets'])
        SCRIPTS[id].characters.forEach(c => { if (['townsfolk', 'outsider'].includes(CHARACTERS[c].team) && !['drunk', 'lunatic'].includes(c)) need.push(c); });
      const evilNeed = [];
      for (const id of ['trouble-brewing', 'bad-moon-rising', 'sects-violets'])
        SCRIPTS[id].characters.forEach(c => { if (['minion', 'demon'].includes(CHARACTERS[c].team)) evilNeed.push(c); });
      const full = (e) => e && fields.every(f => f === 'say' ? Array.isArray(e.say) && e.say.length >= 1 && e.say.length <= 2 && e.say.every(x => typeof x === 'string' && x.trim()) : typeof e[f] === 'string' && e[f].trim().length > 10);
      const words = (e) => Math.max(...fields.filter(f => f !== 'say').map(f => e[f].split(/\\s+/).length));
      return { count: need.length, complete: need.filter(c => !full(BLUFF_COACH[c])), noDrunk: !('drunk' in BLUFF_COACH) && !('lunatic' in BLUFF_COACH),
        realKeys: Object.keys(BLUFF_COACH).filter(k => !CHARACTERS[k]), extra: Object.keys(BLUFF_COACH).filter(k => !need.includes(k)),
        evilMissing: evilNeed.filter(c => !EVIL_ROLE_COACH[c] || !EVIL_ROLE_COACH[c].length || EVIL_ROLE_COACH[c].length > 2 || EVIL_ROLE_COACH[c].some(t => !t.trim())),
        evilReal: Object.keys(EVIL_ROLE_COACH).filter(k => !CHARACTERS[k] || !['minion', 'demon'].includes(CHARACTERS[k].team)), evilCount: evilNeed.length,
        longest: Math.max(...need.map(c => words(BLUFF_COACH[c]))), basics: BLUFF_BASICS.length,
        teamKeys: Object.keys(TEAM_COACH).sort().join(),
        nullFor: ['drunk', 'lunatic', 'imp', 'baron'].map(c => Engine.coachFor(c, SCRIPTS['trouble-brewing']))
      };
    }""")
    check(data['count'] == 16 + 16 + 17 - 0 or data['count'] > 40, f"required bluffable characters counted ({data['count']})")
    check(data['complete'] == [], f"every required character has all five coaching fields (missing: {data['complete']})")
    check(data['noDrunk'], 'no coaching entry for Drunk or Lunatic')
    check(data['realKeys'] == [] and data['extra'] == [], f"every BLUFF_COACH key is a real, required character ({data['realKeys']} {data['extra']})")
    check(data['evilMissing'] == [] and data['evilReal'] == [] and data['evilCount'] == 21, f"every Minion and Demon has 1-2 evil coaching lines ({data['evilMissing']}, {data['evilCount']})")
    check(data['longest'] <= 30, f"coaching fields stay short (longest {data['longest']} words)")
    check(5 <= data['basics'] <= 7, 'bluffing basics has 5 to 7 principles')
    check(data['teamKeys'] == 'outsider,townsfolk' and data['nullFor'] == [None, None, None, None], 'team fallback exists and Drunk, Lunatic and evil characters have no bluff coaching')

    fb = page.evaluate("""() => {
      const sc = { name: 'Custom', characters: ['zz_seer', 'zz_once', 'zz_out', 'zz_evil'], custom: {
        zz_seer: { name: 'Seer <b>X</b>', team: 'townsfolk', ability: 'You start knowing a secret thing.' },
        zz_once: { name: 'Oncer', team: 'townsfolk', ability: 'Once per game, at night, do a thing.' },
        zz_out: { name: 'Odd Out', team: 'outsider', ability: 'Each night*, do a thing.' },
        zz_evil: { name: 'Bad One', team: 'minion', ability: 'Do evil.' } } };
      const a = Engine.coachFor('zz_seer', sc), b = Engine.coachFor('zz_once', sc), c = Engine.coachFor('zz_out', sc);
      return { a, b, c, evil: Engine.coachFor('zz_evil', sc), none: Engine.evilCoachFor('zz_evil'), real: Engine.coachFor('chef', sc).generic };
    }""")
    check(fb['a']['generic'] and 'Night 1 info' in fb['a']['prep'] and fb['b']['generic'] and 'one use' in fb['b']['prep'] and 'Night 2' in fb['c']['prep'] and 'Outsider' in fb['c']['risk'], 'a custom character gets general advice shaped by its ability wording')
    check(fb['evil'] is None and fb['none'] is None and fb['real'] is False, 'custom evil characters get no bluff advice; official ones keep their own entry')
    check('Seer <b>X</b>' in fb['a']['say'][0] and all(f in fb['a'] for f in ['pitch', 'say', 'reveal', 'prep', 'risk']), 'fallback has all five fields and does not invent specifics')

    # ── Phase 6: coachNow situations ──
    cn = page.evaluate("""() => {
      const sc = SCRIPTS['trouble-brewing'];
      const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, claims: [], dead: false, death: null, gut: 0, lock: '', notes: '' }));
      const game = (cover, build = () => {}, o = {}) => {
        const s = { players: mk(8), meId: 'p0', myChar: 'imp', myAlign: 'evil', knownEvil: ['p3'], knownDemon: null, phase: { kind: 'day', n: 1 },
          evidence: [], noms: [], notes: [], bluff: { demonBluffs: [], plan: [] }, gameOver: false, ...o };
        if (cover) s.players[0].claims = [{ char: cover, when: { kind: 'day', n: 1 } }];
        build(s); return s;
      };
      const kill = (s, i) => { s.players[i].dead = true; s.players[i].death = { how: 'night', when: { kind: 'night', n: 1 } }; };
      const run = (s) => Engine.coachNow(s, sc);
      const all = (s) => run(s).map(i => i.title + ' | ' + i.text).join('\\n');
      const out = {};
      out.noCoverN1 = all(game('', s => {}, { phase: { kind: 'night', n: 1 } }));
      out.noCoverD1 = all(game('', s => {}, { phase: { kind: 'day', n: 1 } }));
      out.noCoverD3 = all(game('', s => {}, { phase: { kind: 'day', n: 3 } }));
      out.noCoverBluffs = all(game('', s => { s.bluff.demonBluffs = ['monk']; }, { phase: { kind: 'night', n: 1 } }));
      out.noCoverGood = all(game('', s => {}, { myChar: 'empath', myAlign: 'good' }));
      out.prepMonk = all(game('monk', s => {}, { phase: { kind: 'day', n: 3 } }));
      out.prepChef = all(game('chef', s => {}, { phase: { kind: 'day', n: 2 } }));
      out.night1Chef = all(game('chef', s => {}, { phase: { kind: 'night', n: 1 } }));
      out.night1Monk = all(game('monk', s => {}, { phase: { kind: 'night', n: 1 } }));
      out.nightLater = all(game('empath', s => {}, { phase: { kind: 'night', n: 3 } }));
      out.team = all(game('chef', s => { s.players[3].claims = [{ char: 'chef', when: { kind: 'day', n: 1 } }]; }));
      out.rival = all(game('chef', s => { s.players[2].claims = [{ char: 'chef', when: { kind: 'day', n: 1 } }]; }));
      out.rivalBluff = all(game('monk', s => { s.bluff.demonBluffs = ['monk']; s.players[2].claims = [{ char: 'monk', when: { kind: 'day', n: 1 } }]; }));
      out.rivalGood = all(game('chef', s => { s.players[2].claims = [{ char: 'chef', when: { kind: 'day', n: 1 } }]; }, { myChar: 'empath', myAlign: 'good' }));
      out.offScript = all(game('clockmaker'));
      out.block = all(game('saint', s => { s.noms = [{ id: 'n1', day: 1, nominator: 'p2', nominee: 'p0', voters: [], votes: 4, executed: false }]; }));
      out.blockGood = all(game('chef', s => { s.noms = [{ id: 'n1', day: 1, nominator: 'p2', nominee: 'p0', voters: [], votes: 4, executed: false }]; }, { myChar: 'empath', myAlign: 'good' }));
      out.blockTruth = all(game('empath', s => { s.noms = [{ id: 'n1', day: 1, nominator: 'p2', nominee: 'p0', voters: [], votes: 4, executed: false }]; }, { myChar: 'empath', myAlign: 'good' }));
      out.nominated = all(game('chef', s => { s.noms = [{ id: 'n1', day: 1, nominator: 'p2', nominee: 'p0', voters: [], votes: 1, executed: false }]; }));
      out.otherNom = all(game('chef', s => { s.noms = [{ id: 'n1', day: 1, nominator: 'p2', nominee: 'p1', voters: [], votes: 5, executed: false }]; }));
      out.final4Evil = all(game('chef', s => { kill(s, 4); kill(s, 5); kill(s, 6); kill(s, 7); }, { phase: { kind: 'day', n: 3 } }));
      out.final4Good = all(game('chef', s => { kill(s, 4); kill(s, 5); kill(s, 6); kill(s, 7); }, { phase: { kind: 'day', n: 3 }, myChar: 'empath', myAlign: 'good' }));
      const f3 = (o, cover = 'chef') => game(cover, s => { for (let i = 3; i < 8; i++) kill(s, i); s.players[0].dead = false; }, { phase: { kind: 'day', n: 4 }, ...o });
      out.final3Evil = all(f3({ myChar: 'poisoner', knownEvil: ['p1'] }));
      out.final3Demon = all(f3({}));
      out.final3Mayor = all(f3({ knownEvil: ['p1'] }, 'mayor'));
      out.final3Good = all(f3({ myChar: 'empath', myAlign: 'good' }));
      out.final3Bluffer = all(f3({ myChar: 'empath', myAlign: 'good' }));
      out.final5 = all(game('chef', s => { kill(s, 5); kill(s, 6); kill(s, 7); }, { phase: { kind: 'day', n: 3 } }));
      out.dead = all(game('chef', s => { s.players[0].dead = true; s.players[0].death = { how: 'execution', when: { kind: 'day', n: 2 } }; }, { phase: { kind: 'night', n: 2 } }));
      out.deadSpent = all(game('chef', s => { s.players[0].dead = true; s.players[0].deadVoteUsed = true; s.players[0].death = { how: 'execution', when: { kind: 'day', n: 2 } }; }, { phase: { kind: 'night', n: 2 } }));
      out.evilGeneral = all(game('chef', s => {}, { myChar: 'poisoner', phase: { kind: 'day', n: 2 } }));
      out.demonGeneral = all(game('chef', s => {}, { phase: { kind: 'day', n: 2 } }));
      out.goodGeneral = all(game('chef', s => {}, { myChar: 'empath', myAlign: 'good', phase: { kind: 'day', n: 2 } }));
      out.scarlet4 = all(game('chef', s => { kill(s, 4); kill(s, 5); kill(s, 6); kill(s, 7); }, { phase: { kind: 'day', n: 3 }, myChar: 'scarletwoman' }));
      out.noSetup = Engine.coachNow({ players: [], phase: { kind: 'night', n: 1 }, bluff: { demonBluffs: [], plan: [] } }, sc);
      out.over = Engine.coachNow(game('chef', s => {}, { gameOver: true }), sc);
      const heavy = game('saint', s => {
        s.players[2].claims = [{ char: 'saint', when: { kind: 'day', n: 1 } }]; s.players[3].claims = [{ char: 'saint', when: { kind: 'day', n: 1 } }];
        s.players[0].claims = [{ char: 'chef', when: { kind: 'day', n: 1 } }, { char: 'saint', when: { kind: 'day', n: 2 } }];
        s.noms = [{ id: 'n1', day: 3, nominator: 'p2', nominee: 'p0', voters: [], votes: 4, executed: false }];
        s.bluff.plan = [{ id: 'a', when: { kind: 'night', n: 1 }, kind: 'learned', targets: [], char: '', text: 'x' }];
        for (let i = 4; i < 8; i++) kill(s, i);
      }, { phase: { kind: 'day', n: 3 } });
      out.heavyN = run(heavy).length;
      out.heavyTitles = run(heavy).map(i => i.title);
      out.shapes = [].concat(run(heavy), Engine.coachNow(game('chef'), sc)).every(i => ['bad', 'warn', 'info', 'good'].includes(i.level) && typeof i.title === 'string' && typeof i.text === 'string' && Object.keys(i).length === 3);
      out.maxLen = Math.max(...[heavy, game(''), game('monk')].map(g => run(g).length));
      const before = JSON.stringify(heavy); run(heavy); out.pure = before === JSON.stringify(heavy);
      return out;
    }""")
    has = lambda k, *needles: all(n in cn[k] for n in needles)
    check(has('noCoverN1', 'Pick a cover', 'before the first day'), 'coach: no cover on Night 1 says pick one before the first day talk')
    check(has('noCoverD1', 'Pick a cover', 'Day 1') and has('noCoverD3', 'Day 3'), 'coach: no cover on Day 1 and later days is situational')
    check(has('noCoverBluffs', "Demon's bluffs"), 'coach: no cover with Demon bluffs known points to them')
    check('Pick a cover' not in cn['noCoverGood'] and 'No claim yet' in cn['noCoverGood'], 'coach: a good player with no claim is not told to bluff')
    check(has('prepMonk', 'Prepare Night 2, Night 3', 'Monk', 'protected player'), 'coach: missing nights are named, with the cover role\'s preparation')
    check(has('prepChef', 'Prepare Night 1', 'Chef', 'number'), 'coach: Chef cover with no story needs Night 1 prepared')
    check(has('night1Chef', 'Before Day 1', 'Night 1') and has('night1Monk', 'Before Day 1', 'nothing you must report from Night 1'), 'coach: Night 1 differs by whether the cover has Night 1 info')
    check(has('nightLater', 'Plan tomorrow', 'Night 3'), 'coach: later nights ask you to plan the next story')
    check(has('team', 'Double claim with your teammate', 'P3', 'private'), 'coach: double claim with an evil teammate says settle it privately')
    check(has('rival', 'Double claim', 'could be the real one') and 'teammate' not in cn['rival'], 'coach: double claim with someone else is handled differently')
    check(has('rivalBluff', "Demon's bluffs", 'Drunk'), 'coach: a double claim on a Demon bluff mentions the Drunk caveat')
    check(has('rivalGood', 'Double claim', 'Give your details first') and 'Do not fight' not in cn['rivalGood'], 'coach: a good bluffer with a rival claimant gets good-side advice')
    check(has('offScript', 'Change your cover'), 'coach: a serious conflict gets an action, not only a warning')
    check(has('block', 'You are on the block', 'Saint', 'loses the game', 'teammate'), 'coach: on the block (evil, Saint cover)')
    check(has('blockGood', 'on the block', 'real role') and has('blockTruth', 'exactly what you learned'), 'coach: on the block for a good bluffer and a truthful good player')
    check(has('nominated', 'nominated today') and 'on the block' not in cn['nominated'], 'coach: nominated but not on the block')
    check('nominated today' not in cn['otherNom'] and 'on the block' not in cn['otherNom'], 'coach: someone else on the block does not trigger')
    check(has('final4Evil', '4 alive', 'Final 3', 'Demon') and has('final4Good', '4 alive', 'wrong execution'), 'coach: 4 alive differs for evil and good')
    check(has('final3Evil', 'Final 3', 'Keep the vote off your Demon') and has('final3Demon', 'Final 3', 'you win after the night kill') and has('final3Good', 'Final 3', 'Mayor', 'Do not skip the vote'), 'coach: Final 3 differs for a Minion, the Demon and a good player')
    check(has('final3Mayor', 'Mayor claim fits'), 'coach: a Mayor cover at Final 3 gets Mayor-specific advice')
    check(has('final3Bluffer', 'Come clean now') and 'Come clean now' not in cn['final3Evil'], 'coach: a good bluffer at Final 3 is told to come clean')
    check('4 alive' not in cn['final5'] and 'Final 3' not in cn['final5'], 'coach: no endgame advice at 5 alive')
    check(has('dead', 'You are dead', 'ghost vote', 'story straight') and has('deadSpent', 'already spent'), 'coach: dead players keep talking, have a ghost vote, and keep the story straight')
    check('Prepare' not in cn['dead'] and 'Plan tomorrow' not in cn['dead'], 'coach: a dead player is not asked to prepare nightly info')
    check(has('evilGeneral', 'Protect your Demon', 'same way as your team') and has('demonGeneral', 'stay low'), 'coach: evil players are told not to vote in lockstep')
    check(has('goodGeneral', 'Come clean on purpose', 'believed'), 'coach: a good bluffer is told why to bluff and when to come clean')
    check(has('scarlet4', 'Scarlet Woman', '5 or more'), 'coach: Scarlet Woman at 4 alive loses her backup')
    check(cn['noSetup'][0]['title'] == 'Set yourself up' and cn['over'][0]['title'] == 'Game over', 'coach: handles no setup and a finished game')
    check(cn['heavyN'] == 4 and cn['maxLen'] <= 4 and cn['shapes'] and cn['pure'], f"coach: at most 4 plain items, {{level,title,text}} only, and the state is not changed ({cn['heavyTitles']})")
    check(cn['heavyTitles'][0] == 'You are on the block', 'coach: the most urgent item comes first')

    # ── Phase 6: coaching in the UI ──
    seed2 = {'v': 3, 'players': [{'id': f'p{i}', 'name': n, 'claims': []} for i, n in enumerate(NAMES)], 'meId': 'p0', 'myChar': 'imp', 'myAlign': 'evil',
             'knownEvil': ['p3'], 'phase': {'kind': 'day', 'n': 1}, 'evidence': [], 'noms': [], 'notes': [], 'tab': 'bluff',
             'bluff': {'demonBluffs': ['soldier', 'chef', 'monk'], 'plan': []}}
    seed2['players'][0]['claims'] = [{'char': 'monk', 'when': {'kind': 'day', 'n': 1}}]
    page.set_viewport_size({'width': 390, 'height': 844})
    page.evaluate("(s) => localStorage.setItem('botc-companion-v1', JSON.stringify(s))", seed2); page.reload()
    view = lambda: page.locator('#view').inner_text()
    check(page.locator('#coach-card').is_visible() and 'What to do now' in page.locator('#coach-card').inner_text(), 'studio shows the Coach card')
    order = page.evaluate("[...document.querySelectorAll('#view > .card')].map(c => c.id || (c.querySelector('h2,h3') || {}).textContent)")
    check(order[0] == 'Bluff Studio' and order[1] == 'coach-card' and order[2] == 'how-card', f'coach sits under the identity card, then the bluff panel ({order[:3]})')
    check(1 <= page.locator('#coach-card .tip.coach').count() <= 4, 'coach card lists 1 to 4 items')
    how = page.locator('#how-card')
    check('Monk' in how.locator('h3').inner_text() and page.locator('#how-card .say-line').count() >= 1, 'the how-to panel is for the current cover and shows say lines')
    lbls = how.locator('.lbl').all_inner_texts()
    check([l.lower() for l in lbls] == ['say', 'reveal', 'prepare', 'risk'], f'how-to panel has say / reveal / prepare / risk labels ({lbls})')
    check('Protected' in how.inner_text() or 'protected' in how.inner_text(), 'the how-to panel carries the Monk text')
    check(page.locator('.evil-note').count() == 1 and 'Night 2 on' in page.locator('.evil-note').inner_text(), 'an evil player sees their evil-role note')
    n_opts = page.locator('.bluff-opt').count()
    check(page.locator('.bluff-opt details.coach-x').count() == n_opts and n_opts >= 5, 'every ranked bluff has a Coaching expander')
    check(page.locator('.bluff-opt details.coach-x[open]').count() == 0, 'coaching expanders start collapsed')
    page.locator('details.pick-off > summary').first.click()
    check(page.locator('.bluff-opt details.coach-x').count() > 5 and page.locator('details.rule.flat:not([open])').count() == 1, 'all other bluffs are coached too, and Bluffing basics is collapsed')
    page.locator('details.rule.flat > summary').click()
    check(5 <= page.locator('.basics li').count() <= 7 and page.locator('.basics').is_visible(), 'Bluffing basics opens with 5 to 7 principles')
    page.locator('.bluff-opt details.coach-x > summary').first.click()
    exp_text = page.locator('.bluff-opt details.coach-x[open]').first.inner_text()
    check('Why:' in exp_text and 'Watch for:' in exp_text, 'an opened Coaching expander shows the pitch and the risk')

    snap = lambda: page.evaluate("(() => { const s = JSON.parse(JSON.stringify(window.__companion.state)); delete s.tab; return JSON.stringify(s); })()")
    saved = lambda: page.evaluate("(() => { const s = JSON.parse(localStorage.getItem('botc-companion-v1')); delete s.tab; return JSON.stringify(s); })()")
    state0, saved0, depth0 = snap(), saved(), page.evaluate('window.__companion.undoDepth')
    page.click('[data-tab="guide"]'); page.click('[data-tab="bluff"]')
    check(page.locator('.bluff-opt details.coach-x[open]').count() == 1 and page.locator('.basics').is_visible(), 'open expanders survive a re-render')
    page.locator('.bluff-opt details.coach-x > summary').nth(1).click(); page.locator('.bluff-opt details.coach-x > summary').nth(1).click()
    check(snap() == state0 and saved() == saved0 and page.evaluate('window.__companion.undoDepth') == depth0, 'opening and closing coaching changes neither state, saved game nor undo depth')
    check('coach' not in state0.lower() and 'pitch' not in state0 and 'say-line' not in saved0, 'coaching adds nothing to the saved game')
    check(page.locator('.toast').count() == 0, 'expanders raise no toast')

    # names are escaped
    page.evaluate("""() => { const s = window.__companion.state; s.players[2].name = '<img src=x onerror="window.__xss2=1">'; s.players[2].claims = [{ char: 'monk', when: { kind: 'day', n: 1 } }]; }""")
    page.click('[data-tab="guide"]'); page.click('[data-tab="bluff"]'); page.wait_for_timeout(100)
    check(page.evaluate('window.__xss2 === undefined') and page.locator('#coach-card img, #how-card img').count() == 0 and '<img' in page.locator('#coach-card').inner_text(), 'names in coaching are escaped')
    page.evaluate("""() => { const s = window.__companion.state; s.players[2].name = 'Cat'; s.players[2].claims = []; }""")

    # Town and Suspects stay free of coaching
    for tab in ['town', 'read']:
        page.click(f'[data-tab="{tab}"]'); page.wait_for_timeout(80)
        body = page.locator('body').inner_text().lower()
        free = not any(w in body for w in ['what to do now', 'how to play this bluff', 'how to bluff', 'bluffing basics', 'coaching']) and page.locator('.say-line, .coach-x').count() == 0
        check(free, f'{tab} tab shows no coaching')
    page.click('[data-tab="bluff"]')

    # Guide: neutral reference, same for every good character
    page.click('[data-tab="guide"]')
    g = page.evaluate("""() => ({ n: document.querySelectorAll('details.coach-x.in-guide').length, good: [...document.querySelectorAll('details.char')].filter(d => d.querySelector('.team-townsfolk, .team-outsider')).length,
      evil: [...document.querySelectorAll('details.char')].filter(d => d.querySelector('.team-minion, .team-demon') && d.querySelector('.coach-x')).length,
      label: document.querySelector('details.coach-x.in-guide > summary').textContent, mineOpen: document.querySelectorAll('details.coach-x.in-guide[open]').length })""")
    check(g['n'] == 16 and g['evil'] == 0 and g['label'] == 'How to bluff this' and g['mineOpen'] == 0, f"Guide has a collapsed 'How to bluff this' on each bluffable good character only ({g})")
    page.locator('details.char:has(.team-townsfolk) summary').first.click()
    page.locator('details.coach-x.in-guide > summary').first.click()
    gtxt = page.locator('details.coach-x.in-guide[open]').first.inner_text().lower()
    check(all(w in gtxt for w in ['say', 'reveal', 'prepare', 'risk']) and page.locator('details.char .say-line:visible').count() >= 1, 'Guide expander shows the say / reveal / prepare / risk text')
    check(page.locator('mark, .mine-cover, .your-cover').count() == 0, 'Guide does not highlight your cover')
    # Guide with a good player's own character does not differ for the cover
    page.click('[data-tab="bluff"]')

    # Layout and touch targets
    for w, h, tag in [(360, 780, 'phone'), (390, 844, 'phone'), (768, 1024, 'tablet'), (820, 1180, 'tablet'), (1024, 768, 'tablet'), (1180, 820, 'tablet')]:
        page.set_viewport_size({'width': w, 'height': h}); page.wait_for_timeout(220)
        page.click('[data-tab="bluff"]')
        check(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'studio with coaching fits at {w}px')
        small = page.evaluate("""() => [...document.querySelectorAll('#view details.coach-x > summary, #view details.rule.flat > summary')].filter(e => e.getBoundingClientRect().height < 43.5).length""")
        check(small == 0, f'coaching expanders keep 44px targets at {w}px')
        over = page.evaluate("""() => [...document.querySelectorAll('#coach-card *, #how-card *, .bluff-opt *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).length""")
        check(over == 0, f'no coaching element overflows at {w}px')
        if w == 360:
            page.screenshot(path=str(SHOTS / '20-coach-phone-360.png'), full_page=True)
        if (w, h) == (390, 844):
            page.screenshot(path=str(SHOTS / '20-coach-phone.png'))
            page.screenshot(path=str(SHOTS / '21-coach-phone-full.png'), full_page=True)
        if w == 768:
            page.screenshot(path=str(SHOTS / '22-coach-tablet.png'), full_page=True)
    page.click('[data-tab="guide"]')
    for w, h in [(360, 780), (768, 1024), (1180, 820)]:
        page.set_viewport_size({'width': w, 'height': h}); page.wait_for_timeout(200)
        check(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'guide with coaching fits at {w}px')
    page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(200)
    page.click('[data-tab="bluff"]')

    # Offline bundle and cache
    sw = page.evaluate("fetch('sw.js').then(r => r.text())")
    check("clocktower-companion-v10" in sw and "js/coach.js" in sw, 'service worker caches coach.js under the current cache')
    check(page.evaluate("document.querySelector('script[src=\"js/coach.js\"]') !== null && [...document.scripts].map(s => s.getAttribute('src')).indexOf('js/coach.js') < [...document.scripts].map(s => s.getAttribute('src')).indexOf('js/engine.js')"), 'coach.js loads before engine.js')

    # ── Endgame coaching follows the win condition ──
    endgame = page.evaluate("""() => {
      const sc = SCRIPTS['trouble-brewing'];
      const game = (alive, kind, myChar, myAlign) => {
        const players = Array.from({ length: 8 }, (_, i) => ({ id: 'e' + i, name: 'E' + i, claims: [], dead: i >= alive, death: i >= alive ? { how: 'night', when: { kind: 'night', n: 1 } } : null, gut: 0, lock: '', notes: '' }));
        players[0].claims = [{ char: 'soldier', when: { kind: 'day', n: 1 } }];
        return { players, meId: 'e0', myChar, myAlign, knownEvil: [], knownDemon: null, phase: { kind, n: 4 }, evidence: [], noms: [], notes: [], bluff: { demonBluffs: [], plan: [] } };
      };
      const text = (s, title) => (Engine.coachNow(s, sc).find(i => i.title === title) || {}).text || '';
      return {
        fourDayGood: text(game(4, 'day', 'chef', 'good'), '4 alive'), fourDayEvil: text(game(4, 'day', 'imp', 'evil'), '4 alive'),
        fourNight: text(game(4, 'night', 'chef', 'good'), '4 alive'), threeDay: text(game(3, 'day', 'chef', 'good'), 'Final 3'), threeNight: text(game(3, 'night', 'chef', 'good'), 'Final 3'),
        oldTip: Engine.tips(game(4, 'day', 'chef', 'good'), sc, null).map(t => t.text).find(t => t.includes('4 players alive')),
        mutant: Engine.coachFor('mutant', SCRIPTS['sects-violets']).risk,
      };
    }""")
    check("tonight's kill ends the game" in endgame['fourDayGood'], 'at 4 alive, good is told a wrong execution loses to the night kill')
    check("tonight's kill wins" in endgame['fourDayEvil'], 'at 4 alive, evil is told a missed execution wins the game')
    check("tomorrow's execution decides" in endgame['fourNight'], 'a night at 4 alive leads to a deciding execution')
    check('wrong player ends the game' in endgame['threeDay'], 'Final 3 warns about a wrong execution')
    check('only 2 players remain' in endgame['threeNight'] and 'today' not in endgame['threeNight'], 'a night at 3 alive explains the kill ends the game')
    check("tonight's kill can end the game" in endgame['oldTip'], 'the Suspects tip gives the same 4-alive rule')
    check('avoids admitting' in endgame['mutant'], 'Mutant coaching follows the madness rule')

    day1 = page.evaluate("""() => {
      const sc = SCRIPTS['trouble-brewing'];
      const game = (cover) => ({ players: Array.from({ length: 8 }, (_, i) => ({ id: 'd' + i, name: 'D' + i, claims: i ? [] : [{ char: cover, when: { kind: 'day', n: 1 } }], dead: false, death: null, gut: 0, lock: '', notes: '' })),
        meId: 'd0', myChar: 'imp', myAlign: 'evil', knownEvil: [], knownDemon: null, phase: { kind: 'day', n: 1 }, evidence: [], noms: [], notes: [], bluff: { demonBluffs: [], plan: [] } });
      const text = (c) => (Engine.coachNow(game(c), sc).find(i => i.title === 'Day 1 talk') || {}).text || '';
      return { monk: text('monk'), chef: text('chef') };
    }""")
    check('does not act on Night 1' in day1['monk'], 'Day 1 coaching stops a Monk claiming a Night 1 action')
    check('does not act' not in day1['chef'] and day1['chef'] != '', 'Day 1 coaching leaves Night 1 roles alone')

    # ── Smarter liar-finder ──
    solver = page.evaluate("""() => {
      const TB = SCRIPTS['trouble-brewing'], SV = SCRIPTS['sects-violets'];
      const mk = (n = 8) => Array.from({ length: n }, (_, i) => ({ id: 's' + i, name: 'S' + i, traveller: false, claims: [], dead: false, death: null, deadVoteUsed: false, gut: 0, lock: '', notes: '' }));
      const game = (build = () => {}, n = 8) => { const s = { players: mk(n), meId: 's0', myChar: 'chef', myAlign: 'good', knownEvil: [], knownDemon: null, evilOverride: null,
        phase: { kind: 'day', n: 3 }, evidence: [], noms: [], notes: [], bluff: { demonBluffs: [], plan: [] }, gameOver: false }; build(s); return s; };
      const claim = (s, i, c, n = 1) => s.players[i].claims.push({ char: c, when: { kind: 'night', n } });
      const kill = (s, i, how, kind, n) => { s.players[i].dead = true; s.players[i].death = { how, when: { kind, n } }; };
      const align = (src, target, evil, k = 1) => ({ id: `a${src}_${target}_${k}`, source: 's' + src, type: 'align', template: 'align', players: ['s' + target], evil, n: 0, when: { kind: 'night', n: k }, char: '', yes: false, same: false, day: 1, text: '' });
      const ft = (src, a, b, yes, k) => ({ id: `f${src}_${k}`, source: src === 'st' ? 'st' : 's' + src, type: 'ft', template: 'fortune', players: ['s' + a, 's' + b], yes, n: 0, when: { kind: 'night', n: k }, char: '', same: false, evil: false, day: 1, text: '' });
      const E = (s, sc = TB) => Engine.analyze(s, sc);
      const out = {};

      // One unreliable story counts once, not once per clue.
      const lied = (k) => game(s => { for (let j = 1; j <= k; j++) { s.evidence.push(align(1, 1 + j, true, j)); s.evidence.push(align(0, 1 + j, false, j)); } });
      out.drunkOne = E(lied(1)).players.s1.evil; out.drunkThree = E(lied(3)).players.s1.evil;
      const noDroison = { ...TB, characters: TB.characters.filter(c => !['drunk', 'poisoner'].includes(c)) };
      out.cleanScript = E(lied(1), noDroison).players.s1.evil;

      // The Demon can change hands.
      const pass = game(s => { kill(s, 1, 'night', 'night', 2); s.players[1].lock = 'demon'; s.players[2].lock = 'evil'; });
      out.passDead = E(pass).players.s1.demon; out.passHeir = E(pass).players.s2.demon;
      const stale = (n) => E(game(s => { kill(s, 1, 'night', 'night', 2); s.evidence.push(ft('st', 1, 3, false, n)); })).players.s1.evil;
      out.staleBefore = stale(1); out.staleAfter = stale(3);

      // Executions: a Scarlet Woman only carries on with 5 or more alive.
      const executed = (deadBefore) => game(s => { for (let i = 0; i < deadBefore; i++) kill(s, 7 - i, 'night', 'night', 1); kill(s, 1, 'execution', 'day', 2); });
      const noSW = { ...TB, characters: TB.characters.filter(c => c !== 'scarletwoman') };
      out.swManyWith = E(executed(0)).players.s1.evil; out.swManyWithout = E(executed(0), noSW).players.s1.evil;
      out.swFewWith = E(executed(4)).players.s1.evil; out.swFewWithout = E(executed(4), noSW).players.s1.evil;

      // Vortox.
      const vx = (build) => E(game(s => { s.phase = { kind: 'day', n: 1 }; build(s); }), SV);
      out.vortoxPrior = vx(() => {}).vortox;
      out.tbNoVortox = E(game()).vortox;
      out.quietDay = E(game(s => { kill(s, 1, 'execution', 'day', 1); }), SV).vortox;
      out.executedDays = E(game(s => { kill(s, 1, 'execution', 'day', 1); kill(s, 2, 'execution', 'day', 2); }), SV).vortox;
      out.iAmVortox = E(game(s => { s.myChar = 'vortox'; s.myAlign = 'evil'; s.knownEvil = ['s1']; s.phase = { kind: 'day', n: 1 }; }), SV).vortox;
      out.iAmNoDashii = E(game(s => { s.myChar = 'nodashii'; s.myAlign = 'evil'; s.knownEvil = ['s1']; s.phase = { kind: 'day', n: 1 }; }), SV).vortox;
      const contradictory = vx(s => { s.myChar = 'empath'; claim(s, 1, 'empath'); claim(s, 2, 'chef'); claim(s, 3, 'oracle');
        [[0, 4], [1, 4], [2, 4], [3, 4]].forEach(([a, b], k) => { s.evidence.push(align(a, b, false, k + 1)); s.evidence.push(align(a, b, true, k + 11)); }); });
      out.falseInfoRaisesVortox = (() => { const base = vx(() => {}).vortox;
        const r = vx(s => { claim(s, 1, 'clockmaker'); claim(s, 2, 'dreamer'); s.myChar = 'seamstress'; s.players[4].lock = 'good';
          s.evidence.push(align(0, 4, true, 1), align(1, 4, true, 2), align(2, 4, true, 3)); });
        return r.vortox > base; })();

      // Claims.
      const changed = E(game(s => { claim(s, 1, 'monk', 1); claim(s, 1, 'chef', 2); }));
      out.changedUp = changed.players.s1.evil; out.changedPrior = changed.prior;
      out.changedReason = changed.players.s1.reasons.some(r => /changed their claim/.test(r.label));
      const note = (player, kind, whenKind, n, targets = [], story = 'public') => ({ id: `n${player}${n}${kind}`, player: 's' + player, when: { kind: whenKind, n }, kind, targets: targets.map(x => 's' + x), char: '', text: 'x', story });
      const monk = E(game(s => { claim(s, 1, 'monk'); kill(s, 2, 'night', 'night', 2); s.notes.push(note(1, 'did', 'night', 2, [2])); }));
      out.monkBroken = monk.players.s1.evil; out.monkReason = monk.players.s1.reasons.some(r => /does not fit/.test(r.label));
      const fine = E(game(s => { claim(s, 1, 'monk'); kill(s, 2, 'night', 'night', 2); s.notes.push(note(1, 'did', 'night', 2, [3])); }));
      out.monkFine = fine.players.s1.evil;

      // Your bluff and private notes never move the numbers.
      const clean = E(game(s => { s.evidence.push(align(0, 1, true)); })).players;
      const withBluff = E(game(s => { s.evidence.push(align(0, 1, true)); claim(s, 0, 'monk'); claim(s, 0, 'soldier', 2); s.notes.push(note(0, 'did', 'night', 1, [3])); s.notes.push(note(0, 'learned', 'night', 2, [4], 'true'));
        s.bluff = { demonBluffs: [], plan: [note(0, 'did', 'night', 2, [5])] }; })).players;
      out.bluffNeutral = Object.keys(clean).every(k => Math.abs(clean[k].evil - withBluff[k].evil) < 1e-9 && Math.abs(clean[k].demon - withBluff[k].demon) < 1e-9);

      // Probabilities stay valid, and the largest game runs.
      const sum = (r, k) => Object.values(r.players).reduce((a, p) => a + p[k], 0);
      const busy = E(game(s => { kill(s, 1, 'night', 'night', 2); kill(s, 2, 'execution', 'day', 2); claim(s, 3, 'monk'); s.evidence.push(align(0, 4, true), ft(5, 6, 7, true, 2)); }));
      out.demonSum = sum(busy, 'demon'); out.evilSum = sum(busy, 'evil'); out.evilCount = busy.evilCount;
      const t0 = performance.now();
      const huge = E(game(s => { s.evilOverride = 8; s.phase = { kind: 'day', n: 1 }; for (let i = 1; i < 15; i++) { s.evidence.push(align(i, (i + 1) % 15, i % 2 === 0, 1)); claim(s, i, SV.characters[i % SV.characters.length]); } }, 15), SV);
      out.hugeWorlds = huge.worldCount; out.hugeMs = performance.now() - t0; out.hugeOk = !huge.error;
      return out;
    }""")
    check(solver['drunkThree'] < 0.9, f"three false clues from one person can still be one drunk player ({solver['drunkThree']:.2f})")
    check(solver['cleanScript'] > solver['drunkOne'], 'false info counts for more on a script with no drunkenness or poison')
    check(solver['passDead'] < 0.01 and solver['passHeir'] > 0.99, 'a dead Demon passes to a living teammate')
    check(solver['staleAfter'] > solver['staleBefore'], 'a Demon clue applies before that player died, not after')
    check(solver['swManyWith'] > solver['swManyWithout'] and abs(solver['swFewWith'] - solver['swFewWithout']) < 1e-9, 'a Scarlet Woman makes an executed Demon more plausible only at 5+ alive')
    check(abs(solver['vortoxPrior'] - 0.25) < 0.01, 'Vortox starts as one of the four S&V Demons')
    check(solver['tbNoVortox'] is None, 'scripts without a Vortox show no Vortox chance')
    check(solver['quietDay'] == 0, 'a day with no execution rules out the Vortox')
    check(solver['executedDays'] > 0, 'executions every day keep the Vortox possible')
    check(solver['iAmVortox'] == 1 and solver['iAmNoDashii'] == 0, 'a Demon knows whether it is the Vortox')
    check(solver['falseInfoRaisesVortox'], 'Townsfolk info that looks false raises the Vortox chance')
    check(solver['changedUp'] > solver['changedPrior'] and solver['changedReason'], 'changing a claim raises suspicion and explains why')
    check(solver['monkBroken'] > solver['monkFine'] and solver['monkReason'], 'a story that breaks its role raises suspicion and explains why')
    check(solver['bluffNeutral'], 'your bluff, plan and private notes never move the percentages')
    check(abs(solver['demonSum'] - 1) < 1e-6 and abs(solver['evilSum'] - solver['evilCount']) < 1e-6, 'Demon and evil percentages stay valid')
    check(solver['hugeOk'] and solver['hugeWorlds'] > 40000, f"the largest game runs ({solver['hugeWorlds']} worlds)")
    check(solver['hugeMs'] < 15000, f"the largest game finishes in reasonable time ({solver['hugeMs']:.0f} ms)")
    page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(220)
    seed = {'v': 3, 'scriptId': 'sects-violets', 'players': [{'id': f'p{i}', 'name': n, 'claims': []} for i, n in enumerate(NAMES)], 'meId': 'p0', 'myChar': 'clockmaker', 'myAlign': 'good',
            'phase': {'kind': 'day', 'n': 1}, 'evidence': [], 'noms': [], 'notes': [], 'tab': 'read'}
    page.evaluate("(s) => localStorage.setItem('botc-companion-v1', JSON.stringify(s))", seed); page.reload()
    check('Vortox chance: 25%' in page.locator('#view').inner_text(), 'Suspects shows the Vortox chance')
    check('Most likely evil teams' not in page.locator('#view').inner_text(), 'no team is named before there are any clues')
    page.click('details.rule > summary')
    check('star-pass' in page.locator('details.rule').first.inner_text(), 'the explanation covers the new rules')
    page.screenshot(path=str(SHOTS / '23-suspects-phone.png'))

    # ── Launch review fixes ──
    seed = {'v': 3, 'players': [{'id': f'p{i}', 'name': n, 'claims': []} for i, n in enumerate(NAMES)], 'meId': 'p0', 'myChar': 'imp', 'myAlign': 'evil',
            'knownEvil': ['p3'], 'phase': {'kind': 'day', 'n': 1}, 'evidence': [], 'noms': [], 'notes': [], 'tab': 'town'}
    page.wait_for_timeout(220)
    page.evaluate("(s) => localStorage.setItem('botc-companion-v1', JSON.stringify(s))", seed)
    for w, h in [(844, 390), (667, 375)]:
        page.set_viewport_size({'width': w, 'height': h}); page.reload(); page.wait_for_timeout(250)
        fit = page.evaluate("""() => { scrollTo(0, 0); return [...document.querySelectorAll('.token .disc')].every(d => { const r = d.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }); }""")
        check(fit, f'every seat fits on screen in phone landscape at {w}x{h}')
    page.set_viewport_size({'width': 1180, 'height': 820}); page.wait_for_timeout(250)
    page.click('[data-tab="bluff"]'); page.click('#town-pane .token[data-pid="p1"]'); page.wait_for_timeout(320)
    check(page.locator('[id="claim-btn"]').count() == 1, 'the Bluff tab and a player sheet do not share a control id')
    page.click('.sheet #claim-btn'); page.wait_for_selector('#picker:not([hidden])'); page.keyboard.press('Escape'); page.wait_for_selector('#picker', state='hidden')
    check(page.evaluate("document.activeElement.id === 'claim-btn' && !!document.activeElement.closest('#sheet')"), 'closing the picker returns focus inside the open sheet')
    page.click('[data-act="close-sheet"]')
    page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(220)

    check(not errors, f'no console errors {errors}')
    print('\n── Launch-readiness checks ──')
    launch_checks.run(browser, LAUNCH)
    print('numbers:', json.dumps(LAUNCH.numbers))
    browser.close()

httpd.shutdown()
print(f'\n{"ALL PASSED" if not failures else str(len(failures)) + " FAILED"}')
sys.exit(1 if failures else 0)
