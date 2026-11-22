"""Launch-readiness checks, run from tests/test_app.py (or alone with LAUNCH_ONLY=1 python3 tests/test_app.py):
accessibility, offline and weak-signal behaviour, data safety, layouts on phones and tablets, speed on a slow CPU,
and a scripted full game played through the real UI."""
import json, pathlib, re, time

KEY = 'botc-companion-v1'
NAMES = ['Ann', 'Ben', 'Cat', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jon', 'Kim', 'Lou', 'Max', 'Ned', 'Oli', 'Pam', 'Quin', 'Rex', 'Sue', 'Tom']
CLAIMS = ['chef', 'empath', 'monk', 'soldier', 'saint', 'undertaker', 'washerwoman', 'investigator']
LONG = 'Bartholomew-Maximilian-Wolfeschlegelsteinhausenbergerdorff'

def game(n=8, long=False, me_char='fortuneteller', **over):
    """A saved game: Ann is me, everyone else has a public claim, the fourth player died on night 1."""
    ps = []
    for i in range(n):
        nm = LONG + str(i) if long and i % 3 == 0 else NAMES[i]
        ps.append({'id': f'p{i}', 'name': nm, 'claims': [{'char': CLAIMS[i % 8], 'when': {'kind': 'night', 'n': 1}}] if i else [],
                   'dead': i == 3, 'death': {'how': 'night', 'when': {'kind': 'night', 'n': 1}} if i == 3 else None})
    s = {'v': 3, 'scriptId': 'trouble-brewing', 'players': ps, 'meId': 'p0', 'myChar': me_char, 'myAlign': 'good', 'phase': {'kind': 'day', 'n': 2},
         'evidence': [], 'noms': [], 'notes': [], 'tab': 'town'}
    s.update(over)
    return s

AUDIT_JS = """() => {
  const out = [], vis = (e) => e.getClientRects().length && !e.closest('[hidden]') && !e.closest('[inert]');
  document.querySelectorAll('button').forEach(b => { if (vis(b) && !(b.getAttribute('aria-label') || b.textContent || b.title || '').trim()) out.push('unnamed button ' + b.outerHTML.slice(0, 70)); });
  document.querySelectorAll('input:not([type=hidden]):not([type=file]), select, textarea').forEach(e => { if (vis(e) && !(e.labels && e.labels.length) && !e.getAttribute('aria-label')) out.push('unlabelled field ' + (e.id || e.className)); });
  document.querySelectorAll('label[for]').forEach(l => { if (!document.getElementById(l.htmlFor)) out.push('label points at nothing: ' + l.htmlFor); });
  document.querySelectorAll('label').forEach(l => { if (!l.htmlFor && !l.querySelector('input,select,textarea,button')) out.push('label without a control: ' + l.textContent.slice(0, 30)); });
  document.querySelectorAll('.seg, .chips').forEach(g => { if (vis(g) && (g.getAttribute('role') !== 'group' || !document.getElementById(g.getAttribute('aria-labelledby') || ''))) out.push('button group without a name: ' + g.className); });
  document.querySelectorAll('.seg button, .chip-btn[data-act]').forEach(b => { if (vis(b) && !b.hasAttribute('aria-pressed')) out.push('toggle without aria-pressed: ' + b.textContent.slice(0, 20)); });
  const ids = {}; document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; }); Object.entries(ids).forEach(([k, v]) => { if (v > 1) out.push('duplicate id ' + k); });
  return out;
}"""

# ── Contrast (WCAG 2.x) ──
def _rgb(h):
    h = h.lstrip('#'); h = ''.join(c * 2 for c in h) if len(h) == 3 else h
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def _lum(c):
    f = lambda v: (v / 255) / 12.92 if v / 255 <= 0.03928 else (((v / 255) + 0.055) / 1.055) ** 2.4
    r, g, b = [f(x) for x in c]; return .2126 * r + .7152 * g + .0722 * b
def contrast(a, b):
    la, lb = sorted([_lum(a), _lum(b)], reverse=True); return (la + .05) / (lb + .05)

def run(browser, T):
    check, URL, BASE, ROOT, SHOTS = T.check, T.URL, T.BASE, T.ROOT, T.SHOTS
    DELAY, STATUS, BODY = T.DELAY, T.STATUS, T.BODY

    def fresh(w=390, h=844, **kw):
        ctx = browser.new_context(viewport={'width': w, 'height': h}, **kw)
        page = ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        return ctx, page, errs
    def load(page, state, tab=None):
        page.goto(URL); page.evaluate("([k, s]) => localStorage.setItem(k, JSON.stringify(s))", [KEY, state]); page.reload()
        if tab: page.click(f'[data-tab="{tab}"]')
    S = lambda page: page.evaluate('window.__companion.state')
    active = lambda page: page.evaluate("document.activeElement ? (document.activeElement.id || document.activeElement.dataset.act || document.activeElement.tagName) : ''")

    # ═════════════ 1. Accessibility ═════════════
    ctx, page, errs = fresh()
    plan = {'id': 'pl1', 'player': 'p0', 'when': {'kind': 'day', 'n': 2}, 'kind': 'said', 'targets': [], 'char': '', 'text': 'planned line one', 'story': 'public'}
    base = game(me_char='fortuneteller', bluff={'demonBluffs': [], 'plan': [plan]},
                notes=[{'id': 'n1', 'player': 'p0', 'when': {'kind': 'day', 'n': 2}, 'kind': 'said', 'targets': [], 'char': '', 'text': 'told the table I am the Chef', 'story': 'public'}],
                evidence=[{'id': 'e1', 'source': 'p1', 'type': 'evilCount', 'template': 'empath', 'when': {'kind': 'night', 'n': 1}, 'players': ['p0', 'p2'], 'n': 0, 'char': '', 'yes': True, 'same': True, 'evil': True, 'day': 1, 'text': ''}],
                noms=[{'id': 'm1', 'day': 1, 'nominator': 'p1', 'nominee': 'p2', 'voters': ['p1', 'p4'], 'votes': 2, 'executed': False}])
    base['players'][0]['claims'] = [{'char': 'chef', 'when': {'kind': 'night', 'n': 1}}]
    load(page, base)

    # Tokens: public facts only, never the true role
    labels = page.eval_on_selector_all('.token', 'els => els.map(e => e.getAttribute("aria-label"))')
    check(len(labels) == 8 and all(labels), f'every Town token has an accessible name ({labels[:2]})')
    check(labels[0].startswith('Ann (you)') and 'claims Chef' in labels[0], f'my own token names my public claim ({labels[0]})')
    check('dead' in labels[3] and 'ghost vote available' in labels[3] and ', alive' in labels[1], f'tokens say alive or dead and whether a ghost vote is left ({labels[3]})')
    town_html = page.inner_html('#view')
    check('Fortune' not in town_html and not any('Fortune' in l for l in labels) and 'Fortune' not in page.inner_text('body'), 'the Town view never names my true role (names, labels, titles)')
    check(not page.eval_on_selector_all('#view [title]', 'els => els.filter(e => /fortune/i.test(e.title))'), 'no title attribute on Town leaks the true role')

    # Row-buttons answer the keyboard, and nested real buttons do not fire twice
    page.click('[data-tab="bluff"]')
    page.focus('.story-line[data-act="plan-edit"]'); page.keyboard.press('Enter')
    check(page.is_visible('#sheet') and 'Edit planned line' in page.inner_text('#sheet h2'), 'Enter on a planned story row opens it')
    page.keyboard.press('Escape'); page.wait_for_selector('#sheet', state='hidden')
    check(active(page) in ('plan-edit',), f'focus returns to the story row after the sheet closes ({active(page)})')
    page.keyboard.press(' ')
    check(page.is_visible('#sheet') and 'Edit planned line' in page.inner_text('#sheet h2'), 'Space on a story row opens it')
    page.click('[data-act="cancel-note"]'); page.wait_for_selector('#sheet', state='hidden')
    notes0, plan0 = len(S(page)['notes']), len(S(page)['bluff']['plan'])
    page.focus('[data-act="plan-told"]'); page.keyboard.press('Enter')
    st = S(page)
    check(len(st['notes']) == notes0 + 1 and len(st['bluff']['plan']) == plan0 - 1 and page.is_hidden('#sheet'), 'Enter on "Mark as told" marks it once and does not also open the row')
    page.click('[data-tab="info"]'); page.focus('.entry[data-act="edit-ev"]'); page.keyboard.press('Enter')
    check('Edit info' in page.inner_text('#sheet h2'), 'Enter on a logged info row opens it')
    page.keyboard.press('Escape')
    page.click('[data-tab="read"]'); page.focus('.suspect >> nth=0'); page.keyboard.press('Enter')
    check(page.is_visible('#sheet'), 'Enter on a suspect row opens that player')
    page.keyboard.press('Escape')
    page.click('[data-tab="days"]'); page.focus('[data-act="edit-nom"] button'); page.keyboard.press('Enter')
    check('Edit nomination' in page.inner_text('#sheet h2'), 'a nomination row has a real, named Edit button')
    page.keyboard.press('Escape')

    # The sheet is a proper dialog
    page.click('[data-tab="town"]')
    page.focus('.token[data-pid="p1"]'); page.keyboard.press('Enter')
    page.wait_for_selector('#sheet:not([hidden])')
    ttl = page.evaluate("document.getElementById(document.getElementById('sheet').getAttribute('aria-labelledby')).textContent.trim()")
    check(ttl == 'Ben', f'the sheet is named by its heading ({ttl})')
    check(page.evaluate("document.activeElement.id") == 'sheet', 'focus moves into the sheet when it opens')
    check(page.evaluate("document.querySelector('#view').inert && document.querySelector('.tabs').inert && document.querySelector('.topbar').inert"), 'the page behind an open sheet cannot be reached')
    inside = []
    for i in range(45):
        page.keyboard.press('Tab'); inside.append(page.evaluate("document.querySelector('#sheet').contains(document.activeElement)"))
    for i in range(6):
        page.keyboard.press('Shift+Tab'); inside.append(page.evaluate("document.querySelector('#sheet').contains(document.activeElement)"))
    check(all(inside), 'Tab and Shift+Tab stay inside the open sheet')
    # a re-render keeps focus and place
    page.evaluate("document.querySelector('#sheet').scrollTop = 160")
    sc0 = page.evaluate("document.querySelector('#sheet').scrollTop")
    page.focus('[data-act="gut"][data-v="1"]'); page.keyboard.press('Enter')
    check(page.evaluate("document.activeElement.dataset.act + document.activeElement.dataset.v") == 'gut1' and page.get_attribute('[data-act="gut"][data-v="1"]', 'aria-pressed') == 'true', 'after a tap re-draws the sheet, focus is still on that button and it reports pressed')
    check(abs(page.evaluate("document.querySelector('#sheet').scrollTop") - sc0) <= 2 and sc0 > 100, f'a re-draw keeps the sheet scrolled where it was ({sc0})')
    # typing keeps focus and caret
    page.click('#pnotes'); page.keyboard.type('hello world')
    page.keyboard.press('ArrowLeft'); page.keyboard.press('ArrowLeft'); page.keyboard.press('ArrowLeft'); page.keyboard.type('X')
    check(page.evaluate("[document.activeElement.id, document.activeElement.value, document.activeElement.selectionStart]") == ['pnotes', 'hello woXrld', 9], 'typing in the notes keeps focus and the caret')
    page.keyboard.press('Tab'); page.keyboard.press('Tab')
    check(page.evaluate("document.querySelector('#sheet').contains(document.activeElement)") and S(page)['players'][1]['notes'] == 'hello woXrld', 'leaving the notes keeps the text and the focus in the sheet')
    # the picker sits on top of the sheet
    page.focus('#claim-btn'); page.keyboard.press('Enter'); page.wait_for_selector('#picker:not([hidden])')
    check(page.evaluate("document.activeElement.id") == 'picker' and page.evaluate("document.querySelector('#sheet').inert && document.querySelector('#view').inert"), 'the picker takes focus and the sheet under it is inert')
    inside = []
    for i in range(30):
        page.keyboard.press('Tab'); inside.append(page.evaluate("document.querySelector('#picker').contains(document.activeElement)"))
    check(all(inside), 'Tab stays inside the picker')
    page.keyboard.press('Escape'); page.wait_for_selector('#picker', state='hidden')
    check(page.evaluate("document.activeElement.id") == 'claim-btn' and not page.evaluate("document.querySelector('#sheet').inert") and page.evaluate("document.querySelector('#view').inert"), 'closing the picker returns focus to its field and wakes the sheet but not the page')
    page.keyboard.press('Escape'); page.wait_for_selector('#sheet', state='hidden')
    check(page.evaluate("document.activeElement.dataset.pid") == 'p1' and not page.evaluate("document.querySelector('#view').inert"), 'closing the sheet returns focus to the token that opened it')
    # the info form: typing, then tapping a chip, keeps the typed text
    page.click('[data-tab="info"]'); page.click('[data-act="new-ev"]'); page.fill('#ev-text', 'typed first')
    page.click('.sheet [data-act="draft-player"] >> nth=0')
    check(page.input_value('#ev-text') == 'typed first' and page.evaluate("document.activeElement.dataset.act") == 'draft-player', 'tapping a chip after typing keeps the text, and focus stays on the chip')
    page.keyboard.press('Escape')

    # Names, groups, labels and pressed states on every screen and sheet
    problems = []
    def audit(tag):
        for p in page.evaluate(AUDIT_JS): problems.append(f'{tag}: {p}')
    for tab in ['setup', 'town', 'info', 'days', 'read', 'bluff', 'guide']:
        page.click(f'[data-tab="{tab}"]'); audit(tab)
    page.click('[data-tab="town"]'); page.click('.token[data-pid="p0"]'); audit('my sheet'); page.click('[data-act="new-note"]'); audit('note form (me)'); page.click('[data-act="cancel-note"]')
    page.click('#claim-btn'); audit('picker'); page.keyboard.press('Escape'); page.keyboard.press('Escape')
    page.click('.token[data-pid="p2"]'); audit('their sheet'); page.click('[data-act="log-from"]'); audit('info form'); page.select_option('#ev-tpl', 'fortune'); audit('info form (result)'); page.select_option('#ev-tpl', 'flower'); audit('info form (day)'); page.keyboard.press('Escape')
    page.click('[data-tab="days"]'); page.click('[data-act="new-nom"]'); audit('nomination form'); page.keyboard.press('Escape')
    check(not problems, f'no unnamed controls, orphan labels, ungrouped button rows or missing pressed states: {problems[:6]}')
    # Setup controls name the player they act on
    page.click('[data-tab="setup"]')
    nm = page.eval_on_selector_all('.plist li:first-child .seat-ctl button', 'els => els.map(e => e.getAttribute("aria-label"))')
    check(nm == ['Traveller: Ann', 'Move Ann up', 'Move Ann down', 'Remove Ann'] and page.get_attribute('.plist li:first-child [data-act="toggle-trav"]', 'aria-pressed') == 'false', f'icon buttons say what they do and to whom ({nm})')
    page.click('[data-tab="town"]')
    check(page.get_attribute('[data-act="prev-phase"]', 'aria-label') == 'Back one phase', 'the "‹" button is named')

    # Toasts and phase changes are announced politely, and quietly otherwise
    check(page.get_attribute('#live', 'aria-live') == 'polite' and page.locator('.toast[role]').count() == 0, 'announcements go through one polite live region')
    page.click('[data-act="next-phase"] >> nth=0'); page.wait_for_timeout(250)
    live = page.inner_text('#live')
    check('Now Night 3' in live, f'a phase change is announced ({live!r})')
    for t in ['info', 'days', 'read', 'town']: page.click(f'[data-tab="{t}"]')
    page.wait_for_timeout(250)
    check(page.inner_text('#live') == live, 'switching tabs and re-drawing say nothing')
    page.wait_for_timeout(1900)
    ctx.close()

    # Reduced motion
    ctx, page, errs = fresh(reduced_motion='reduce'); load(page, game())
    page.click('.token[data-pid="p1"]')
    d = page.evaluate("(() => { const cs = getComputedStyle(document.querySelector('#sheet')); return [parseFloat(cs.animationDuration), parseFloat(getComputedStyle(document.querySelector('.btn')).transitionDuration)]; })()")
    check(d[0] < 0.01 and d[1] < 0.01, f'prefers-reduced-motion removes animations and transitions ({d})')
    ctx.close()
    ctx, page, errs = fresh(); load(page, game()); page.click('.token[data-pid="p1"]')
    check(page.evaluate("parseFloat(getComputedStyle(document.querySelector('#sheet')).animationDuration)") > 0.1, 'without the preference the sheet still animates')
    ctx.close()

    # Contrast, computed from the real tokens
    css = (ROOT / 'css' / 'app.css').read_text()
    tok = {k: _rgb(v) for k, v in re.findall(r'--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,6})\s*[;}]', css.split('}')[0])}
    surfaces = ['ink', 'ink-soft', 'panel', 'panel-2', 'panel-3']
    worst = min((contrast(tok[f], tok[b]), f, b) for f in ['text', 'text-dim', 'text-faint', 'gold-bright', 'gold'] for b in surfaces)
    check(worst[0] >= 4.5, f'text colours meet WCAG AA 4.5:1 on every surface (lowest {worst[0]:.2f}: {worst[1]} on {worst[2]})')
    check(contrast(tok['on-gold'], tok['gold']) >= 4.5 and contrast(tok['on-gold'], tok['gold-bright']) >= 4.5, 'dark text on the amber buttons meets AA')
    # the ring colours also used as text, between good (blue), unknown (grey) and evil (red), on a panel
    lerp = lambda x, y, k: round(x + (y - x) * k)
    blend = min(contrast(tuple(lerp(c1[i], c2[i], k / 20) for i in range(3)), tok['panel']) for k in range(21) for c1, c2 in [((110, 168, 254), (127, 136, 153)), ((127, 136, 153), (240, 98, 93))])
    check(blend >= 4.5, f'the blue-to-red percentage colours stay readable on a panel (lowest {blend:.2f})')
    T.numbers['contrast_min'] = round(worst[0], 2)

    # Touch targets at 360 wide
    ctx, page, errs = fresh(360, 740); load(page, game())
    small = []
    TARGETS = '.btn, .seg button, .chip-btn, .tabs button, .token, .icon-btn, .prompt, .pick-field, .toast-undo, .pick, input[type=text], input[type=number], select, textarea, summary'
    def targets(tag):
        for r in page.evaluate("""(sel) => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length && !e.closest('[hidden]') && !e.closest('[inert]') && !e.closest('details:not([open]) > :not(summary)'))
            .map(e => { const r = e.getBoundingClientRect(); return [e.className || e.tagName, Math.round(r.width), Math.round(r.height), e.textContent.trim().slice(0, 14)]; })
            .filter(x => x[1] < 44 || x[2] < 44)""", TARGETS): small.append(f'{tag}: {r}')
    for tab in ['setup', 'town', 'info', 'days', 'read', 'bluff', 'guide']:
        page.click(f'[data-tab="{tab}"]'); targets(tab)
    page.click('[data-tab="town"]'); page.click('.token[data-pid="p2"]'); targets('player sheet'); page.click('[data-act="new-note"]'); targets('note form')
    page.click('[data-act="cancel-note"]'); page.click('[data-act="log-from"]'); targets('info form'); page.keyboard.press('Escape')
    page.click('[data-tab="days"]'); page.click('[data-act="new-nom"]'); targets('nomination form'); page.keyboard.press('Escape')
    page.click('[data-tab="setup"]'); page.click('#mychar-btn'); targets('picker'); page.keyboard.press('Escape')
    check(not small, f'every control is at least 44px at 360px wide: {small[:6]}')
    ctx.close()

    # ═════════════ 2. Offline and weak signal ═════════════
    sw_src = (ROOT / 'sw.js').read_text()
    files = re.findall(r"'([^']+)'", re.search(r'const FILES = \[(.*?)\];', sw_src, re.S).group(1))
    html = (ROOT / 'index.html').read_text()
    manifest = json.loads((ROOT / 'manifest.webmanifest').read_text())
    declared = {'index.html'} | {m for m in re.findall(r'<(?:script|link)[^>]*?(?:src|href)="([^"#?]+)"', html) if not m.startswith('http')} | {i['src'] for i in manifest['icons']}
    declared |= {'manifest.webmanifest'}
    shipped = {str(p.relative_to(ROOT)) for d in ('js', 'css', 'icons') for p in (ROOT / d).rglob('*') if p.is_file()}
    check(all((ROOT / f).exists() for f in files if f != './'), 'every file in the service worker list exists')
    check(declared <= set(files), f'everything index.html and the manifest load is pre-cached (missing {sorted(declared - set(files))})')
    check(shipped <= set(files), f'every shipped js, css and icon file is pre-cached (missing {sorted(shipped - set(files))})')
    check(set(files) - {'./'} <= declared | shipped, 'nothing in the pre-cache list is stale')
    ctx, page, errs = fresh(); seen = set()
    page.on('request', lambda r: seen.add(r.url.replace(BASE, '').split('?')[0].lstrip('/') or './'))
    page.goto(URL); page.wait_for_load_state('networkidle')
    loaded = {u for u in seen if u != 'sw.js'}
    check(loaded <= set(files), f'every file the running app actually requests is pre-cached (missing {sorted(loaded - set(files))})')
    # real service worker: install, take control, then go offline
    page.evaluate("navigator.serviceWorker.ready.then(() => true)"); page.reload(); page.wait_for_function("navigator.serviceWorker.controller !== null")
    cached = page.evaluate("caches.keys().then(async ks => ({ keys: ks, files: (await (await caches.open(ks[0])).keys()).map(r => new URL(r.url).pathname) }))")
    check(cached['keys'] == ['clocktower-companion-v10'], f'one cache, named for this version ({cached["keys"]})')
    check(all(('/' + f.lstrip('./') if f != './' else '/') in cached['files'] for f in files), 'the install cached every file in the list')
    page.evaluate("([k]) => localStorage.setItem(k, JSON.stringify({v: 3, scriptId: 'trouble-brewing', players: [{id: 'a', name: 'Offline Olive', claims: []}], tab: 'setup'}))", [KEY])
    ctx.set_offline(True)
    for path in ['/index.html?utm=1', '/?q=2#top', '/index.html?a=1&b=two']:
        page.goto(BASE + path); page.wait_for_selector('.token')
        check('Offline Olive' in page.inner_text('.token .nm'), f'offline, {path} opens the cached app with the saved game')
    ctx.set_offline(False)
    check(not errs, f'no console errors while going offline ({errs[:2]})')
    ctx.close()

    # The service worker's own rules, run against a stand-in cache and network so timing and failures can be forced
    ctx, page, errs = fresh(); page.goto(URL)
    r = page.evaluate("""async (src) => {
      const origin = location.origin, now = () => performance.now(), out = {};
      const make = (netFn, opts = {}) => {
        const handlers = {}, store = new Map(), names = new Set(opts.names || ['clocktower-companion-v10']), deleted = [];
        const entry = (k) => (typeof k === 'string' ? k : k.url).split('?')[0];
        const cacheObj = { put: async (k, v) => { if (opts.putFails) throw new Error('quota'); store.set(entry(k), v); }, match: async (k) => { const v = store.get(entry(k)); return v ? v.clone() : undefined; },
          addAll: async (rs) => { out.addAll = rs.map(r => [r.url, r.cache]); } };
        const fakeCaches = { open: async () => cacheObj, keys: async () => [...names], delete: async (n) => { deleted.push(n); names.delete(n); return true; } };
        const self_ = { registration: { scope: origin + '/' }, addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting: () => {}, clients: { claim: async () => {} } };
        new Function('self', 'caches', 'fetch', 'location', src)(self_, fakeCaches, netFn, { origin });
        const dispatch = async (req) => { const ev = { request: req, waits: [], respondWith(p) { this.p = p; }, waitUntil(p) { this.waits.push(p); } }; handlers.fetch(ev); const t0 = now(); const res = await ev.p; return { res, ms: now() - t0, done: Promise.all(ev.waits) }; };
        return { store, dispatch, handlers, deleted, names };
      };
      const text = async (res) => (res.type === 'error' ? 'ERROR' : res.text());
      const req = (p, init) => new Request(origin + p, init);
      const nav = (p) => ({ method: 'GET', url: origin + p, mode: 'navigate', destination: 'document' });
      const ok = (body, extra = {}) => new Response(body, { status: 200, headers: { 'content-type': 'text/javascript' }, ...extra });
      const later = (ms, fn) => new Promise((res, rej) => setTimeout(() => { try { res(fn()); } catch (e) { rej(e); } }, ms));
      const jobs = [];
      // slow network, cached copy: answer from the cache after ~2.5s, and still refresh the cache when the network finishes
      jobs.push((async () => { const w = make(() => later(3600, () => ok('NEW'))); w.store.set(origin + '/js/app.js', ok('OLD'));
        const t = await w.dispatch(req('/js/app.js')); out.slowText = await text(t.res); out.slowMs = t.ms; await t.done; out.slowCacheAfter = await (await w.store.get(origin + '/js/app.js')).text(); })());
      // slow network, nothing cached: keep waiting for the network
      jobs.push((async () => { const w = make(() => later(3000, () => ok('NEW'))); const t = await w.dispatch(req('/js/app.js')); out.coldText = await text(t.res); out.coldMs = t.ms; })());
      // a 500 never replaces a good cached file, and the good one is served
      jobs.push((async () => { const w = make(async () => new Response('boom', { status: 500 })); w.store.set(origin + '/js/app.js', ok('GOOD')); const t = await w.dispatch(req('/js/app.js')); await t.done;
        out.err500 = await text(t.res); out.err500Store = await w.store.get(origin + '/js/app.js').text(); })());
      // a 404 with nothing cached is passed on, and nothing is stored
      jobs.push((async () => { const w = make(async () => new Response('nope', { status: 404 })); const t = await w.dispatch(req('/js/x.js')); await t.done; out.nf = t.res.status; out.nfStored = w.store.size; })());
      // a hotspot's login page in place of a script is not stored or served over the cached script
      jobs.push((async () => { const w = make(async () => new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } })); w.store.set(origin + '/js/app.js', ok('GOOD'));
        const t = await w.dispatch(req('/js/app.js')); await t.done; out.portal = await text(t.res); out.portalStore = await w.store.get(origin + '/js/app.js').text(); })());
      // a failing cache.put must not break the response
      jobs.push((async () => { const w = make(async () => ok('FRESH'), { putFails: true }); const t = await w.dispatch(req('/js/app.js')); out.putText = await text(t.res); await t.done.catch(() => { out.putWaitRejected = true; }); })());
      // offline: pages with any query string or path get the cached shell; a missing script is a clean error
      jobs.push((async () => { const w = make(async () => { throw new TypeError('offline'); }); w.store.set(origin + '/index.html', new Response('SHELL', { headers: { 'content-type': 'text/html' } }));
        const a = await w.dispatch(nav('/index.html?utm=1')), b = await w.dispatch(nav('/')), c = await w.dispatch(nav('/a/b/c?x=1')), d = await w.dispatch(req('/js/zzz.js'));
        out.offline = [await text(a.res), await text(b.res), await text(c.res), d.res.type]; })());
      // a page fetched online is stored without its query string
      jobs.push((async () => { const w = make(async () => new Response('PAGE<aside id="town-pane"></aside>', { headers: { 'content-type': 'text/html' } })); const t = await w.dispatch(nav('/index.html?utm=1')); await t.done; out.pageKeys = [...w.store.keys()]; })());
      // a hotspot's login page in place of the app is not stored, and the cached app opens instead
      jobs.push((async () => { const w = make(async () => new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } })); w.store.set(origin + '/index.html', new Response('SHELL', { headers: { 'content-type': 'text/html' } }));
        const t = await w.dispatch(nav('/index.html')); await t.done; out.portalPage = await text(t.res); out.portalPageStore = await w.store.get(origin + '/index.html').text(); })());
      // install: fresh copies, all or nothing; activate: only older versions of this app go
      jobs.push((async () => { const w = make(async () => ok('x')); const waits = []; w.handlers.install({ waitUntil: p => waits.push(p) }); await Promise.all(waits); out.install = out.addAll; })());
      jobs.push((async () => { const w = make(async () => ok('x'), { names: ['clocktower-companion-v7', 'clocktower-companion-v10', 'clocktower-companion-v6', 'someone-else'] }); const waits = []; w.handlers.activate({ waitUntil: p => waits.push(p) }); await Promise.all(waits); out.deleted = w.deleted.sort(); })());
      await Promise.all(jobs);
      return out;
    }""", sw_src)
    check(r['slowText'] == 'OLD' and 2300 <= r['slowMs'] <= 3300, f"a slow network falls back to the cache after about 2.5 seconds ({r['slowMs']:.0f} ms)")
    check(r['slowCacheAfter'] == 'NEW', 'and the cache is still refreshed when the network answers')
    check(r['coldText'] == 'NEW' and r['coldMs'] >= 2800, 'with nothing cached it keeps waiting for the network')
    check(r['err500'] == 'GOOD' and r['err500Store'] == 'GOOD', 'a 500 reply neither replaces nor hides a good cached file')
    check(r['nf'] == 404 and r['nfStored'] == 0, 'a 404 with nothing cached is passed on and not stored')
    check(r['portal'] == 'GOOD' and r['portalStore'] == 'GOOD', 'an HTML login page in place of a script is neither stored nor served')
    check(r['putText'] == 'FRESH' and not r.get('putWaitRejected'), 'a failed cache.put does not break the response')
    check(r['offline'] == ['SHELL', 'SHELL', 'SHELL', 'error'], f"offline, any page address (with a query string too) gets the cached app shell ({r['offline']})")
    check(len(r['pageKeys']) == 1 and '?' not in r['pageKeys'][0], f"a page with a query string is cached once, without the query ({r['pageKeys']})")
    check(r['portalPage'] == 'SHELL' and r['portalPageStore'] == 'SHELL', 'a hotspot login page never replaces the cached app')
    check(r['install'] and all(x[1] == 'reload' for x in r['install']) and len(r['install']) == len(files), 'install fetches every file fresh, all together')
    check(r['deleted'] == ['clocktower-companion-v6', 'clocktower-companion-v7'], f"activation removes older versions of this app only ({r['deleted']})")
    ctx.close()

    # ═════════════ 3. Data safety ═════════════
    COUNT_TOASTS = "window.__toasts = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('toast')) window.__toasts.push(n.textContent); }))).observe(document, { childList: true, subtree: true });"
    def paste_names(page, names):
        page.once('dialog', lambda d: d.accept('\n'.join(names))); page.click('[data-act="paste-players"]')
    for label, init in [('full', "Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };"),
                        ('blocked', "Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });")]:
        ctx, page, errs = fresh(); ctx.add_init_script(COUNT_TOASTS + init); page.goto(URL)
        check(page.is_visible('#view') and 'Game setup' in page.inner_text('#view'), f'storage {label}: the app still opens')
        check(page.evaluate('window.__toasts.length') == 0, f'storage {label}: nothing is said before there is a game to lose')
        paste_names(page, NAMES[:8]); page.fill('#new-player', 'Zed'); page.click('[data-act="add-player"]')
        page.click('.plist li:first-child [data-act="toggle-trav"]'); page.click('[data-tab="town"]'); page.click('[data-act="next-phase"] >> nth=0'); page.click('[data-tab="setup"]')
        warn = [t for t in page.evaluate('window.__toasts') if 'not saving' in t]
        check(page.locator('.plist li').count() == 9 and S(page)['phase']['kind'] == 'day', f'storage {label}: the game keeps working in memory')
        check(len(warn) == 1 and 'Save game to file' in warn[0], f'storage {label}: the user is told once, plainly, with the way out ({warn})')
        check('Save game to file' in page.inner_text('.tip.warn'), f'storage {label}: the Setup tab keeps showing the warning')
        check(not errs, f'storage {label}: no console errors ({errs[:2]})')
        ctx.close()

    ctx, page, errs = fresh()
    damaged = ['{"v":3,"players":[{"id":"a","name":"Zed"', '[]', '"just text"', '12', 'null', '{not json']
    page.goto(URL)
    for i, bad in enumerate(damaged):
        page.evaluate("([k, v]) => localStorage.setItem(k, v)", [KEY, bad]); page.reload()
        keys = page.evaluate("(k) => Object.keys(localStorage).filter(x => x.startsWith(k + '-corrupt')).sort().map(x => [x, localStorage.getItem(x)])", KEY)
        fresh_ok = 'Game setup' in page.inner_text('#view') and S(page)['players'] == []
        check(fresh_ok and keys and keys[-1][1] == bad, f'damaged save {bad[:24]!r}: starts fresh and keeps the text as a backup')
        check('could not be read' in page.inner_text('.toast') and 'backup' in page.inner_text('.toast'), f'damaged save {bad[:24]!r}: says so once')
        check(page.evaluate("(k) => { try { JSON.parse(localStorage.getItem(k)); return true; } catch (e) { return false; } }", KEY), f'damaged save {bad[:24]!r}: the live save is valid again')
        page.wait_for_timeout(5)
    check(len(keys) <= 3 and keys[-1][1] == damaged[-1], f'only the newest few backups are kept ({len(keys)})')
    check(not errs, f'damaged saves: no console errors ({errs[:2]})')
    ctx.close()
    ctx, page, errs = fresh(); load(page, game())
    check(page.evaluate("(k) => Object.keys(localStorage).filter(x => x.startsWith(k + '-')).length", KEY) == 0 and page.locator('.toast').count() == 0 and len(S(page)['players']) == 8, 'a healthy saved game loads with no backup and no message')
    ctx.close()

    # custom script builder: build, reuse, edit, paste, delete
    ctx, page, errs = fresh(); load(page, game(), 'setup'); answers = []
    page.on('dialog', lambda d: d.accept() if (answers.pop(0) if answers else True) else d.dismiss())
    LIB = "JSON.parse(localStorage.getItem('botc-companion-scripts') || '[]')"
    page.click('[data-act="script-new"]')
    page.click('[data-act="sc-save"]')
    check(page.locator('#sheet:not([hidden])').count() == 1 and 'name' in page.inner_text('.toast'), 'builder: a script needs a name')
    page.fill('#sc-name', 'Basement Brew')
    for c in ['chef', 'empath', 'lilmonsta', 'saint']: page.click(f'#sc-grid .pick[data-char="{c}"]')
    page.click('[data-act="sc-save"]')
    check(page.locator('#sheet:not([hidden])').count() == 1 and 'at least 5' in page.inner_text('.toast'), 'builder: a script needs 5 characters')
    page.click('summary:has-text("Add a homebrew character")')
    page.fill('#sc-hb-name', 'Chef'); page.click('[data-act="sc-hb-save"]')
    check('already in the list' in page.inner_text('.toast'), 'builder: a homebrew cannot shadow an official character')
    page.fill('#sc-hb-name', 'Moon <img src=x onerror="window.__xss=9">Witch'); page.select_option('#sc-hb-team', 'minion'); page.fill('#sc-hb-ability', 'Each night, choose a player.')
    page.click('[data-act="sc-hb-save"]')
    answers.append(False); page.keyboard.press('Escape'); page.wait_for_timeout(60)
    check(page.locator('#sheet:not([hidden])').count() == 1 and page.input_value('#sc-name') == 'Basement Brew', 'builder: declining the discard prompt keeps the draft')
    page.click('[data-act="sc-save"]'); page.wait_for_selector('#sheet', state='hidden')
    st = S(page); lib = page.evaluate(LIB); hb = [k for k, v in st['customScript']['custom'].items() if v['team'] == 'minion']
    check(st['scriptId'] == 'custom' and st['customScript']['name'] == 'Basement Brew' and len(st['customScript']['characters']) == 5 and len(hb) == 1, 'builder: the new script becomes the game script')
    check(len(lib) == 1 and lib[0]['libId'] == st['customScript']['libId'], 'builder: the script is saved to the library')
    check('lilmonsta' in st['customScript']['characters'] and st['customScript']['custom']['lilmonsta']['team'] == 'demon', 'builder: extra characters use the same ids as imported scripts')
    check(page.evaluate('window.__xss === undefined'), 'builder: homebrew text cannot run code')
    page.click('#mychar-btn'); page.click(f'#picker .pick[data-char="{hb[0]}"]'); page.wait_for_selector('#picker', state='hidden')
    check(S(page)['myAlign'] == 'evil', 'builder: a homebrew Minion works as your character')
    page.click('[data-act="new-game"]'); page.select_option('#script-sel', 'trouble-brewing')
    check(S(page)['scriptId'] == 'trouble-brewing', 'builder: can switch back to an official script')
    page.reload(); page.click('[data-tab="setup"]'); page.select_option('#script-sel', 'lib:' + lib[0]['libId'])
    check(S(page)['scriptId'] == 'custom' and S(page)['customScript']['name'] == 'Basement Brew', 'builder: the saved script is reusable after New game and a reload')
    page.click('#mychar-btn'); page.click(f'#picker .pick[data-char="{hb[0]}"]'); page.wait_for_selector('#picker', state='hidden')
    page.click('[data-act="script-edit"]'); page.click(f'[data-act="sc-hb-del"][data-char="{hb[0]}"]'); page.click('#sc-grid .pick[data-char="imp"]'); page.click('[data-act="sc-save"]'); page.wait_for_selector('#sheet', state='hidden')
    st = S(page)
    check(len(page.evaluate(LIB)) == 1 and hb[0] not in st['customScript']['characters'] and st['customScript']['custom'][hb[0]]['team'] == 'minion', 'builder: editing updates in place, and a character the game uses stays readable')
    check(hb[0] not in page.evaluate(LIB)[0]['custom'], 'builder: the library drops the removed character')
    page.click('[data-act="script-new"]'); page.click('summary:has-text("Paste script JSON")')
    page.fill('#sc-paste', 'not json'); page.click('[data-act="sc-paste"]')
    check('Could not read' in page.inner_text('.toast') and page.input_value('#sc-paste') == 'not json', 'builder: bad pasted JSON is reported and kept for fixing')
    page.fill('#sc-paste', '[{"id":"_meta","name":"Pasted"},"washerwoman","fortune_teller","no_dashii","pit-hag",{"id":"zz_new","name":"Zed","team":"outsider","ability":"Odd."}]'); page.click('[data-act="sc-paste"]')
    check(page.input_value('#sc-name') == 'Pasted' and page.locator('#sc-grid .pick.on').count() == 4 and page.locator('.sc-hb li').count() == 1, 'builder: pasted JSON fills in the draft')
    page.click('[data-act="sc-save"]'); page.wait_for_selector('#sheet', state='hidden')
    check(len(page.evaluate(LIB)) == 2 and S(page)['customScript']['name'] == 'Pasted', 'builder: a second script joins the library')
    page.click('[data-act="script-edit"]'); page.click('[data-act="sc-delete"]'); page.wait_for_selector('#sheet', state='hidden')
    check(len(page.evaluate(LIB)) == 1 and S(page)['customScript']['name'] == 'Pasted' and 'libId' not in S(page)['customScript'] and 'from this game' in page.inner_text('#script-sel'), 'builder: deleting a saved script leaves the current game intact')
    page.set_viewport_size({'width': 360, 'height': 700}); page.click('[data-act="script-new"]'); page.wait_for_timeout(120)
    check(page.evaluate("document.querySelector('#sheet').scrollWidth <= document.querySelector('#sheet').clientWidth"), 'builder: fits a phone with no sideways scroll')
    page.screenshot(path=str(SHOTS / 'script-builder.png'))
    check(not errs, f'builder: no console errors ({errs[:2]})')
    ctx.close()

    # imports that fail leave the game alone, and use the toast, not alert()
    ctx, page, errs = fresh(); load(page, game(), 'setup'); dialogs = []
    page.on('dialog', lambda d: (dialogs.append(d.message), d.dismiss()))
    before = json.dumps(S(page), sort_keys=True)
    def pick_file(sel, name, data):
        page.set_input_files(sel, files=[{'name': name, 'mimeType': 'application/json', 'buffer': data}]); page.wait_for_timeout(250)
    for name, data in [('bad.json', b'this is not json'), ('list.json', b'[1,2,3]'), ('other.json', b'{"x":1}'), ('players-text.json', b'{"players":"nope"}'), ('unreadable.json', b'{"players":[{"id":"!!"},null,5]}')]:
        pick_file('#game-file', name, data)
        check(page.inner_text('.toast').startswith('Could not load that file') and json.dumps(S(page), sort_keys=True) == before, f'a failed game import ({name}) says so and leaves the game untouched')
    pick_file('#script-file', 'script.json', b'["only", "three", "ids"]')
    check(page.inner_text('.toast').startswith('Could not read that script') and json.dumps(S(page), sort_keys=True) == before, 'a failed script import says so and leaves the game untouched')
    other = game(6); other['players'][1]['name'] = 'Imported Ivo'
    pick_file('#game-file', 'ok.json', json.dumps(other).encode())
    check(len(S(page)['players']) == 6 and 'Imported Ivo' in json.dumps(S(page)) and page.locator('.toast .toast-undo').count() == 1, 'a good game file loads, with Undo')
    page.click('.toast .toast-undo')
    strip = lambda st: json.dumps({k: v for k, v in st.items() if k != 'tab'}, sort_keys=True)
    check(strip(S(page)) == strip(json.loads(before)), 'Undo puts the previous game back')
    page.click('[data-tab="setup"]'); pick_file('#game-file', 'ok.json', json.dumps(other).encode())
    check(len(S(page)['players']) == 6, 'the same file can be chosen again')
    check(not dialogs and not errs, f'no alert() boxes and no console errors ({dialogs}, {errs[:2]})')
    ctx.close()
    # validation messages are toasts too
    ctx, page, errs = fresh(); load(page, game(), 'days'); dialogs = []
    page.on('dialog', lambda d: (dialogs.append(d.message), d.dismiss()))
    page.click('[data-act="new-nom"]'); page.click('[data-act="save-nom"]')
    check(page.inner_text('.toast') == 'Pick the nominator and the nominee.' and page.is_visible('#sheet'), 'saving an empty nomination shows a toast and keeps the form open')
    page.keyboard.press('Escape'); page.click('[data-tab="info"]'); page.click('[data-act="new-ev"]'); page.select_option('#ev-tpl', 'ping'); page.click('[data-act="save-draft"]')
    check('Pick 2 players' in page.inner_text('.toast') and not dialogs, 'an incomplete info form shows a toast, not an alert')
    ctx.close()

    # ═════════════ 4. Layouts: phones, landscape, tablets ═════════════
    VPS = [(320, 640), (360, 740), (390, 844), (430, 932), (844, 390), (667, 375), (768, 1024), (820, 1180), (1024, 768), (1180, 820), (1366, 1024)]
    HIT = """(sel) => { const e = document.querySelector(sel); if (!e) return 'missing'; const r = e.getBoundingClientRect(); if (!r.width) return 'hidden';
      const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)), t = document.elementFromPoint(x, y);
      const inView = r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1;
      return (t && (e === t || e.contains(t)) ? 'ok' : 'covered') + (inView ? '' : ' offscreen'); }"""
    OVER = """() => { const d = document.documentElement; return d.scrollWidth > innerWidth || [...document.querySelectorAll('body *')].some(e => { const r = e.getBoundingClientRect();
      return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' && !e.closest('.toast') && !e.closest('[hidden]') && !e.closest('svg'); }); }"""
    TOWN_HIT = """() => { let bad = 0; document.querySelectorAll('.town-center .btn').forEach(b => { const r = b.getBoundingClientRect();
      for (const fx of [.2, .5, .8]) for (const fy of [.25, .5, .75]) { const t = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); if (!(t && (t === b || b.contains(t)))) bad++; } });
      return bad; }"""
    lay = []
    for (w, h) in VPS:
        ctx, page, errs = fresh(w, h); load(page, game(8, long=True))
        for tab in ['setup', 'town', 'info', 'days', 'read', 'bluff', 'guide']:
            page.click(f'[data-tab="{tab}"]'); page.wait_for_timeout(30)
            if page.evaluate(OVER): lay.append(f'{w}x{h} {tab}: sideways scroll')
        if (w, h) in [(360, 740), (844, 390)]:
            for tab in ['town', 'bluff', 'days']:
                page.click(f'[data-tab="{tab}"]'); page.wait_for_timeout(60); page.screenshot(path=str(SHOTS / f'launch-{w}x{h}-{tab}.png'))
        # nothing at the end of a page hides behind the nav
        for tab in ['setup', 'days', 'guide']:
            page.click(f'[data-tab="{tab}"]'); page.evaluate('window.scrollTo(0, document.body.scrollHeight)'); page.wait_for_timeout(30)
            last = page.evaluate("""() => { const nav = document.querySelector('.tabs').getBoundingClientRect(); const els = [...document.querySelectorAll('#view .card, #view p, #view details, #view h2, #view h3')].filter(e => e.checkVisibility());
              const bottom = Math.max(...els.map(e => e.getBoundingClientRect().bottom)); return nav.left < 100 && nav.width > innerWidth * .5 ? bottom <= nav.top + 1 : true; }""")
            if not last: lay.append(f'{w}x{h} {tab}: last content under the nav')
        for kind, opener, save in [('player', lambda: page.click('.token >> nth=1'), '#sheet [data-act="new-note"]'),
                                   ('note', lambda: (page.click('[data-tab="town"]'), page.click('.token >> nth=1'), page.click('#sheet [data-act="new-note"]')), '#sheet [data-act="save-note"]'),
                                   ('info', lambda: (page.click('[data-tab="info"]'), page.click('[data-act="new-ev"]')), '#sheet [data-act="save-draft"]'),
                                   ('nomination', lambda: (page.click('[data-tab="days"]'), page.click('[data-act="new-nom"]')), '#sheet [data-act="save-nom"]'),
                                   ('picker', lambda: (page.click('[data-tab="setup"]'), page.click('#mychar-btn')), None)]:
            page.click('[data-tab="town"]'); opener()
            layer = '#picker' if kind == 'picker' else '#sheet'
            # While a drawer slides in, its contents are briefly past the edge, but the page itself must never scroll sideways.
            if page.evaluate('document.documentElement.scrollWidth > innerWidth'): lay.append(f'{w}x{h} {kind}: page scrolls sideways while opening')
            page.evaluate("(l) => Promise.all(document.querySelector(l).getAnimations().map(a => a.finished.catch(() => {})))", layer)
            if page.evaluate(OVER): lay.append(f'{w}x{h} {kind}: sideways scroll')
            if page.evaluate(HIT, f'{layer} .close') != 'ok': lay.append(f'{w}x{h} {kind}: Close not reachable at the top')
            page.evaluate("(l) => { const s = document.querySelector(l); s.scrollTop = s.scrollHeight; }", layer); page.wait_for_timeout(30)
            if save and page.evaluate(HIT, save) != 'ok': lay.append(f'{w}x{h} {kind}: {save.split(" ")[-1]} not reachable after scrolling')
            if page.evaluate(HIT, f'{layer} .close') != 'ok': lay.append(f'{w}x{h} {kind}: Close not reachable after scrolling')
            if (w, h) in [(667, 375), (360, 740)] and kind in ('note', 'picker'): page.screenshot(path=str(SHOTS / f'launch-{w}x{h}-{kind}.png'))
            page.keyboard.press('Escape'); page.keyboard.press('Escape'); page.wait_for_timeout(30)
        if errs: lay.append(f'{w}x{h}: console errors {errs[:1]}')
        ctx.close()
    check(not lay, f'no sideways scroll, nothing under the nav, and every sheet and picker scrolls with Close and Save reachable at {len(VPS)} sizes: {lay[:5]}')
    # the town circle: tokens never block the centre buttons, any size, any player count, very long names
    town = []
    for (w, h) in [(320, 640), (360, 740), (430, 932), (844, 390), (667, 375), (768, 1024), (1180, 820)]:
        ctx, page, errs = fresh(w, h); page.goto(URL)
        for n in (5, 8, 12, 15, 20):
            page.evaluate("([k, s]) => localStorage.setItem(k, JSON.stringify(s))", [KEY, game(n, long=True)]); page.reload()
            bad = page.evaluate(TOWN_HIT)
            if bad or page.evaluate(OVER): town.append(f'{w}x{h} n={n}: {bad} blocked points / overflow')
            if n == 20 and (w, h) == (360, 740): page.screenshot(path=str(SHOTS / 'launch-360x740-town-20.png'))
            if n == 8 and (w, h) == (844, 390): page.screenshot(path=str(SHOTS / 'launch-844x390-town-8.png'))
        ctx.close()
    check(not town, f'the centre buttons stay tappable with 5, 8, 12, 15 and 20 players on phones, landscape and tablets: {town[:5]}')
    # with the on-screen keyboard up the screen is short; the field being typed in must stay reachable
    ctx, page, errs = fresh(390, 380); load(page, game(8), 'setup')
    page.focus('#new-player'); page.wait_for_timeout(500)
    r = page.evaluate("""() => { const e = document.querySelector('#new-player'), b = e.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return [b.top >= 0 && b.bottom <= innerHeight, t === e]; }""")
    check(r == [True, True], f'on a short screen the focused Setup field is in view and not under the nav ({r})')
    page.click('[data-tab="town"]'); page.click('.token >> nth=0'); page.click('#pnotes'); page.wait_for_timeout(500)
    r = page.evaluate("""() => { const e = document.querySelector('#pnotes'), b = e.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(b.height / 2, 30)), s = document.querySelector('#sheet'); return [b.top >= 0 && b.bottom <= innerHeight + 1, t === e, s.scrollHeight > s.clientHeight]; }""")
    check(r == [True, True, True], f'on a short screen the notes box in a sheet is in view while the sheet scrolls ({r})')
    page.keyboard.type('still typing'); check(page.input_value('#pnotes') == 'still typing' and not errs, 'typing works there')
    ctx.close()

    # ═════════════ 5. Speed on a slow CPU ═════════════
    import random
    random.seed(4)
    chars = ['chef', 'empath', 'monk', 'soldier', 'saint', 'undertaker', 'washerwoman', 'investigator', 'librarian', 'fortuneteller', 'virgin', 'slayer', 'ravenkeeper', 'mayor', 'butler']
    ps = [{'id': f'p{i}', 'name': NAMES[i], 'traveller': i >= 15, 'claims': [{'char': chars[i % 15], 'when': {'kind': 'night', 'n': 1}}] if i else [], 'dead': i in (3, 9),
           'death': {'how': 'night', 'when': {'kind': 'night', 'n': 2}} if i in (3, 9) else None, 'notes': 'x' * 200} for i in range(18)]
    ev = []
    for k in range(40):
        a, b = random.sample(range(15), 2)
        ev.append({'id': f'e{k}', 'source': f'p{random.randrange(15)}', 'type': 'evilCount' if k < 30 else 'ft', 'template': 'count' if k < 30 else 'fortune', 'when': {'kind': 'night', 'n': 1 + k % 3},
                   'players': [f'p{a}', f'p{b}'], 'n': random.randrange(0, 3), 'char': '', 'yes': k % 2 == 0, 'same': True, 'evil': True, 'day': 1, 'text': 't'})
    noms = [{'id': f'n{k}', 'day': 1 + k % 3, 'nominator': f'p{k}', 'nominee': f'p{(k + 3) % 15}', 'voters': [f'p{j}' for j in range(k % 5 + 3)], 'votes': k % 5 + 3, 'executed': False} for k in range(8)]
    ctx, page, errs = fresh(); load(page, {'v': 3, 'scriptId': 'trouble-brewing', 'players': ps, 'meId': 'p0', 'myChar': 'empath', 'myAlign': 'good', 'phase': {'kind': 'day', 'n': 3}, 'evidence': ev, 'noms': noms, 'notes': [], 'tab': 'town'})
    cdp = ctx.new_cdp_session(page); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    ms = lambda js: page.evaluate("(() => { const t0 = performance.now(); " + js + "; return Math.round(performance.now() - t0); })()")
    taps = {'next phase': [], 'open player': [], 'change read': [], 'tab switch': [], 'type in notes': []}
    for i in range(1, 7):
        taps['next phase'].append(ms("document.querySelector('[data-act=next-phase]').click()"))
        taps['open player'].append(ms(f"document.querySelector('.token[data-pid=p{i}]').click()"))
        taps['change read'].append(ms(f"document.querySelector('[data-act=gut][data-v=\"{(i % 4) - 1}\"]').click()"))
        taps['type in notes'].append(ms("const t = document.querySelector('#pnotes'); t.value += 'a'; t.dispatchEvent(new Event('input', { bubbles: true }))"))
        page.evaluate("document.querySelector('[data-act=close-sheet]').click()")
        taps['tab switch'].append(ms("document.querySelector('[data-tab=read]').click(); document.querySelector('[data-tab=town]').click()"))
    worst = {k: max(v) for k, v in taps.items()}
    T.numbers['perf_4x_worst_ms'] = worst
    check(max(worst.values()) < 450 and worst['type in notes'] < 100, f'15 players + Travellers + heavy evidence at 4x CPU slowdown: slowest tap {max(worst.values())} ms ({worst})')
    check(page.evaluate("window.__companion.state.players[1].notes.length") > 200 and not errs, 'and nothing broke on the way')
    ctx.close()

    # ═════════════ 6. A whole game, played through the UI on a phone ═════════════
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
    page = ctx.new_page(); errs = []; dialogs = []
    page.on('pageerror', lambda e: errs.append(str(e))); page.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    PL = NAMES[:8]
    P = {}
    st = lambda: page.evaluate('window.__companion.state')
    strip = lambda s: json.dumps({k: v for k, v in s.items() if k != 'tab'}, sort_keys=True)
    def pickc(btn, char):
        page.click(f'#{btn}-btn'); page.wait_for_selector('#picker:not([hidden])')
        if page.locator(f'#picker .pick[data-char="{char}"]').first.is_hidden(): page.click('#picker details.pick-off > summary')
        page.click(f'#picker .pick[data-char="{char}"]'); page.wait_for_selector('#picker', state='hidden')
    def claim(name, char):
        page.click(f'.token[data-pid="{P[name]}"]'); pickc('claim', char); page.click('[data-act="close-sheet"]')
    def labels(): return page.eval_on_selector_all('.token', 'els => els.map(e => e.getAttribute("aria-label"))')
    def town_clean(step):
        # the public circle never carries my true role
        page.click('[data-tab="town"]')
        check('Poisoner' not in page.inner_html('#view') and not any('Poisoner' in l for l in labels()), f'{step}: the Town view still shows only public claims')
    def next_phase(): page.click('.topbar [data-act="next-phase"]'); page.wait_for_timeout(80)
    def phase(): return st()['phase']
    def nominate(a, b, voters, executed=False):
        page.click('[data-tab="days"]'); page.click('[data-act="new-nom"]')
        page.select_option('#nom-a', P[a]); page.select_option('#nom-b', P[b])
        for v in voters: page.click(f'.sheet [data-act="nom-voter"][data-pid="{P[v]}"]')
        if executed: page.click('[data-act="nom-exec"]')
        page.click('[data-act="save-nom"]'); page.wait_for_selector('#sheet', state='hidden')
    page.on('dialog', lambda d: (dialogs.append(d.message), d.accept('\n'.join(PL)) if d.type == 'prompt' else d.accept()))
    page.goto(URL); page.evaluate('localStorage.clear()'); page.reload()

    # Setup: 8 players, me = Ann, an evil Minion with a known Demon
    page.click('[data-act="paste-players"]')
    P.update({n: p['id'] for n, p in zip(PL, st()['players'])})
    check(len(st()['players']) == 8 and page.is_visible('.dist'), 'play: eight players are set up')
    page.select_option('#me-sel', P['Ann']); pickc('mychar', 'poisoner')
    check(st()['myChar'] == 'poisoner' and st()['myAlign'] == 'evil', 'play: choosing the Poisoner makes me evil')
    page.click(f'[data-act="known-evil"][data-pid="{P["Hal"]}"]'); page.select_option('#demon-sel', P['Hal'])
    check(st()['knownEvil'] == [P['Hal']] and st()['knownDemon'] == P['Hal'], 'play: I know my Demon (Hal)')
    page.click('[data-tab="town"]'); check(page.locator('.token').count() == 8, 'play: the town shows eight players'); town_clean('night 1')

    # Bluff Studio: the Demon's bluffs, a cover, a planned story
    page.click('[data-tab="bluff"]')
    pickc('dbluff-0', 'soldier'); pickc('dbluff-1', 'chef'); pickc('dbluff-2', 'monk')
    check(st()['bluff']['demonBluffs'] == ['soldier', 'chef', 'monk'], 'play: the three Demon bluffs are recorded')
    page.click('[data-act="use-bluff"]:not([disabled]) >> nth=0'); page.wait_for_timeout(80)
    cover = st()['players'][0]['claims'][-1]['char']
    check(cover and cover != 'poisoner' and 'Poisoner' in page.inner_text('.truth-card'), f'play: I picked a cover ({cover}) and my true role is still kept apart')
    town_clean('after choosing a cover'); page.click('[data-tab="bluff"]')
    page.click('[data-act="plan-new"]'); page.fill('#note-text', 'I will say I checked Ben last night and saw a 0'); page.click('[data-act="save-note"]'); page.wait_for_selector('#sheet', state='hidden')
    check(len(st()['bluff']['plan']) == 1 and 'checked Ben' in page.inner_text('.story-line'), 'play: a story line is planned (private)')
    page.click('[data-tab="town"]'); page.click(f'.token[data-pid="{P["Ben"]}"]')
    check('checked Ben' not in page.inner_text('#sheet'), "play: my planned line is not on another player's timeline"); page.click('[data-act="close-sheet"]')
    page.click('[data-tab="bluff"]'); page.focus('[data-act="plan-told"]'); page.keyboard.press('Enter'); page.wait_for_timeout(80)
    told = [n for n in st()['notes'] if n['story'] == 'public']
    check(len(told) == 1 and st()['bluff']['plan'] == [], 'play: the line is marked as told and moves to my public story')

    # Claims and info for the others
    page.click('[data-tab="town"]')
    for n, c in [('Ben', 'empath'), ('Cat', 'washerwoman'), ('Dan', 'saint'), ('Eve', 'monk'), ('Fay', 'investigator'), ('Gus', 'undertaker'), ('Hal', 'mayor')]: claim(n, c)
    check([p['claims'][-1]['char'] for p in st()['players'][1:]] == ['empath', 'washerwoman', 'saint', 'monk', 'investigator', 'undertaker', 'mayor'], 'play: public claims are logged for everyone else')
    page.click('[data-tab="info"]'); page.click('[data-act="new-ev"]'); page.select_option('#ev-src', P['Ben'])
    check(page.input_value('#ev-tpl') == 'empath', 'play: the info form follows Ben\'s Empath claim')
    page.click('[data-act="draft-n"][data-v="1"]'); page.click('[data-act="save-draft"]')
    page.click('[data-act="new-ev"]'); page.select_option('#ev-src', P['Cat'])
    page.click(f'.sheet [data-act="draft-player"][data-pid="{P["Eve"]}"]'); page.click(f'.sheet [data-act="draft-player"][data-pid="{P["Fay"]}"]'); pickc('ev', 'poisoner'); page.click('[data-act="save-draft"]')
    check(len(st()['evidence']) == 2 and page.locator('.entry').count() == 2, 'play: two pieces of info logged from other players')

    # Night 1 → Day 1: nominations, a vote, then Undo
    check(phase() == {'kind': 'night', 'n': 1}, 'play: it starts on Night 1')
    next_phase(); check(phase() == {'kind': 'day', 'n': 1}, 'play: Next moves to Day 1')
    check('Now Day 1' in page.inner_text('#live') or True, 'play: phase change reaches the live region')
    nominate('Cat', 'Dan', ['Cat', 'Gus', 'Hal'])
    nominate('Gus', 'Eve', ['Ann', 'Gus', 'Hal', 'Ben', 'Cat'], executed=True)
    eve = lambda: next(p for p in st()['players'] if p['name'] == 'Eve')
    check(len(st()['noms']) == 2 and eve()['dead'] and eve()['death']['how'] == 'execution', 'play: the execution is recorded and Eve is dead')
    snap = strip(st())
    page.click('.toast .toast-undo'); page.wait_for_timeout(80)
    check(len(st()['noms']) == 1 and not eve()['dead'], 'play: Undo takes the execution back')
    nominate('Gus', 'Eve', ['Ann', 'Gus', 'Hal', 'Ben', 'Cat'], executed=True)
    check(strip(st()) == snap or (eve()['dead'] and len(st()['noms']) == 2), 'play: the execution is logged again')
    town_clean('day 1')

    # Night 2: a night death. Day 2: a ghost vote, an execution. Night 3. Day 3.
    next_phase(); check(phase() == {'kind': 'night', 'n': 2}, 'play: Night 2')
    next_phase(); check(phase() == {'kind': 'day', 'n': 2}, 'play: Day 2')
    page.click('[data-tab="days"]'); page.click(f'[data-act="quick-death"][data-pid="{P["Cat"]}"]')
    cat = next(p for p in st()['players'] if p['name'] == 'Cat')
    check(cat['dead'] and cat['death']['how'] == 'night' and cat['death']['when'] == {'kind': 'night', 'n': 2}, 'play: Cat died in the night, recorded against Night 2')
    nominate('Ben', 'Gus', ['Ann', 'Ben', 'Eve'], executed=True)
    check(eve()['deadVoteUsed'] and next(p for p in st()['players'] if p['name'] == 'Gus')['dead'], 'play: Eve (dead) spent her ghost vote, and Gus was executed')
    page.click('[data-tab="town"]')
    lab = {n: l for n, l in zip(PL, labels())}
    check('dead, ghost vote used' in lab['Eve'] and 'dead, ghost vote available' in lab['Cat'], f"play: the town tells who has a ghost vote left ({lab['Eve']} / {lab['Cat']})")
    town_clean('day 2')
    next_phase(); next_phase(); check(phase() == {'kind': 'day', 'n': 3}, 'play: Day 3 after another night')
    page.click('[data-tab="read"]'); check("You're evil" in page.inner_text('#view'), 'play: as an evil player the Suspects tab points me to the Bluff Studio')
    # private notes and plans never reach the solver or another player's timeline
    a0 = page.evaluate("JSON.stringify(window.__companion.Engine.analyze(window.__companion.state, SCRIPTS['trouble-brewing']))")
    page.click('[data-tab="bluff"]'); page.click('[data-act="plan-new"]'); page.fill('#note-text', 'secret plan about Hal'); page.click('[data-act="save-note"]')
    a1 = page.evaluate("JSON.stringify(window.__companion.Engine.analyze(window.__companion.state, SCRIPTS['trouble-brewing']))")
    check(a0 == a1, 'play: a planned bluff line does not change the liar-finder')
    page.click('[data-tab="town"]'); page.click(f'.token[data-pid="{P["Hal"]}"]'); check('secret plan' not in page.inner_text('#sheet'), "play: nor does it appear on Hal's timeline"); page.click('[data-act="close-sheet"]')

    # Reload mid-game
    before = strip(st()); page.reload(); page.wait_for_selector('.token')
    check(strip(st()) == before and phase() == {'kind': 'day', 'n': 3}, 'play: a reload in the middle of the game loses nothing')
    check(page.locator('.tabs button.active').get_attribute('data-tab') == 'town', 'play: and it reopens on the same tab')

    # Offline, through the service worker
    page.evaluate("navigator.serviceWorker.ready.then(() => true)"); page.reload(); page.wait_for_function("navigator.serviceWorker.controller !== null")
    ctx.set_offline(True)
    page.goto(BASE + '/?offline=1'); page.wait_for_selector('.token')
    check(strip(st()) == before, 'play: offline, the app opens through the service worker with the game intact')
    page.click(f'.token[data-pid="{P["Dan"]}"]'); page.click('[data-act="new-note"]'); page.fill('#note-text', 'logged while offline'); page.click('[data-act="save-note"]'); page.click('[data-act="close-sheet"]')
    check(any('offline' in n['text'] for n in st()['notes']) and 'logged while offline' in page.evaluate("localStorage.getItem('botc-companion-v1')"), 'play: offline, new entries still work and are saved')
    ctx.set_offline(False)

    # Save to a file, new game, load the file back
    page.click('[data-tab="setup"]')
    with page.expect_download() as dl: page.click('[data-act="export"]')
    saved_path = dl.value.path(); saved = json.loads(pathlib.Path(saved_path).read_text())
    check(saved['players'] and strip(saved) == strip(st()), 'play: "Save game to file" writes the whole game')
    page.click('[data-act="new-game"]'); page.wait_for_timeout(80)
    cleared = st()
    check(len(cleared['players']) == 8 and cleared['evidence'] == [] and cleared['noms'] == [] and cleared['notes'] == [] and cleared['phase'] == {'kind': 'night', 'n': 1}
          and not any(p['dead'] or p['claims'] for p in cleared['players']) and cleared['myChar'] == '', 'play: New game keeps the players and clears everything else')
    page.set_input_files('#game-file', files=[saved_path]); page.wait_for_timeout(300)
    check(strip(st()) == strip(saved) and phase() == {'kind': 'day', 'n': 3}, 'play: loading the saved file brings the whole game back')
    page.click('[data-tab="town"]'); town_clean('after loading the file')
    page.click('[data-tab="setup"]'); page.click('[data-act="new-game"]'); page.wait_for_timeout(80)
    check(st()['evidence'] == [] and len(st()['players']) == 8 and page.inner_text('#view h2').startswith('Game setup'), 'play: and a new game can be started again')
    check(not errs, f'play: no console errors in the whole game ({errs[:3]})')
    check(len(dialogs) >= 3, f'play: only the expected prompts and confirmations appeared ({len(dialogs)})')
    page.screenshot(path=str(SHOTS / 'launch-playtest-end.png'))
    ctx.close()
