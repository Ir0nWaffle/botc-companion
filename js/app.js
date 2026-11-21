// Clocktower Companion: UI and state. Everything is stored in this browser only.
(() => {
  const KEY = 'botc-companion-v1';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ── State ────────────────────────────────────────────────────────────────
  function freshState() {
    return { v: 3, scriptId: 'trouble-brewing', customScript: null, players: [], meId: null, myChar: '', myAlign: 'good',
      knownEvil: [], knownDemon: null, evilOverride: null, phase: { kind: 'night', n: 1 }, evidence: [], noms: [], notes: [], bluff: { demonBluffs: [], plan: [] }, gameOver: false, tab: 'setup' };
  }
  let state;
  try { state = Engine.sanitizeGame(JSON.parse(localStorage.getItem(KEY)), freshState()); } catch { state = freshState(); }
  let uiTab = state.players.length ? (state.tab === 'setup' ? 'town' : state.tab) : 'setup';
  let analysisCache = { key: null, value: null };
  // Which coaching expanders are open. In memory only: never saved, and never an undo step.
  const openCoach = new Set();
  const ckAttr = (key) => `data-ck="${esc(key)}" ${openCoach.has(key) ? 'open' : ''}`;
  document.addEventListener('toggle', (e) => {
    const k = e.target && e.target.dataset && e.target.dataset.ck;
    if (k) { if (e.target.open) openCoach.add(k); else openCoach.delete(k); }
  }, true);
  const sayHtml = (lines) => lines.map(l => `<div class="say-line">&ldquo;${esc(l)}&rdquo;</div>`).join('');
  function howHtml(c) {
    return `<div class="how">
      <div class="lbl">Say</div>${sayHtml(c.say)}
      <div class="lbl">Reveal</div><p>${esc(c.reveal)}</p>
      <div class="lbl">Prepare</div><p>${esc(c.prep)}</p>
      <div class="lbl risk">Risk</div><p>${esc(c.risk)}</p>
      ${c.generic ? '<p class="faint">General advice for this kind of character. There are no notes for this specific one.</p>' : ''}</div>`;
  }

  function save() { dropStaleUndo(); try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
  function commit() { save(); render(); }

  const script = () => (state.scriptId === 'custom' && state.customScript) ? state.customScript : (SCRIPTS[state.scriptId] || SCRIPTS['trouble-brewing']);
  const ci = (id) => Engine.charInfo(id, script());
  const player = (id) => state.players.find(p => p.id === id);
  const pname = (id) => (id === 'st' ? 'Storyteller / public' : (player(id) || {}).name || '?');
  const me = () => player(state.meId);
  const isEvilMe = () => state.myAlign === 'evil';

  const iconKeys = typeof CHARACTER_ICONS !== 'undefined' ? Object.keys(CHARACTER_ICONS) : [];
  const iconLower = Object.fromEntries(iconKeys.map(k => [k.toLowerCase(), k]));
  function icon(id) {
    if (!id) return '<span class="q">?</span>';
    const info = ci(id);
    const key = ICON_ALIAS[id] || iconLower[id.toLowerCase()] || id;
    try { return getCharacterIconSVG(key, info.team); } catch { return '<span class="q">?</span>'; }
  }

  function analysis() {
    const key = JSON.stringify([state.players, state.evidence, state.noms, state.notes, state.phase, state.meId, state.myAlign, state.myChar, state.knownEvil, state.knownDemon, state.evilOverride, state.scriptId, state.gameOver]);
    if (analysisCache.key !== key) analysisCache = { key, value: Engine.analyze(state, script()) };
    return analysisCache.value;
  }

  // One toast at a time. A toast with an Undo button stays for 6 seconds.
  let toastTimer = null;
  function hideToast() { clearTimeout(toastTimer); document.querySelectorAll('.toast').forEach(t => t.remove()); }
  function toast(msg, canUndo = false) {
    hideToast();
    const t = document.createElement('div'); t.className = 'toast' + (canUndo ? ' has-undo' : ''); t.setAttribute('role', 'status');
    const m = document.createElement('span'); m.className = 'toast-msg'; m.textContent = msg; t.appendChild(m);
    if (canUndo) { const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-undo'; b.dataset.act = 'undo'; b.textContent = 'Undo'; t.appendChild(b); }
    document.body.appendChild(t);
    toastTimer = setTimeout(() => t.remove(), canUndo ? 6000 : 1800);
  }

  // ── Undo ─────────────────────────────────────────────────────────────────
  // In-memory only: a bounded stack of JSON snapshots, kept outside `state` so it never reaches saves or exports.
  const UNDO_MAX = 30;
  const undoStack = [];
  let undoBase = null; // the game as it stood after the last undoable change
  const gameKey = () => JSON.stringify({ ...state, tab: null });
  // Restoring a snapshot would erase edits made since (typed notes, renamed players), so those end the undo history.
  function dropStaleUndo() {
    if (!undoStack.length || gameKey() === undoBase) return;
    undoStack.length = 0; undoBase = null;
    if (document.querySelector('.toast .toast-undo')) hideToast();
  }
  // Run a meaningful change; remember the exact prior state and offer Undo. Returns false if nothing changed.
  function record(msg, fn) {
    const before = JSON.stringify(state);
    fn();
    if (JSON.stringify(state) === before) return false;
    undoStack.push(before); if (undoStack.length > UNDO_MAX) undoStack.shift();
    undoBase = gameKey();
    toast(typeof msg === 'function' ? msg() : msg, true);
    return true;
  }
  function undo() {
    const snap = undoStack.pop(); if (!snap) return;
    state = JSON.parse(snap);
    undoBase = gameKey();
    closePicker(false);
    save();
    // Keep an open sheet only if what it shows still exists; otherwise drop it and its draft.
    const ok = (id) => !!player(id);
    let keep = true;
    if (sheetKind && sheetKind.startsWith('player:')) keep = ok(sheetKind.slice(7));
    else if (sheetKind === 'note') {
      const saved = noteDraft && noteDraft.plan ? state.bluff.plan : state.notes;
      keep = !!noteDraft && ok(noteDraft.player) && (!noteDraft.id || saved.some(n => n.id === noteDraft.id));
      if (keep) noteDraft.targets = noteDraft.targets.filter(ok);
    } else if (sheetKind === 'ev') {
      keep = !!draft && (draft.source === 'st' || ok(draft.source)) && (!draft.id || state.evidence.some(e => e.id === draft.id));
      if (keep) draft.players = draft.players.filter(ok);
    } else if (sheetKind === 'nom') {
      keep = !!nomDraft && (!nomDraft.id || state.noms.some(n => n.id === nomDraft.id));
      if (keep) { nomDraft.voters = nomDraft.voters.filter(ok); if (!ok(nomDraft.nominator)) nomDraft.nominator = ''; if (!ok(nomDraft.nominee)) nomDraft.nominee = ''; }
    }
    if (sheetKind && !keep) closeSheet(); else { render(); refreshSheet(); }
    toast('Undone', undoStack.length > 0);
  }

  // ── Shell ────────────────────────────────────────────────────────────────
  const wideScreen = window.matchMedia('(min-width: 900px)');
  const PHASE_ICON = {
    night: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>',
    day: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  };

  function render() {
    document.querySelectorAll('button[data-tab]').forEach((b) => {
      const on = b.dataset.tab === uiTab;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const ph = state.phase;
    $('#phase-chip').innerHTML = state.players.length
      ? `<span class="chip ${ph.kind}">${PHASE_ICON[ph.kind]} ${Engine.phaseLabel(ph)}</span><button class="btn small" data-act="next-phase" title="Advance to the next phase">Next ›</button>`
      : '';
    // On wide screens the town stays visible beside the active panel.
    const twoPane = wideScreen.matches && state.players.length > 0 && !['setup', 'guide'].includes(uiTab);
    const pane = $('#town-pane');
    pane.hidden = !twoPane;
    pane.innerHTML = twoPane ? viewTown() : '';
    document.body.classList.toggle('two-pane', twoPane);
    const panel = twoPane && uiTab === 'town' ? 'read' : uiTab;
    $('#view').innerHTML = ({ setup: viewSetup, town: viewTown, info: viewInfo, days: viewDays, read: viewRead, bluff: viewBluff, guide: viewGuide })[panel]();
    state.tab = uiTab; save();
  }
  wideScreen.addEventListener('change', () => render());

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    uiTab = b.dataset.tab; render(); window.scrollTo(0, 0);
  });

  function nextPhase() {
    record(() => 'Now ' + Engine.phaseLabel(state.phase), () => {
      const ph = state.phase;
      state.phase = ph.kind === 'night' ? { kind: 'day', n: ph.n } : { kind: 'night', n: ph.n + 1 };
    });
    commit();
  }
  function prevPhase() {
    const ph = state.phase;
    if (ph.kind === 'night' && ph.n === 1) return;
    record(() => 'Back to ' + Engine.phaseLabel(state.phase), () => { state.phase = ph.kind === 'day' ? { kind: 'night', n: ph.n } : { kind: 'day', n: ph.n - 1 }; });
    commit();
  }

  // ── Setup ────────────────────────────────────────────────────────────────
  function scriptOptions() {
    const opts = Object.entries(SCRIPTS).map(([id, s]) => `<option value="${id}" ${state.scriptId === id ? 'selected' : ''}>${esc(s.name)}</option>`);
    if (state.customScript) opts.push(`<option value="custom" ${state.scriptId === 'custom' ? 'selected' : ''}>${esc(state.customScript.name)} (custom)</option>`);
    return opts.join('');
  }
  // ── Character picker ─────────────────────────────────────────────────────
  // One reusable layer over whatever is open. It never touches the sheet underneath, so drafts survive.
  const INERT_SEL = '#sheet, #view, #town-pane, .tabs, .topbar';
  let pickerState = null;
  const normName = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  function syncLayer() { document.body.classList.toggle('layer-open', !$('#sheet').hidden || !$('#picker').hidden); }

  // The button that replaces a character <select>: shows the current choice, opens the picker.
  function pickField(id, key, blank, extra = '') {
    const c = id ? ci(id) : null;
    const off = c && !script().characters.includes(id);
    return `<button type="button" class="pick-field" id="${key}-btn" data-act="pick-open" data-for="${key}" data-pickkey="${key}" aria-haspopup="dialog" ${extra}>
      <span class="pf-ico">${icon(id)}</span>
      <span class="pf-nm ${c ? 'team-' + c.team : 'faint'}">${c ? esc(c.name) + (off ? ' <span class="faint">(not on script)</span>' : '') : esc(blank)}</span>
      <span class="pf-chev" aria-hidden="true">›</span></button>`;
  }

  function pickerListHtml() {
    const pk = pickerState, sc = script(), q = normName(pk.q);
    const cell = (c) => {
      const on = c.id === pk.selected;
      const by = state.players.filter(p => !pk.exclude.includes(p.id) && Engine.latestClaim(p) === c.id).map(p => p.name);
      const label = c.name + (by.length ? `, already claimed by ${by.join(', ')}` : '') + (on ? ', selected' : '');
      return `<button type="button" class="pick ${on ? 'on' : ''}" data-act="pick" data-char="${esc(c.id)}" aria-pressed="${on}" aria-label="${esc(label)}">
        <span class="pk-ico">${icon(c.id)}</span><span class="pk-nm team-${c.team}">${esc(c.name)}</span>
        ${by.length ? `<span class="pk-dup" title="${esc('Already claimed by ' + by.join(', '))}">${esc(by[0])}${by.length > 1 ? ' +' + (by.length - 1) : ''}</span>` : ''}</button>`;
    };
    const groupHtml = (chars) => {
      const g = {};
      chars.filter(c => !q || normName(c.name).includes(q)).forEach(c => { (g[c.team] = g[c.team] || []).push(c); });
      let n = 0, html = '';
      for (const t of TEAMS) if (g[t]) { n += g[t].length; html += `<h3 class="team-${t}">${TEAM_LABEL[t]}</h3><div class="pick-grid">${g[t].map(cell).join('')}</div>`; }
      return { html, n };
    };
    const on = groupHtml(sc.characters.map(ci));
    const offIds = Object.keys(CHARACTERS).filter(id => !sc.characters.includes(id));
    // A claim already outside the script and the base list (custom script leftovers) stays selectable.
    if (pk.selected && !sc.characters.includes(pk.selected) && !offIds.includes(pk.selected)) offIds.push(pk.selected);
    const off = groupHtml(offIds.map(ci));
    const selOff = !!pk.selected && offIds.includes(pk.selected);
    const open = pk.offOpen || selOff || (q && off.n > 0);
    return (on.n ? on.html : '') +
      (!on.n && !off.n ? `<p class="faint">No characters match "${esc(pk.q)}".</p>` : '') +
      `<details class="pick-off" ${open ? 'open' : ''}><summary>Not on this script <span class="faint">(${off.n})</span></summary>${off.html || '<p class="faint">No matches.</p>'}</details>`;
  }

  function openPicker(cfg) {
    pickerState = { q: '', offOpen: false, exclude: [], ...cfg };
    const pk = pickerState, el = $('#picker');
    el.innerHTML = `<div class="grab"></div><button type="button" class="btn small close" data-act="picker-close">Cancel</button>
      <h2 id="picker-title">${esc(pk.title)}</h2>
      <input type="text" id="picker-q" class="search" placeholder="Search characters…" aria-label="Search characters" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" data-input="picker-q">
      ${pk.allowClear ? `<button type="button" class="pick-none ${!pk.selected ? 'on' : ''}" data-act="pick" data-char="" aria-pressed="${!pk.selected}">${esc(pk.clearLabel || 'None')}</button>` : ''}
      <div id="picker-list">${pickerListHtml()}</div>`;
    el.hidden = false; $('#picker-backdrop').hidden = false; el.scrollTop = 0;
    document.querySelectorAll(INERT_SEL).forEach(n => { n.inert = true; });
    syncLayer();
    el.focus({ preventScroll: true }); // the panel, not the search box, so phones do not pop up the keyboard
  }
  function closePicker(refocus = true) {
    if (!pickerState) return;
    const key = pickerState.key; pickerState = null;
    $('#picker').hidden = true; $('#picker-backdrop').hidden = true; $('#picker').innerHTML = '';
    document.querySelectorAll(INERT_SEL).forEach(n => { n.inert = false; });
    syncLayer();
    if (refocus) focusPick(key);
  }
  function focusPick(key) { const t = document.querySelector(`[data-pickkey="${key}"]`); if (t) t.focus({ preventScroll: true }); }
  $('#picker-backdrop').addEventListener('click', () => closePicker());
  $('#picker').addEventListener('toggle', (e) => { if (pickerState && !pickerState.q && e.target.classList.contains('pick-off')) pickerState.offOpen = e.target.open; }, true);

  function applyPick(v) {
    const pk = pickerState; if (!pk) return;
    closePicker(false);
    if (pk.for === 'claim') {
      const p = player(pk.pid);
      if (p && (v || '') !== (Engine.latestClaim(p) || '')) {
        record(v ? `${p.name}: ${ci(v).name}` : `${p.name}: claim cleared`, () => { if (v) p.claims.push({ char: v, when: { ...state.phase } }); else p.claims = []; });
        commit(); refreshSheet();
      }
    } else if (pk.for === 'mychar') {
      if (v !== state.myChar) {
        record(v ? `You are the ${ci(v).name}` : 'Your character cleared', () => {
          state.myChar = v;
          const info = v ? ci(v) : null;
          if (info) state.myAlign = Engine.isEvilTeam(info.team) ? 'evil' : 'good';
        });
        commit();
      }
    } else if (pk.for === 'dbluff') {
      const next = state.bluff.demonBluffs.filter((c, i) => i !== pk.slot && c !== v);
      if (v) next.splice(Math.min(pk.slot, next.length), 0, v);
      record(v ? `Demon bluff: ${ci(v).name}` : 'Demon bluff cleared', () => { state.bluff.demonBluffs = next; });
      commit();
    } else if (pk.for === 'note' && noteDraft) { noteDraft.char = v; sheetNote(); }
    else if (pk.for === 'ev' && draft) { draft.char = v; sheetEvidence(); }
    focusPick(pk.key);
  }

  function viewSetup() {
    const R = Engine.ring(state);
    const s = Engine.setupFor(R.length);
    const myInfo = state.myChar ? ci(state.myChar) : null;
    return `
    <div class="card stack">
      <h2>Game setup</h2>
      <div>
        <label class="field" for="script-sel">Script</label>
        <div class="row"><select id="script-sel" class="grow" data-change="script">${scriptOptions()}</select>
        <button class="btn small" data-act="import-script">Import custom…</button></div>
        <input type="file" id="script-file" accept=".json,application/json" hidden>
      </div>
    </div>

    <div class="card">
      <div class="row between"><h2>Players <span class="faint">(${state.players.length})</span></h2>
        <button class="btn small" data-act="paste-players">Paste a list</button></div>
      <p class="faint" style="margin-top:0">Enter names in seating order, going clockwise. Seating matters for neighbour-based info like the Empath and Chef.</p>
      <ol class="plist">
        ${state.players.map((p, i) => `
          <li data-pid="${p.id}">
            <span class="seat">${i + 1}</span>
            <input type="text" value="${esc(p.name)}" data-input="pname" aria-label="Player ${i + 1} name">
            <button class="btn icon ${p.traveller ? 'primary' : ''}" data-act="toggle-trav" title="Traveller">T</button>
            <button class="btn icon" data-act="up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn icon" data-act="down" title="Move down" ${i === state.players.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn icon danger" data-act="del-player" title="Remove">✕</button>
          </li>`).join('')}
      </ol>
      <div class="row" style="margin-top:10px">
        <input type="text" id="new-player" class="grow" placeholder="Add a player…" style="flex:1 1 160px">
        <button class="btn primary" data-act="add-player">Add</button>
      </div>
      <p class="faint">Tap <span class="kbd">T</span> to mark a Traveller. Travellers aren't counted in the setup numbers.</p>
    </div>

    ${R.length ? `<div class="card">
      <h3>Expected characters for ${R.length} players${s.clamped ? ' <span class="faint">(base game supports 5–15)</span>' : ''}</h3>
      <div class="dist">
        <div><b class="team-townsfolk">${s.townsfolk}</b>Townsfolk</div><div><b class="team-outsider">${s.outsider}</b>Outsiders</div>
        <div><b class="team-minion">${s.minion}</b>Minion${s.minion > 1 ? 's' : ''}</div><div><b class="team-demon">1</b>Demon</div>
      </div>
      <div class="row" style="margin-top:10px"><label class="field grow" for="evil-ov" style="margin:0">Evil players for analysis (leave blank for the default)</label>
        <input type="number" id="evil-ov" min="1" max="8" style="width:80px" value="${state.evilOverride || ''}" placeholder="${s.minion + 1}" data-change="evil-ov"></div>
    </div>` : ''}

    <div class="card stack">
      <h2>You</h2>
      <div><label class="field" for="me-sel">Which player are you?</label>
        <select id="me-sel" data-change="me"><option value="">— choose —</option>${state.players.map(p => `<option value="${p.id}" ${state.meId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div><label class="field" for="mychar-btn">Your character (what the Storyteller showed you)</label>
        ${pickField(state.myChar, 'mychar', '— not told yet —')}</div>
      <div><label class="field">Your alignment</label>
        <div class="seg"><button data-act="align" data-v="good" class="${state.myAlign === 'good' ? 'on' : ''}">Good</button><button data-act="align" data-v="evil" class="${state.myAlign === 'evil' ? 'on' : ''}">Evil</button></div></div>
      ${myInfo ? `<div class="tip info"><b>${esc(myInfo.name)}</b>: ${esc(myInfo.ability)}<br><span class="muted">${esc(myInfo.play || (TEAM_TIPS[myInfo.team] || {}).play || '')}</span></div>` : ''}
      ${isEvilMe() ? `<div><label class="field">Your evil team (the Storyteller shows you this on night 1)</label>
        <div class="chips">${state.players.filter(p => p.id !== state.meId).map(p => `<button class="chip-btn ${state.knownEvil.includes(p.id) ? 'on' : ''}" data-act="known-evil" data-pid="${p.id}">${esc(p.name)}</button>`).join('')}</div>
        <label class="field" for="demon-sel" style="margin-top:8px">Who is the Demon?</label>
        <select id="demon-sel" data-change="known-demon"><option value="">— me / unknown —</option>${state.players.filter(p => p.id !== state.meId).map(p => `<option value="${p.id}" ${state.knownDemon === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>` : ''}
    </div>

    <div class="card stack">
      <h2>Game file</h2>
      <div class="row">
        <button class="btn" data-act="export">Save game to file</button>
        <button class="btn" data-act="import-game">Load game file</button>
        <input type="file" id="game-file" accept=".json,application/json" hidden>
        <button class="btn danger" data-act="new-game">New game</button>
      </div>
      <p class="faint">"New game" keeps the same players and seating but clears claims, info, deaths and votes. Everything is saved in this browser automatically.</p>
    </div>`;
  }

  // ── Town ─────────────────────────────────────────────────────────────────
  function ringColor(p) {
    if (p.id === state.meId) return 'var(--gold)';
    const a = analysis();
    if (!a || a.error || isEvilMe() || p.traveller) return 'var(--line-strong)';
    const e = a.players[p.id].evil;
    // blend blue (good) → grey → red (evil)
    const t = Math.max(0, Math.min(1, e));
    const lerp = (x, y, k) => Math.round(x + (y - x) * k);
    const [c1, c2] = t < a.prior ? [[110, 168, 254], [127, 136, 153]] : [[127, 136, 153], [240, 98, 93]];
    const k = t < a.prior ? t / a.prior : (t - a.prior) / (1 - a.prior);
    return `rgb(${lerp(c1[0], c2[0], k)},${lerp(c1[1], c2[1], k)},${lerp(c1[2], c2[2], k)})`;
  }

  function viewTown() {
    if (!state.players.length) return `<div class="card empty"><h2>No players yet</h2><p>Add the players in seating order on the Setup tab.</p><button class="btn primary" data-goto="setup">Go to setup</button></div>`;
    const N = state.players.length;
    const wrap = Math.min(wideScreen.matches ? (window.innerWidth - 88) * 0.52 : window.innerWidth - 24, 620);
    const tok = Math.round(Math.min(N <= 8 ? 76 : N <= 12 ? 64 : 54, wrap * (N <= 6 ? 0.19 : N <= 8 ? 0.155 : N <= 12 ? 0.13 : 0.105)));
    const a = analysis();
    const showPct = a && !a.error && !isEvilMe();
    const radius = 40;
    const tokens = state.players.map((p, i) => {
      const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
      const x = 50 + radius * Math.cos(ang), y = 50 + radius * Math.sin(ang);
      // The circle shows public claims only, so your true role isn't on display at the table.
      const claim = Engine.latestClaim(p);
      const info = claim ? ci(claim) : null;
      const pct = showPct && !p.traveller && p.id !== state.meId ? Math.round(a.players[p.id].evil * 100) : null;
      return `<button class="token ${p.dead ? 'dead' : ''}" data-act="open-player" data-pid="${p.id}" style="left:${x}%;top:${y}%;--ring:${ringColor(p)}">
        <span class="disc">${icon(claim)}${p.dead ? '<span class="shroud">DEAD</span>' : ''}</span>
        ${p.id === state.meId ? '<span class="me">YOU</span>' : ''}
        ${pct !== null ? `<span class="badge">${pct}%</span>` : ''}
        ${p.dead && !p.deadVoteUsed ? '<span class="ghost" title="Ghost vote available"></span>' : ''}
        <span class="nm">${esc(p.name)}</span>
        <span class="cl ${info ? 'team-' + info.team : ''}">${info ? esc(info.name) : (p.traveller ? 'Traveller' : '—')}</span>
      </button>`;
    }).join('');
    const alive = Engine.aliveCount(state);
    return `
      <div class="town-wrap" style="--tok:${tok}px">
        <div class="town-center">
          <div class="big">${Engine.phaseLabel(state.phase)}</div>
          <div class="muted">${alive} alive · ${Engine.votesNeeded(state)} votes to execute</div>
          <div class="row" style="justify-content:center;margin-top:8px">
            <button class="btn small" data-act="prev-phase" title="Back one phase">‹</button>
            <button class="btn small primary" data-act="next-phase">${state.phase.kind === 'night' ? 'Start day' : 'Start night'}</button>
          </div>
        </div>
        ${tokens}
      </div>
      ${showPct ? `<div class="legend"><span><i style="background:#6EA8FE"></i>looks good</span><span><i style="background:#7F8899"></i>unknown</span><span><i style="background:#F0625D"></i>looks evil</span><span><i style="background:#E9EDF5"></i>ghost vote left</span></div>` : ''}
      <p class="faint" style="text-align:center">Tap a player to record their claim, death, your read on them, or info they shared.</p>`;
  }

  function sheetPlayer(pid) {
    const p = player(pid); if (!p) return;
    const a = analysis();
    const claim = Engine.latestClaim(p);
    const info = claim ? ci(claim) : null;
    const isMe = p.id === state.meId;
    const res = a && !a.error && !isEvilMe() && !p.traveller ? a.players[p.id] : null;
    const gutLabels = { '-2': 'Trust', '-1': 'Lean good', '0': 'Unsure', '1': 'Lean evil', '2': 'Suspect' };
    openSheet(`
      <div class="grab"></div><button class="btn small close" data-act="close-sheet">Close</button>
      <h2>${esc(p.name)} ${isMe ? '<span class="faint">(you)</span>' : ''}</h2>
      ${res && !isMe ? `<p><span class="pct" style="color:${ringColor(p)}">${Math.round(res.evil * 100)}% evil</span> · <span class="muted">${Math.round(res.demon * 100)}% Demon</span></p>
        ${res.reasons.map(r => `<div class="reason"><span class="${r.delta > 0 ? 'up' : 'down'}">${r.delta > 0 ? '▲' : '▼'} ${Math.abs(Math.round(r.delta * 100))}</span> ${esc(r.label)}</div>`).join('')}` : ''}
      <div class="stack" style="margin-top:12px">
        ${isMe ? trueRoleCard(p) : ''}
        <div><label class="field" for="claim-btn">${isMe ? 'What you are telling the table' : 'What they claim to be'}</label>
          ${pickField(Engine.latestClaim(p), 'claim', '— no claim —', `data-pid="${p.id}"`)}
          ${p.claims.length > 1 ? `<div class="faint" style="margin-top:4px">Claim history: ${p.claims.map(c => `${esc(ci(c.char).name)} (${Engine.phaseLabel(c.when)})`).join(' → ')}. <b>Changing claims is a red flag</b>, unless a Barber, Pit-Hag or madness explains it.</div>` : ''}
          ${info ? `<div class="tip info" style="margin-top:8px"><b class="team-${info.team}">${esc(info.name)}</b>: ${esc(info.ability)}<br><span class="muted"><b>${isMe ? 'How others will judge this claim:' : 'If they claim this:'}</b> ${esc(info.spot || (TEAM_TIPS[info.team] || {}).spot || '')}</span></div>` : ''}
          ${promptsHtml(p)}
        </div>
        ${isMe ? '' : `<div><label class="field">Your read</label>
          <div class="seg even">${[-2, -1, 0, 1, 2].map(g => `<button data-act="gut" data-pid="${p.id}" data-v="${g}" class="${(p.gut || 0) === g ? 'on' : ''}">${gutLabels[g]}</button>`).join('')}</div>
          <div class="faint">Your read nudges the analysis slightly. Logged info counts for much more.</div></div>
        <div><label class="field">Lock (only if you're certain)</label>
          <div class="seg">${[['', 'None'], ['good', 'Confirmed good'], ['evil', 'Confirmed evil'], ['demon', 'Is the Demon'], ['notdemon', 'Not the Demon']].map(([v, l]) => `<button data-act="lock" data-pid="${p.id}" data-v="${v}" class="${(p.lock || '') === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`}
        <div><label class="field">Status</label>
          <div class="seg">
            <button data-act="death" data-pid="${p.id}" data-v="" class="${!p.dead ? 'on' : ''}">Alive</button>
            <button data-act="death" data-pid="${p.id}" data-v="night" class="${p.dead && p.death && p.death.how === 'night' ? 'on' : ''}">Died at night</button>
            <button data-act="death" data-pid="${p.id}" data-v="execution" class="${p.dead && p.death && p.death.how === 'execution' ? 'on' : ''}">Executed</button>
            <button data-act="death" data-pid="${p.id}" data-v="other" class="${p.dead && p.death && p.death.how === 'other' ? 'on' : ''}">Died (other)</button>
          </div>
          ${p.dead ? `<div class="row" style="margin-top:8px"><span class="faint">Died ${esc(Engine.phaseLabel(p.death && p.death.when))}</span>
            <button class="btn small ${p.deadVoteUsed ? '' : 'primary'}" data-act="ghost" data-pid="${p.id}">${p.deadVoteUsed ? 'Ghost vote used' : 'Ghost vote available'}</button></div>` : ''}
        </div>
        <div><label class="field" for="pnotes">Notes</label><textarea id="pnotes" data-input="pnotes" data-pid="${p.id}" placeholder="${isMe ? 'Your plan, suspicions, things to remember…' : 'What did they tell you? Who do they defend?'}">${esc(p.notes || '')}</textarea></div>
        <div class="row"><button class="btn primary" data-act="log-from" data-pid="${p.id}">Log info ${isMe ? 'you' : esc(p.name)} learned</button>
          ${isMe ? '' : `<button class="btn" data-act="log-about" data-pid="${p.id}">Log info about ${esc(p.name)}</button>`}
          <button class="btn" data-act="new-note" data-pid="${p.id}">+ Add to timeline</button></div>
        ${timelineHtml(p.id)}
      </div>`);
  }

  function trueRoleCard(p) {
    const real = state.myChar ? ci(state.myChar) : null;
    const cover = Engine.latestClaim(p);
    const status = !cover ? 'No public claim yet'
      : cover === state.myChar ? 'Telling the truth'
      : `Bluffing as <b class="team-${ci(cover).team}">${esc(ci(cover).name)}</b>`;
    return `<div class="truth-card">
      <div class="row between"><span class="faint">Your true role · private</span><button class="btn small" data-goto="setup">Change</button></div>
      <div><b class="${real ? 'team-' + real.team : ''}">${real ? esc(real.name) : 'Not set'}</b> <span class="muted">· ${isEvilMe() ? 'Evil' : 'Good'}</span></div>
      <div class="muted">${status}</div>
    </div>`;
  }

  // ── Timeline ─────────────────────────────────────────────────────────────
  const NOTE_KINDS = [['did', 'Did'], ['learned', 'Learned / saw'], ['said', 'Said']];

  function noteText(n) {
    const who = (n.targets || []).map(id => `<b>${esc(pname(id))}</b>`).join(', ');
    const c = n.char ? `<b class="team-${ci(n.char).team}">${esc(ci(n.char).name)}</b>` : '';
    const detail = [who, c].filter(Boolean).join(' · ');
    return `${detail ? `<div>${detail}</div>` : ''}${n.text ? `<div class="muted">${esc(n.text)}</div>` : ''}`;
  }

  function timelineItem(it, pid) {
    const row = (title, body = '', attrs = '') => `<div class="tl-item" ${attrs}><div class="tl-title">${title}</div>${body}</div>`;
    if (it.type === 'claim') return row(`Claimed <b class="team-${ci(it.char).team}">${esc(ci(it.char).name)}</b>`);
    if (it.type === 'death') return row(`<b class="team-demon">${it.how === 'execution' ? 'Executed' : it.how === 'night' ? 'Died at night' : 'Died'}</b>`);
    if (it.type === 'nom') {
      const label = it.role === 'nominated' ? `Nominated <b>${esc(pname(it.nom.nominee))}</b>`
        : it.role === 'nominee' ? `Nominated by <b>${esc(pname(it.nom.nominator))}</b> · ${it.nom.votes} vote${it.nom.votes === 1 ? '' : 's'}`
        : `Voted for <b>${esc(pname(it.nom.nominee))}</b>`;
      return row(label);
    }
    if (it.type === 'info') {
      const title = it.role === 'source' ? 'Shared info' : `Mentioned by ${esc(pname(it.ev.source))}`;
      return row(title, `<div>${describe(it.ev)}</div>${it.ev.text ? `<div class="muted">${esc(it.ev.text)}</div>` : ''}`, `data-act="edit-ev" data-eid="${it.ev.id}" role="button" tabindex="0"`);
    }
    const n = it.note;
    const kind = (NOTE_KINDS.find(k => k[0] === n.kind) || NOTE_KINDS[2])[1];
    const by = it.mentioned ? `${esc(pname(n.player))} · ` : '';
    const badge = n.player === state.meId && pid === state.meId
      ? `<span class="story ${n.story === 'true' ? 'private' : 'public'}">${n.story === 'true' ? 'Private truth' : 'Told the table'}</span>` : '';
    return row(`${by}${kind} ${badge}`, noteText(n), `data-act="edit-note" data-noteid="${n.id}" role="button" tabindex="0"`);
  }

  function timelineHtml(pid) {
    const items = Engine.timeline(state, pid);
    if (!items.length) return '';
    const groups = [];
    items.forEach((it) => {
      const label = Engine.phaseLabel(it.when);
      if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
      groups[groups.length - 1].items.push(it);
    });
    return `<div class="timeline"><label class="field">Timeline</label>${groups.map(g => `<div class="tl-phase"><div class="tl-label">${esc(g.label)}</div>${g.items.map(it => timelineItem(it, pid)).join('')}</div>`).join('')}</div>`;
  }

  let noteDraft = null;
  function phaseList() {
    const out = [];
    for (let n = 1; n <= state.phase.n; n++) { out.push({ kind: 'night', n }); if (n < state.phase.n || state.phase.kind === 'day') out.push({ kind: 'day', n }); }
    return out;
  }
  function sheetNote() {
    const d = noteDraft;
    const isMe = d.player === state.meId;
    const phases = phaseList();
    if (d.plan) { // A story can be prepared a few phases ahead.
      let next = { ...state.phase };
      for (let i = 0; i < 4; i++) { next = next.kind === 'night' ? { kind: 'day', n: next.n } : { kind: 'night', n: next.n + 1 }; phases.push(next); }
    }
    if (!phases.some(ph => ph.kind === d.when.kind && ph.n === d.when.n)) phases.push(d.when);
    phases.sort((a, b) => Engine.phaseRank(a) - Engine.phaseRank(b));
    openSheet(`
      <div class="grab"></div><button class="btn small close" data-act="cancel-note">Back</button>
      <h2>${d.plan ? (d.id ? 'Edit planned line' : 'Plan a story line') : `${d.id ? 'Edit' : 'Add to'} ${isMe ? 'your' : esc(pname(d.player)) + '\'s'} timeline`}</h2>
      <div class="stack">
        ${d.plan ? '<div class="faint">Private until you mark it as told.</div>' : ''}
        ${isMe && !d.plan ? `<div><label class="field">Is this what really happened?</label>
          <div class="seg"><button data-act="note-story" data-v="true" class="${d.story === 'true' ? 'on' : ''}">Private truth</button><button data-act="note-story" data-v="public" class="${d.story === 'public' ? 'on' : ''}">What I told the table</button></div></div>` : ''}
        <div><label class="field" for="note-when">When</label><select id="note-when" data-note="when">${phases.map(ph => `<option value="${ph.kind}:${ph.n}" ${d.when.kind === ph.kind && d.when.n === ph.n ? 'selected' : ''}>${Engine.phaseLabel(ph)}</option>`).join('')}</select></div>
        <div><label class="field">${isMe ? 'What kind of note?' : 'What are they claiming?'}</label>
          <div class="seg">${NOTE_KINDS.map(([v, l]) => `<button data-act="note-kind" data-v="${v}" class="${d.kind === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div><label class="field">Which players? <span class="faint">(optional)</span></label>
          <div class="chips">${state.players.filter(p => p.id !== d.player).map(p => `<button class="chip-btn ${p.dead ? 'dead' : ''} ${d.targets.includes(p.id) ? 'on' : ''}" data-act="note-target" data-pid="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>
        <div><label class="field" for="note-btn">Character <span class="faint">(optional)</span></label>${pickField(d.char, 'note', '— none —')}</div>
        <div><label class="field" for="note-text">Details</label><textarea id="note-text" data-note="text" placeholder="e.g. Protected Ben last night, saw a 1 on the Empath…">${esc(d.text)}</textarea></div>
        <div class="row"><button class="btn primary" data-act="save-note">Save</button>${d.id ? '<button class="btn danger" data-act="del-note">Delete</button>' : '<button class="btn" data-act="save-note" data-more="1">Save &amp; add another</button>'}</div>
      </div>`);
  }
  function backToPlayer(pid) { noteDraft = null; draft = null; evReturn = null; sheetKind = 'player:' + pid; sheetPlayer(pid); }
  let noteReturn = false; // true when the note form was opened from the Bluff tab rather than a player's sheet
  function leaveNote(pid) { if (noteReturn) closeSheet(); else backToPlayer(pid); }

  // ── Bluff Studio ─────────────────────────────────────────────────────────
  function bluffStoryHtml() {
    const planned = state.bluff.plan.map(n => ({ n, planned: true }));
    const told = state.notes.filter(n => n.player === state.meId && n.story === 'public').map(n => ({ n, planned: false }));
    const all = [...told, ...planned].sort((a, b) => Engine.phaseRank(a.n.when) - Engine.phaseRank(b.n.when));
    if (!all.length) return '<div class="empty">No story yet. Plan what you will say before someone asks.</div>';
    const groups = [];
    all.forEach((x) => {
      const label = Engine.phaseLabel(x.n.when);
      if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
      groups[groups.length - 1].items.push(x);
    });
    const kindName = (n) => (NOTE_KINDS.find(k => k[0] === n.kind) || NOTE_KINDS[2])[1];
    return groups.map(g => `<div class="tl-phase"><div class="tl-label">${esc(g.label)}</div>${g.items.map(({ n, planned }) => `
      <div class="tl-item story-line" data-act="${planned ? 'plan-edit' : 'edit-note'}" ${planned ? `data-planid="${n.id}"` : `data-noteid="${n.id}"`} role="button" tabindex="0">
        <div class="tl-title">${kindName(n)} <span class="story ${planned ? 'planned' : 'public'}">${planned ? 'Planned' : 'Told the table'}</span></div>
        ${noteText(n)}
        ${planned ? `<button type="button" class="btn small" data-act="plan-told" data-planid="${n.id}">Mark as told</button>` : ''}
      </div>`).join('')}</div>`).join('');
  }

  function viewBluff() {
    if (!state.players.length) return `<div class="card empty"><p>Add players on the Setup tab first.</p><button class="btn primary" data-goto="setup">Go to setup</button></div>`;
    const m = me();
    if (!m) return `<div class="card empty"><h2>Bluff Studio</h2><p>Choose which player you are first.</p><button class="btn primary" data-goto="setup">Go to setup</button></div>`;
    const sc = script();
    const real = state.myChar ? ci(state.myChar) : null;
    const cover = Engine.latestClaim(m);
    const coverInfo = cover ? ci(cover) : null;
    const check = Engine.bluffCheck(state, sc);
    const options = Engine.bluffOptions(state, sc);
    const tipClass = { bad: 'warn', warn: 'caution', info: 'info', good: 'good' };
    const issues = check.issues.filter(i => i.level !== 'good');
    const status = !cover ? '<div class="tip info">Pick a bluff below, or set your public claim, and this will check it against the game.</div>'
      : !check.isBluff ? '<div class="tip good">You are telling the truth about your role, so there is nothing to keep straight.</div>'
      : `${check.issues.filter(i => i.level === 'good').map(i => `<div class="tip good">${esc(i.text)}</div>`).join('')}
         ${issues.length ? issues.map(i => `<div class="tip ${tipClass[i.level]}">${esc(i.text)}</div>`).join('') : '<div class="tip good">No conflicts with anything logged so far.</div>'}`;
    const coachExpander = (id) => {
      const c = Engine.coachFor(id, sc);
      return c ? `<details class="coach-x" ${ckAttr('opt:' + id)}><summary>Coaching</summary><p><b>Why:</b> ${esc(c.pitch)}</p><p><b>Watch for:</b> ${esc(c.risk)}</p></details>` : '';
    };
    const optionCard = (o) => `<div class="bluff-opt">
      <span class="pk-ico">${icon(o.id)}</span>
      <div class="grow"><div class="row between"><b class="team-${o.team}">${esc(o.name)}</b><span class="rating ${o.rating}">${{ strong: 'Strong', okay: 'Okay', risky: 'Risky' }[o.rating]}</span></div>
        <div class="faint">${esc(o.ability)}</div>
        <ul class="why">${o.reasons.map(r => `<li class="${r.good ? 'up' : 'down'}">${esc(r.text)}</li>`).join('')}</ul>
        ${coachExpander(o.id)}
        <button type="button" class="btn small ${o.id === cover ? '' : 'primary'}" data-act="use-bluff" data-char="${esc(o.id)}" ${o.id === cover ? 'disabled' : ''}>${o.id === cover ? 'Your current claim' : 'Use this bluff'}</button>
      </div></div>`;
    const myTeam = real ? real.team : '';
    return `
      <div class="card stack">
        <div class="row between"><h2 style="margin:0">Bluff Studio</h2><span class="story private">Private</span></div>
        <div class="truth-card"><span class="faint">Your true role</span><div><b class="${real ? 'team-' + real.team : ''}">${real ? esc(real.name) : 'Not set'}</b> <span class="muted">· ${isEvilMe() ? 'Evil' : 'Good'}</span></div></div>
        <div><label class="field" for="claim-btn">What you are telling the table</label>${pickField(cover, 'claim', '— no claim —', `data-pid="${m.id}"`)}</div>
        ${coverInfo && check.isBluff ? `<div class="faint"><b class="team-${coverInfo.team}">${esc(coverInfo.name)}</b>: ${esc(coverInfo.ability)}</div>` : ''}
      </div>
      ${coachCardHtml(check, cover, coverInfo, sc)}
      <div class="card"><h3>Story check</h3>${status}</div>
      ${isEvilMe() ? `<div class="card"><h3>The Demon's 3 bluffs</h3>
        <p class="faint" style="margin-top:0">${myTeam === 'demon' ? 'The Storyteller shows you these on Night 1. They are not in play, so they are your safest claims.' : 'If your Demon shares them, record them here. They are not in play, so they are the safest claims.'}</p>
        <div class="stack">${[0, 1, 2].map(i => pickField(state.bluff.demonBluffs[i] || '', `dbluff-${i}`, `Bluff ${i + 1}`)).join('')}</div></div>` : ''}
      <div class="card">
        <div class="row between"><h3 style="margin:0">Your story</h3><button class="btn small primary" data-act="plan-new">+ Plan a line</button></div>
        <p class="faint">Plan what you will say, then mark it as told. Planned lines stay private and never reach the liar-finder.</p>
        ${bluffStoryHtml()}
      </div>
      <div class="card"><h3>Best bluffs right now</h3>
        ${options.slice(0, 5).map(optionCard).join('') || '<div class="empty">No good characters left to claim.</div>'}
        ${options.length > 5 ? `<details class="pick-off"><summary>All other characters <span class="faint">(${options.length - 5})</span></summary>${options.slice(5).map(optionCard).join('')}</details>` : ''}
      </div>
      <div class="card"><details class="rule flat" ${ckAttr('basics')}><summary>Bluffing basics</summary>
        <ol class="basics">${BLUFF_BASICS.map(b => `<li><b>${esc(b.title)}.</b> ${esc(b.text)}</li>`).join('')}</ol></details></div>`;
  }

  function coachCardHtml(check, cover, coverInfo, sc) {
    const cls = { bad: 'warn', warn: 'caution', info: 'info', good: 'good' };
    const items = Engine.coachNow(state, sc);
    const evilNote = isEvilMe() && state.myChar ? Engine.evilCoachFor(state.myChar) : null;
    const how = cover && check.isBluff ? Engine.coachFor(cover, sc) : null;
    return `<div class="card" id="coach-card"><h3>What to do now</h3>
        ${items.map(i => `<div class="tip coach ${cls[i.level] || 'info'}"><b>${esc(i.title)}</b> ${esc(i.text)}</div>`).join('')}
        ${evilNote ? `<div class="evil-note"><div class="lbl">As the ${esc(ci(state.myChar).name)}</div>${evilNote.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
      </div>
      ${how ? `<div class="card" id="how-card"><h3>How to play this bluff: ${esc(coverInfo.name)}</h3>${howHtml(how)}</div>` : ''}`;
  }

  // ── Info log ─────────────────────────────────────────────────────────────
  const TEMPLATES = [
    { id: 'empath', label: 'Empath: evil neighbours', chars: ['empath'], type: 'evilCount', fields: { players: 2, n: [0, 2] }, auto: 'neighbours' },
    { id: 'chef', label: 'Chef: pairs of evil neighbours', chars: ['chef'], type: 'chef', fields: { n: [0, 4] } },
    { id: 'ping', label: '"One of these two is the …" (Washerwoman, Librarian, Investigator)', chars: ['washerwoman', 'librarian', 'investigator'], type: 'oneIs', fields: { players: 2, char: true } },
    { id: 'fortune', label: 'Fortune Teller: is either a Demon?', chars: ['fortuneteller'], type: 'ft', fields: { players: 2, yes: ['Yes', 'No'] } },
    { id: 'ischar', label: '"This player is the …" (Undertaker, Ravenkeeper, Grandmother, Gambler…)', chars: ['undertaker', 'ravenkeeper', 'grandmother', 'gambler', 'juggler', 'dreamer'], type: 'isChar', fields: { players: 1, char: true } },
    { id: 'slayer', label: 'Slayer shot and the target lived', chars: ['slayer'], type: 'notDemon', fields: { players: 1 } },
    { id: 'clock', label: 'Clockmaker: steps from Demon to Minion', chars: ['clockmaker'], type: 'clockmaker', fields: { n: [1, 7] } },
    { id: 'seam', label: 'Seamstress: same alignment?', chars: ['seamstress'], type: 'same', fields: { players: 2, same: true } },
    { id: 'oracle', label: 'Oracle: evil players among the dead', chars: ['oracle'], type: 'evilCount', fields: { players: 99, n: [0, 6] }, auto: 'dead' },
    { id: 'sage', label: 'Sage: the Demon is one of these 2', chars: ['sage'], type: 'demonAmong', fields: { players: 2 }, fixed: { yes: true } },
    { id: 'flower', label: 'Flowergirl: did the Demon vote today?', chars: ['flowergirl'], type: 'demonVoted', fields: { day: true, yes: ['Yes', 'No'] } },
    { id: 'crier', label: 'Town Crier: did a Minion nominate today?', chars: ['towncrier'], type: 'minionNominated', fields: { day: true, yes: ['Yes', 'No'] } },
    { id: 'align', label: 'A player is good / evil', chars: [], type: 'align', fields: { players: 1, evil: true } },
    { id: 'count', label: 'N of these players are evil', chars: [], type: 'evilCount', fields: { players: 99, n: [0, 6] } },
    { id: 'among', label: 'The Demon is / isn\'t one of these', chars: ['exorcist'], type: 'demonAmong', fields: { players: 99, yes: ['Is among them', 'Is not among them'] } },
    { id: 'note', label: 'Just a note (no logic)', chars: ['savant', 'artist', 'mathematician', 'chambermaid'], type: 'note', fields: {} },
  ];
  // Quick prompts per role: what you would actually ask or record. `tpl` opens the structured info form (it feeds
  // the solver); otherwise a timeline note opens with `kind` and a starter `text`. For a templated role, `kind`/`text`
  // are the note used instead when you are bluffing (a fake story must never become evidence).
  // `mine` prompts only show on your own sheet. Abilities follow js/data.js.
  const Q = (them, you, o) => ({ them, you, ...o });
  const ROLE_PROMPTS = {
    // Trouble Brewing
    washerwoman: [Q('Which two players were they shown, and as what?', 'Which two players were you shown, and as what?', { tpl: 'ping', kind: 'learned', text: 'Washerwoman ping: ' })],
    librarian: [Q('Which two players were they shown, and as what?', 'Which two players were you shown, and as what?', { tpl: 'ping', kind: 'learned', text: 'Librarian ping: ' }),
      Q('Were they told there are no Outsiders?', 'Were you told there are no Outsiders?', { kind: 'learned', text: 'Learned there are no Outsiders in play' })],
    investigator: [Q('Which two players were they shown, and as what?', 'Which two players were you shown, and as what?', { tpl: 'ping', kind: 'learned', text: 'Investigator ping: ' })],
    chef: [Q('What number did they get?', 'What number did you get?', { tpl: 'chef', kind: 'learned', text: 'Chef number: ' })],
    empath: [Q('What number did they get?', 'What number did you get?', { tpl: 'empath', kind: 'learned', text: 'Empath number: ' })],
    fortuneteller: [Q('Who did they check, and what result?', 'Who did you check, and what result?', { tpl: 'fortune', kind: 'learned', text: 'Fortune Teller checked: ' })],
    undertaker: [Q('Who did they see executed?', 'Who did you see executed?', { tpl: 'ischar', kind: 'learned', text: 'Saw executed: ' })],
    monk: [Q('Who did they protect?', 'Who did you protect?', { kind: 'did', text: 'Protected' })],
    ravenkeeper: [Q('Who did they look at, and what did they see?', 'Who did you look at, and what did you see?', { tpl: 'ischar', kind: 'learned', text: 'Ravenkeeper saw: ' })],
    virgin: [Q('Who nominated them, and what happened?', 'Who nominated you, and what happened?', { kind: 'learned', text: 'Nominated by' })],
    slayer: [Q('Who did they shoot?', 'Who did you shoot?', { tpl: 'slayer', kind: 'did', text: 'Shot' })],
    soldier: [Q('Did they survive a Demon attack?', 'Did you survive a Demon attack?', { kind: 'said', text: 'Survived an attack' })],
    mayor: [Q('Did a night death bounce off them?', 'Did a night death bounce off you?', { kind: 'said', text: 'Someone else died instead' })],
    butler: [Q('Who did they choose as master?', 'Who did you choose as master?', { kind: 'did', text: 'Chose as master' })],
    poisoner: [Q('', 'Who did you poison?', { mine: 1, kind: 'did', text: 'Poisoned' })],
    imp: [Q('', 'Who did you choose to kill?', { mine: 1, kind: 'did', text: 'Chose to kill' })],
    // Bad Moon Rising
    grandmother: [Q('Who is their grandchild, and what character?', 'Who is your grandchild, and what character?', { tpl: 'ischar', kind: 'learned', text: 'Grandchild: ' })],
    sailor: [Q('Who did they choose?', 'Who did you choose?', { kind: 'did', text: 'Chose' })],
    chambermaid: [Q('Who did they check, and how many woke?', 'Who did you check, and how many woke?', { tpl: 'note', kind: 'learned', text: 'Chambermaid: checked ___, number who woke: ' })],
    exorcist: [Q('Who did they choose?', 'Who did you choose?', { kind: 'did', text: 'Chose' })],
    innkeeper: [Q('Which two players did they pick?', 'Which two players did you pick?', { kind: 'did', text: 'Picked two' })],
    gambler: [Q('Who did they guess, and as what?', 'Who did you guess, and as what?', { kind: 'did', text: 'Guessed' })],
    gossip: [Q('What was their public statement?', 'What was your public statement?', { kind: 'said', text: 'Statement: ' })],
    courtier: [Q('Which character did they choose?', 'Which character did you choose?', { kind: 'did', text: 'Made drunk' })],
    professor: [Q('Who did they try to revive?', 'Who did you try to revive?', { kind: 'did', text: 'Chose to revive' })],
    moonchild: [Q('Who did they choose?', 'Who did you choose?', { kind: 'did', text: 'Chose after dying' })],
    lunatic: [Q('Who did they choose?', 'Who did you choose?', { kind: 'did', text: 'Chose' })],
    godfather: [Q('', 'Who did you kill?', { mine: 1, kind: 'did', text: 'Killed' })],
    devilsadvocate: [Q('', 'Who did you protect?', { mine: 1, kind: 'did', text: 'Protected from execution' })],
    assassin: [Q('', 'Who did you kill?', { mine: 1, kind: 'did', text: 'Killed' })],
    zombuul: [Q('', 'Who did you choose to kill?', { mine: 1, kind: 'did', text: 'Chose to kill' })],
    pukka: [Q('', 'Who did you poison?', { mine: 1, kind: 'did', text: 'Poisoned' })],
    shabaloth: [Q('', 'Which two players did you choose?', { mine: 1, kind: 'did', text: 'Chose to kill' })],
    po: [Q('', 'Who did you choose?', { mine: 1, kind: 'did', text: 'Chose to kill' })],
    // Sects & Violets
    clockmaker: [Q('What number did they get?', 'What number did you get?', { tpl: 'clock', kind: 'learned', text: 'Clockmaker number: ' })],
    dreamer: [Q('Who did they check, and which two characters?', 'Who did you check, and which two characters?', { kind: 'learned', text: 'Dreamer checked ___, saw: ' })],
    snakecharmer: [Q('Who did they choose?', 'Who did you choose?', { kind: 'did', text: 'Chose' })],
    mathematician: [Q('What number did they get?', 'What number did you get?', { tpl: 'note', kind: 'learned', text: 'Mathematician number: ' })],
    flowergirl: [Q('Did the Demon vote today?', 'Did the Demon vote today?', { tpl: 'flower', kind: 'learned', text: 'Flowergirl: the Demon voted? ' })],
    towncrier: [Q('Did a Minion nominate today?', 'Did a Minion nominate today?', { tpl: 'crier', kind: 'learned', text: 'Town Crier: a Minion nominated? ' })],
    oracle: [Q('How many dead players are evil?', 'How many dead players are evil?', { tpl: 'oracle', kind: 'learned', text: 'Oracle number: ' })],
    savant: [Q('What two things were they told?', 'What two things were you told?', { tpl: 'note', kind: 'learned', text: 'Savant was told: ' })],
    seamstress: [Q('Who did they check, and same or different?', 'Who did you check, and same or different?', { tpl: 'seam', kind: 'learned', text: 'Seamstress checked: ' })],
    philosopher: [Q('Which character did they choose?', 'Which character did you choose?', { kind: 'did', text: 'Chose the' })],
    artist: [Q('What did they ask, and what was the answer?', 'What did you ask, and what was the answer?', { tpl: 'note', kind: 'learned', text: 'Asked: ' })],
    juggler: [Q('What did they guess, and how many were right?', 'What did you guess, and how many were right?', { kind: 'said', text: 'Juggler guesses: ' })],
    sage: [Q('Which two players were they told?', 'Which two players were you told?', { tpl: 'sage', kind: 'learned', text: 'Sage was told: ' })],
    klutz: [Q('Who did they choose?', 'Who did you choose?', { kind: 'did', text: 'Chose after dying' })],
    witch: [Q('', 'Who did you curse?', { mine: 1, kind: 'did', text: 'Cursed' })],
    cerenovus: [Q('', 'Who did you make mad, as what?', { mine: 1, kind: 'did', text: 'Made mad' })],
    pithag: [Q('', 'Who did you change, into what?', { mine: 1, kind: 'did', text: 'Changed' })],
    fanggu: [Q('', 'Who did you choose to kill?', { mine: 1, kind: 'did', text: 'Chose to kill' })],
    vigormortis: [Q('', 'Who did you choose to kill?', { mine: 1, kind: 'did', text: 'Chose to kill' })],
    nodashii: [Q('', 'Who did you choose to kill?', { mine: 1, kind: 'did', text: 'Chose to kill' })],
    vortox: [Q('', 'Who did you choose to kill?', { mine: 1, kind: 'did', text: 'Chose to kill' })],
  };

  // Which role the prompts on a player's sheet follow. On your own sheet they follow what you told the table
  // when it differs from your true role (bluff), and then they only ever make public notes.
  function promptsFor(p) {
    const isMe = p.id === state.meId;
    const claim = Engine.latestClaim(p);
    let role = claim, bluff = false;
    if (isMe) {
      if (claim && claim !== state.myChar) bluff = true;
      else role = state.myChar || claim;
    }
    if (!role) return null;
    const items = (ROLE_PROMPTS[role] || []).filter(it => !it.mine || (isMe && !bluff));
    return items.length ? { role, bluff, isMe, items } : null;
  }
  function promptsHtml(p) {
    const info = promptsFor(p); if (!info) return '';
    return `<div class="prompts"><label class="field">Quick log${info.bluff ? ' <span class="faint">· saved as what you told the table</span>' : ''}</label>
      ${info.items.map((it, i) => `<button type="button" class="prompt" data-act="prompt" data-pid="${p.id}" data-i="${i}"><span>${esc(info.isMe ? it.you : it.them)}</span><span aria-hidden="true">›</span></button>`).join('')}</div>`;
  }
  function runPrompt(pid, i) {
    const p = player(pid), info = p && promptsFor(p), it = info && info.items[i]; if (!it) return;
    if (it.tpl && !info.bluff) {
      newDraft(pid, null); draft.template = it.tpl; if (it.tpl === 'note') draft.text = it.text; applyAuto();
      openEv(pid);
    } else {
      noteDraft = { id: null, player: pid, when: { ...state.phase }, kind: it.kind, targets: [], char: '', text: it.text,
        story: info.isMe ? (info.bluff ? 'public' : 'true') : 'public' };
      sheetKind = 'note'; sheetNote();
    }
  }

  let evReturn = null; // the player's sheet to go back to after the info form
  function openEv(returnPid) { evReturn = returnPid && player(returnPid) ? returnPid : null; sheetKind = 'ev'; sheetEvidence(); }
  function leaveEv() {
    const r = evReturn; draft = null; evReturn = null;
    if (r && player(r)) { sheetKind = 'player:' + r; sheetPlayer(r); render(); } else closeSheet();
  }

  let draft = null;

  function aliveNeighbours(pid) {
    const R = state.players.filter(p => !p.traveller);
    const i = R.findIndex(p => p.id === pid); if (i < 0) return [];
    const out = [];
    for (let d = 1; d < R.length && out.length < 1; d++) { const q = R[(i - d + R.length) % R.length]; if (!q.dead && q.id !== pid) out.push(q.id); }
    for (let d = 1; d < R.length && out.length < 2; d++) { const q = R[(i + d) % R.length]; if (!q.dead && q.id !== pid && !out.includes(q.id)) out.push(q.id); }
    return out;
  }

  function templateForSource(pid) {
    const p = player(pid);
    const c = p ? Engine.claimOf(state, p) : null;
    return TEMPLATES.find(t => c && t.chars.includes(c)) || TEMPLATES.find(t => t.id === 'align');
  }

  function newDraft(source, about) {
    const t = source ? templateForSource(source) : TEMPLATES.find(x => x.id === 'align');
    draft = { id: null, source: source || state.meId || 'st', when: { ...state.phase }, template: t.id, players: about ? [about] : [], n: 0, char: '', yes: true, same: true, evil: true, day: state.phase.n, text: '' };
    applyAuto();
  }
  function applyAuto() {
    const t = TEMPLATES.find(x => x.id === draft.template);
    if (t.auto === 'neighbours' && draft.source && draft.source !== 'st') draft.players = aliveNeighbours(draft.source);
    if (t.auto === 'dead') draft.players = state.players.filter(p => p.dead).map(p => p.id);
    if (t.fields.players && draft.players.length > t.fields.players) draft.players = draft.players.slice(0, t.fields.players);
    if (t.fields.n && (draft.n < t.fields.n[0] || draft.n > t.fields.n[1])) draft.n = t.fields.n[0];
  }

  function sheetEvidence() {
    const t = TEMPLATES.find(x => x.id === draft.template);
    const f = t.fields;
    const sourceOpts = `<option value="st" ${draft.source === 'st' ? 'selected' : ''}>Storyteller / public fact</option>` +
      state.players.map(p => `<option value="${p.id}" ${draft.source === p.id ? 'selected' : ''}>${esc(p.name)}${p.id === state.meId ? ' (you)' : ''}${Engine.latestClaim(p) ? ' · ' + esc(ci(Engine.latestClaim(p)).name) : ''}</option>`).join('');
    const sc = new Set(script().characters);
    const relevant = TEMPLATES.filter(x => !x.chars.length || x.chars.some(c => sc.has(c)) || x.id === draft.template);
    const others = TEMPLATES.filter(x => !relevant.includes(x));
    const tplOpt = (x) => `<option value="${x.id}" ${x.id === draft.template ? 'selected' : ''}>${esc(x.label)}</option>`;
    const phases = []; for (let n = 1; n <= Math.max(state.phase.n, 1); n++) { phases.push({ kind: 'night', n }); if (n < state.phase.n || state.phase.kind === 'day') phases.push({ kind: 'day', n }); }
    openSheet(`
      <div class="grab"></div><button class="btn small close" data-act="cancel-ev">${evReturn ? 'Back' : 'Cancel'}</button>
      <h2>${draft.id ? 'Edit info' : 'Log info'}</h2>
      <div class="stack">
        <div><label class="field" for="ev-src">Who learned / said this?</label><select id="ev-src" data-draft="source">${sourceOpts}</select>
          <div class="faint">If the source turns out evil, the app stops trusting this info, so always record who said it.</div></div>
        <div class="row">
          <div class="grow"><label class="field" for="ev-when">When</label><select id="ev-when" data-draft="when">${phases.map(ph => `<option value="${ph.kind}:${ph.n}" ${draft.when.kind === ph.kind && draft.when.n === ph.n ? 'selected' : ''}>${Engine.phaseLabel(ph)}</option>`).join('')}</select></div>
        </div>
        <div><label class="field" for="ev-tpl">Kind of info</label><select id="ev-tpl" data-draft="template">${relevant.map(tplOpt).join('')}${others.length ? `<optgroup label="Other scripts">${others.map(tplOpt).join('')}</optgroup>` : ''}</select></div>
        ${f.players ? `<div><label class="field">${f.players === 1 ? 'Which player?' : f.players === 2 ? 'Which two players?' : 'Which players?'}</label>
          <div class="chips">${state.players.map(p => `<button class="chip-btn ${p.dead ? 'dead' : ''} ${draft.players.includes(p.id) ? 'on' : ''}" data-act="draft-player" data-pid="${p.id}">${esc(p.name)}</button>`).join('')}</div>
          ${t.auto === 'neighbours' ? '<div class="faint">Filled in with the source\'s alive neighbours. Adjust if needed.</div>' : ''}</div>` : ''}
        ${f.n ? `<div><label class="field">Number</label><div class="seg">${Array.from({ length: f.n[1] - f.n[0] + 1 }, (_, k) => f.n[0] + k).map(v => `<button data-act="draft-n" data-v="${v}" class="${draft.n === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>` : ''}
        ${f.char ? `<div><label class="field" for="ev-btn">Character</label>${pickField(draft.char, 'ev', '— choose —')}</div>` : ''}
        ${f.yes ? `<div><label class="field">Result</label><div class="seg"><button data-act="draft-yes" data-v="1" class="${draft.yes ? 'on' : ''}">${f.yes[0]}</button><button data-act="draft-yes" data-v="0" class="${!draft.yes ? 'on' : ''}">${f.yes[1]}</button></div></div>` : ''}
        ${f.same ? `<div><label class="field">Result</label><div class="seg"><button data-act="draft-same" data-v="1" class="${draft.same ? 'on' : ''}">Same alignment</button><button data-act="draft-same" data-v="0" class="${!draft.same ? 'on' : ''}">Different</button></div></div>` : ''}
        ${f.evil ? `<div><label class="field">Alignment</label><div class="seg"><button data-act="draft-evil" data-v="0" class="${!draft.evil ? 'on' : ''}">Good</button><button data-act="draft-evil" data-v="1" class="${draft.evil ? 'on' : ''}">Evil</button></div></div>` : ''}
        ${f.day ? `<div><label class="field" for="ev-day">Which day?</label><input type="number" id="ev-day" min="1" value="${draft.day}" data-draft="day" style="width:90px">
          <div class="faint">Uses the nominations and votes you logged on the Votes tab for that day.</div></div>` : ''}
        <div><label class="field" for="ev-text">Note (optional)</label><textarea id="ev-text" data-draft="text" placeholder="Exact wording, context…">${esc(draft.text)}</textarea></div>
        <div class="row"><button class="btn primary" data-act="save-draft">Save</button>
          ${draft.id ? '<button class="btn danger" data-act="del-draft">Delete</button>' : '<button class="btn" data-act="save-draft" data-more="1">Save &amp; add another</button>'}</div>
      </div>`);
  }

  function describe(ev) {
    const t = TEMPLATES.find(x => x.id === ev.template) || {};
    const ps = (ev.players || []).map(id => `<b>${esc(pname(id))}</b>`);
    const c = ev.char ? `<b class="team-${ci(ev.char).team}">${esc(ci(ev.char).name)}</b>` : '?';
    switch (ev.type) {
      case 'evilCount': return t.id === 'empath' ? `Empath: <b>${ev.n}</b> evil among neighbours ${ps.join(' & ')}` : `<b>${ev.n}</b> evil among ${ps.join(', ') || 'nobody'}`;
      case 'chef': return `Chef: <b>${ev.n}</b> pair(s) of evil neighbours`;
      case 'clockmaker': return `Clockmaker: <b>${ev.n}</b> step(s) from Demon to nearest Minion`;
      case 'oneIs': return `One of ${ps.join(' / ')} is the ${c}`;
      case 'isChar': return `${ps[0] || '?'} is the ${c}`;
      case 'ft': return `Fortune Teller on ${ps.join(' & ')}: <b>${ev.yes ? 'YES' : 'no'}</b>`;
      case 'notDemon': return `Slayer shot ${ps[0] || '?'}: nothing happened (not the Demon)`;
      case 'same': return `${ps.join(' & ')} are <b>${ev.same ? 'the same' : 'different'}</b> alignment${ev.same ? '' : 's'}`;
      case 'align': return `${ps[0] || '?'} is <b>${ev.evil ? 'evil' : 'good'}</b>`;
      case 'demonAmong': return `The Demon <b>${ev.yes ? 'is' : 'is not'}</b> among ${ps.join(', ')}`;
      case 'demonVoted': return `Flowergirl: the Demon <b>${ev.yes ? 'voted' : 'did not vote'}</b> on day ${ev.day}`;
      case 'minionNominated': return `Town Crier: a Minion <b>${ev.yes ? 'nominated' : 'did not nominate'}</b> on day ${ev.day}`;
      default: return 'Note';
    }
  }

  function entryHtml(ev) {
    const srcP = player(ev.source);
    const srcClaim = srcP ? Engine.latestClaim(srcP) : null;
    return `<div class="entry" data-act="edit-ev" data-eid="${ev.id}" style="cursor:pointer">
      <div class="meta">${esc(Engine.phaseLabel(ev.when))} · from ${esc(pname(ev.source))}${srcClaim ? ' (' + esc(ci(srcClaim).name) + ')' : ''}</div>
      <div>${describe(ev)}</div>${ev.text ? `<div class="muted" style="font-size:.88em">${esc(ev.text)}</div>` : ''}</div>`;
  }

  function viewInfo() {
    if (!state.players.length) return `<div class="card empty"><p>Add players on the Setup tab first.</p><button class="btn primary" data-goto="setup">Go to setup</button></div>`;
    const list = [...state.evidence].sort((a, b) => (b.when.n * 2 + (b.when.kind === 'day')) - (a.when.n * 2 + (a.when.kind === 'day')));
    return `
      <div class="card">
        <div class="row between"><h2>Info log</h2><button class="btn primary" data-act="new-ev">+ Log info</button></div>
        <p class="faint" style="margin-top:0">Record everything you learn and everything other players tell you about their info, with who said it.
        The "Who's lying?" tab checks which stories can all be true together.</p>
      </div>
      ${list.length ? list.map(entryHtml).join('') : '<div class="empty">Nothing logged yet. After night 1, log what you learned and what others say they learned.</div>'}`;
  }

  // ── Votes / days ─────────────────────────────────────────────────────────
  let nomDraft = null;
  function viewDays() {
    if (!state.players.length) return `<div class="card empty"><p>Add players on the Setup tab first.</p><button class="btn primary" data-goto="setup">Go to setup</button></div>`;
    const alive = Engine.aliveCount(state);
    const days = [...new Set(state.noms.map(n => n.day))].sort((a, b) => b - a);
    const deadToday = state.players.filter(p => p.dead && p.death && p.death.when && p.death.when.n === state.phase.n);
    return `
      <div class="card">
        <h2>${Engine.phaseLabel(state.phase)}</h2>
        <p style="margin:0">${alive} alive → <b>${Engine.votesNeeded(state)} votes</b> needed to put someone on the block (and more than any other nominee today).</p>
      </div>
      <div class="card">
        <h3>Who died?</h3>
        <p class="faint" style="margin-top:0">Tap players who died last night. Executions are recorded from the nominations below.</p>
        <div class="chips">${state.players.map(p => `<button class="chip-btn ${p.dead ? 'on' : ''}" data-act="quick-death" data-pid="${p.id}">${esc(p.name)}${p.dead ? ' ✝' : ''}</button>`).join('')}</div>
        ${deadToday.length ? `<p class="faint">${deadToday.map(p => `${esc(p.name)} (${p.death.how === 'execution' ? 'executed' : p.death.how === 'night' ? 'night death' : 'died'})`).join(', ')}</p>` : ''}
      </div>
      <div class="card">
        <div class="row between"><h3>Nominations</h3><button class="btn primary" data-act="new-nom">+ Nomination</button></div>
        <p class="faint" style="margin-top:0">Logging who voted helps catch evil players protecting their Demon, and it is needed for Flowergirl and Town Crier info.</p>
        ${days.length ? days.map(d => `<h3 style="margin-top:10px">Day ${d}</h3>
          <table class="simple"><tr><th>Nominator</th><th>Nominee</th><th>Votes</th><th></th></tr>
          ${state.noms.filter(n => n.day === d).map(n => `<tr data-act="edit-nom" data-nid="${n.id}" style="cursor:pointer">
            <td>${esc(pname(n.nominator))}</td><td>${esc(pname(n.nominee))}${n.executed ? ' <b class="team-demon">✝ executed</b>' : ''}</td>
            <td>${n.votes}${n.voters && n.voters.length ? `<div class="faint">${n.voters.map(pname).map(esc).join(', ')}</div>` : ''}</td><td>›</td></tr>`).join('')}
          </table>`).join('') : '<div class="empty">No nominations logged yet.</div>'}
      </div>`;
  }

  function sheetNom() {
    const d = nomDraft;
    const alive = state.players.filter(p => !p.dead);
    openSheet(`
      <div class="grab"></div><button class="btn small close" data-act="close-sheet">Cancel</button>
      <h2>${d.id ? 'Edit nomination' : 'New nomination'} · Day ${d.day}</h2>
      <div class="stack">
        <div class="row">
          <div class="grow"><label class="field" for="nom-a">Nominator</label><select id="nom-a" data-nom="nominator"><option value="">—</option>${(d.id ? state.players : alive).map(p => `<option value="${p.id}" ${d.nominator === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
          <div class="grow"><label class="field" for="nom-b">Nominee</label><select id="nom-b" data-nom="nominee"><option value="">—</option>${state.players.map(p => `<option value="${p.id}" ${d.nominee === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        </div>
        <div><label class="field">Who voted? <span class="faint">(dead players use their ghost vote)</span></label>
          <div class="chips">${state.players.map(p => `<button class="chip-btn ${p.dead ? 'dead' : ''} ${d.voters.includes(p.id) ? 'on' : ''}" data-act="nom-voter" data-pid="${p.id}" ${p.dead && p.deadVoteUsed && !d.voters.includes(p.id) ? 'disabled title="Ghost vote already used"' : ''}>${esc(p.name)}</button>`).join('')}</div>
          <div class="row" style="margin-top:6px"><span class="faint">Total votes:</span> <input type="number" min="0" id="nom-votes" data-nom="votes" value="${d.votes}" style="width:80px">
          <span class="faint">Needed: ${Engine.votesNeeded(state)}</span></div></div>
        <div><button class="chip-btn ${d.executed ? 'on' : ''}" data-act="nom-exec">${d.executed ? '✝ Executed' : 'Mark as executed'}</button></div>
        <div class="row"><button class="btn primary" data-act="save-nom">Save</button>${d.id ? '<button class="btn danger" data-act="del-nom">Delete</button>' : ''}</div>
      </div>`);
  }

  // ── Who's lying? ─────────────────────────────────────────────────────────
  function viewRead() {
    if (!state.players.length) return `<div class="card empty"><p>Add players on the Setup tab first.</p><button class="btn primary" data-goto="setup">Go to setup</button></div>`;
    const sc = script();
    const a = analysis();
    const tips = Engine.tips(state, sc, a);
    const tipsHtml = tips.map(t => `<div class="tip ${t.level}">${t.text}</div>`).join('');
    if (isEvilMe()) {
      return `<div class="card"><h2>You're evil</h2><p class="muted">You already know your team, so use the Bluff Studio to choose a cover and keep your story straight.</p>
        <button class="btn primary" data-goto="bluff">Open Bluff Studio</button></div>
        <div class="card"><h3>Table talk</h3>${tipsHtml}</div>`;
    }
    if (a.error) return `<div class="card"><h2>Who's lying?</h2><div class="tip warn">${esc(a.error)}</div></div><div class="card"><h3>Tips</h3>${tipsHtml}</div>`;
    const ranked = Engine.ring(state).filter(p => p.id !== state.meId).map(p => ({ p, ...a.players[p.id] })).sort((x, y) => y.evil - x.evil);
    const bar = (v, color) => `<div class="bar"><span style="width:${Math.round(v * 100)}%;background:${color}"></span><span class="prior" style="left:${Math.round(a.prior * 100)}%"></span></div>`;
    return `
      <div class="card">
        <h2>Who's lying?</h2>
        <p class="faint" style="margin-top:0">${a.evilCount} evil players. Checked ${a.worldCount.toLocaleString()} possible teams against ${a.factorCount} clue${a.factorCount === 1 ? '' : 's'}. The grey tick marks the starting chance before any clues (${Math.round(a.prior * 100)}%).</p>
        ${a.vortox !== null && a.vortox !== undefined ? `<div class="tip ${a.vortox >= 0.4 ? 'warn' : 'info'}"><b>Vortox chance: ${Math.round(a.vortox * 100)}%.</b> ${a.vortox > 0 ? 'If it is in play, all Townsfolk info is false.' : 'Ruled out for now.'}</div>` : ''}
        ${ranked.map(r => {
          const claim = Engine.claimOf(state, r.p);
          return `<div class="suspect" data-act="open-player" data-pid="${r.p.id}" style="cursor:pointer">
            <div class="row between"><span><b>${esc(r.p.name)}</b> ${claim ? `<span class="team-${ci(claim).team}">${esc(ci(claim).name)}</span>` : '<span class="faint">no claim</span>'}${r.p.dead ? ' <span class="faint">✝</span>' : ''}</span>
              <span><span class="pct" style="color:${ringColor(r.p)}">${Math.round(r.evil * 100)}% evil</span> <span class="faint">· ${Math.round(r.demon * 100)}% Demon</span></span></div>
            ${bar(r.evil, ringColor(r.p))}
            ${r.reasons.slice(0, 2).map(x => `<div class="reason"><span class="${x.delta > 0 ? 'up' : 'down'}">${x.delta > 0 ? '▲' : '▼'}${Math.abs(Math.round(x.delta * 100))}</span> ${esc(x.label)}</div>`).join('')}
          </div>`;
        }).join('')}
      </div>
      ${a.factorCount ? `<div class="card"><h3>Most likely evil teams</h3>
        ${a.topTeams.map(t => `<div class="tip info"><span class="pct">${Math.round(t.p * 100)}%</span> · ${t.members.map(id => id === t.demon ? `<b class="team-demon">${esc(pname(id))} (Demon?)</b>` : esc(pname(id))).join(', ')}</div>`).join('')}
      </div>` : ''}
      <div class="card"><h3>Tips</h3>${tipsHtml}</div>
      <details class="rule"><summary>How does this work?</summary><ul>
        <li>The app lists every way the evil team could be seated (with ${a.evilCount} evil players), and every choice of who is the Demon.</li>
        <li>Each player's info is checked in each possible world as <b>one story</b>. Evil players may say anything. A good player is usually right, but a drunk or poisoned player can be wrong about everything at once, so three wrong clues from one person don't count three times against them.</li>
        <li>Claims count too: double claims, characters not on the script, changed claims, and stories that break their role's rules or don't fit public events, like a Monk whose protected player died that night.</li>
        <li><b>Demon %</b> means who holds the Demon <b>now</b>. If the likely starting Demon died and the game went on, that chance moves to their living teammates (star-pass or Scarlet Woman). Older Demon clues aren't applied after that point.</li>
        <li>On scripts with the <b>Vortox</b>, the app also tests worlds where all Townsfolk info is false. A day with no execution rules it out.</li>
        <li>The percentage is the share of the remaining likely worlds where that player is evil. ▲/▼ shows which clue moved it most.</li>
        <li>It only knows what you tell it, and it can't model everything, such as Pit-Hag changes, alignment swaps or Storyteller choices. Treat it as a second opinion, not the answer.</li>
      </ul></details>`;
  }

  // ── Guide ────────────────────────────────────────────────────────────────
  let guideFilter = '';
  function charCard(c, open = false, ns = '') {
    const how = Engine.coachFor(c.id, script());
    const tips = { play: c.play || (TEAM_TIPS[c.team] || {}).play, spot: c.spot || (TEAM_TIPS[c.team] || {}).spot };
    return `<details class="char" ${open ? 'open' : ''}><summary><span class="ico">${icon(c.id)}</span><span class="grow"><b class="team-${c.team}">${esc(c.name)}</b><div class="ab">${esc(c.ability)}</div></span></summary>
      <div class="body">${tips.play ? `<p><b>If you are the ${esc(c.name)}:</b> ${esc(tips.play)}</p>` : ''}${tips.spot ? `<p><b>If someone claims it:</b> ${esc(tips.spot)}</p>` : ''}</div>
      ${how ? `<details class="coach-x in-guide" ${ckAttr('guide:' + ns + c.id)}><summary>How to bluff this</summary>${howHtml(how)}</details>` : ''}</details>`;
  }
  function viewGuide() {
    const sc = script();
    const q = guideFilter.toLowerCase();
    const chars = sc.characters.map(ci).filter(c => !q || c.name.toLowerCase().includes(q) || (c.ability || '').toLowerCase().includes(q));
    const mine = state.myChar ? ci(state.myChar) : null;
    return `
      ${mine ? `<h2>Your character</h2>${charCard(mine, true, 'mine:')}` : ''}
      <h2>${esc(sc.name)}</h2>
      <input type="text" class="search" placeholder="Search characters…" value="${esc(guideFilter)}" data-input="guide-filter">
      ${TEAMS.filter(t => chars.some(c => c.team === t)).map(t => `<h3 class="team-${t}" style="margin-top:14px">${TEAM_LABEL[t]}</h3>${chars.filter(c => c.team === t).map(c => charCard(c)).join('')}`).join('')}
      <h2 style="margin-top:20px">Rules & tips</h2>
      ${RULES.map(r => `<details class="rule"><summary>${esc(r.title)}</summary><ul>${r.body.map(b => `<li>${b}</li>`).join('')}</ul></details>`).join('')}
      <details class="rule"><summary>Setup by player count</summary>
        <table class="simple"><tr><th>Players</th><th class="team-townsfolk">TF</th><th class="team-outsider">Out</th><th class="team-minion">Min</th><th class="team-demon">Dem</th></tr>
        ${Object.entries(SETUP_TABLE).map(([n, r]) => `<tr><td>${n}</td>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</table><p class="faint">Travellers are extra, on top of these numbers.</p></details>
      <p class="faint">Ability text follows the official <a href="https://wiki.bloodontheclocktower.com/" target="_blank" rel="noopener">Blood on the Clocktower wiki</a>. This is an unofficial fan tool. Blood on the Clocktower is a game by The Pandemonium Institute.</p>`;
  }

  // ── Sheet helpers ────────────────────────────────────────────────────────
  let sheetKind = null;
  function openSheet(html) {
    const s = $('#sheet'); const keep = s.hidden ? 0 : s.scrollTop;
    s.innerHTML = html; s.hidden = false; $('#sheet-backdrop').hidden = false; s.scrollTop = keep; syncLayer();
  }
  function closeSheet() { closePicker(false); $('#sheet').hidden = true; $('#sheet-backdrop').hidden = true; sheetKind = null; draft = null; nomDraft = null; noteDraft = null; evReturn = null; noteReturn = false; syncLayer(); render(); }
  $('#sheet-backdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (pickerState) { closePicker(); e.preventDefault(); } // only the picker; the form underneath keeps its draft
    else if (!$('#sheet').hidden) closeSheet();
  });
  function refreshSheet() {
    if (sheetKind && sheetKind.startsWith('player:')) sheetPlayer(sheetKind.slice(7));
    else if (sheetKind === 'ev') sheetEvidence();
    else if (sheetKind === 'nom') sheetNom();
    else if (sheetKind === 'note') sheetNote();
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  function setDeath(p, how) {
    if (!how) { p.dead = false; p.death = null; p.deadVoteUsed = false; }
    else {
      // A night death noticed during the day happened the night before that day.
      const when = how === 'night' ? { kind: 'night', n: state.phase.n } : { ...state.phase };
      p.dead = true; p.death = { how, when };
    }
  }

  // Was this player already dead when votes were cast on the given day?
  function deadDuring(q, day) {
    if (!q || !q.dead) return false;
    if (!q.death || !q.death.when) return true;
    const w = q.death.when;
    return w.n < day || (w.n === day && w.kind === 'night');
  }
  function ghostVoteElsewhere(voterId, nomId) {
    const q = player(voterId);
    return state.noms.some(n => n.id !== nomId && (n.voters || []).includes(voterId) && deadDuring(q, n.day));
  }
  function refundGhostVote(voterId, nom) {
    const q = player(voterId);
    if (deadDuring(q, nom.day) && !ghostVoteElsewhere(voterId, nom.id)) q.deadVoteUsed = false;
  }
  // Undo the death caused by this nomination, leaving any other kind of death alone.
  function undoExecution(nom) {
    const q = player(nom.nominee);
    if (q && q.dead && q.death && q.death.how === 'execution' && q.death.when && q.death.when.n === nom.day) setDeath(q, '');
  }

  function parseCustomScript(json) {
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const known = Object.create(null);
    Object.keys(CHARACTERS).forEach(k => { known[norm(k)] = k; });
    const extra = Object.create(null);
    Object.entries(EXTRA_CHARACTERS).forEach(([k, v]) => { extra[norm(k)] = v; });
    let name = 'Custom script', entries = [];
    if (Array.isArray(json)) {
      json.forEach(e => {
        if (e && typeof e === 'object' && e.id === '_meta') { name = e.name || name; return; }
        entries.push(e);
      });
    } else if (json && Array.isArray(json.characters)) { name = json.name || name; entries = json.characters; }
    else throw new Error('Expected a script JSON (an array of character ids, or {name, characters}).');
    const ids = [], custom = {};
    for (const e of entries) {
      const raw = typeof e === 'string' ? e : e && e.id; if (!raw) continue;
      const n = norm(raw);
      if (known[n]) { ids.push(known[n]); continue; }
      if (!Engine.safeId(n)) continue;
      const obj = typeof e === 'object' ? e : {};
      const ex = extra[n] || {};
      const team = TEAMS.includes(obj.team) ? obj.team : (ex.team || 'townsfolk');
      if (team === 'fabled') continue;
      custom[n] = { name: obj.name || ex.name || raw, team, ability: obj.ability || ex.ability || '' };
      ids.push(n);
    }
    if (ids.length < 5) throw new Error('That script has fewer than 5 characters I could read.');
    return { id: 'custom', name, characters: ids, custom };
  }

  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) { uiTab = g.dataset.goto; if ($('#sheet').hidden) render(); else closeSheet(); return; }
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act; const pid = el.dataset.pid || (el.closest('[data-pid]') || {}).dataset?.pid;
    const p = pid ? player(pid) : null;
    switch (act) {
      case 'next-phase': nextPhase(); break;
      case 'prev-phase': prevPhase(); break;
      case 'add-player': {
        const inp = $('#new-player'); const name = inp.value.trim(); if (!name) { inp.focus(); return; }
        state.players.push({ id: uid(), name, traveller: false, claims: [], dead: false, death: null, deadVoteUsed: false, gut: 0, lock: '', notes: '' });
        commit(); $('#new-player').focus(); break;
      }
      case 'paste-players': {
        const txt = prompt('Paste player names in seating order (one per line, or comma-separated):'); if (!txt) return;
        txt.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).forEach(name => state.players.push({ id: uid(), name, traveller: false, claims: [], dead: false, death: null, deadVoteUsed: false, gut: 0, lock: '', notes: '' }));
        commit(); break;
      }
      case 'del-player': {
        if (!confirm(`Remove ${p.name}? Info that mentions them will be removed too.`)) return;
        record(`Removed ${p.name}`, () => {
          state.players = state.players.filter(x => x.id !== pid);
          state.evidence = state.evidence.filter(ev => ev.source !== pid && !(ev.players || []).includes(pid));
          state.noms = state.noms.filter(n => n.nominator !== pid && n.nominee !== pid).map(n => ({ ...n, voters: (n.voters || []).filter(v => v !== pid) }));
          state.notes = state.notes.filter(n => n.player !== pid).map(n => ({ ...n, targets: n.targets.filter(t => t !== pid) }));
          state.bluff.plan = state.meId === pid ? [] : state.bluff.plan.map(n => ({ ...n, targets: n.targets.filter(t => t !== pid) }));
          if (state.meId === pid) state.meId = null;
          state.knownEvil = state.knownEvil.filter(x => x !== pid);
        });
        commit(); break;
      }
      case 'up': case 'down': {
        const i = state.players.findIndex(x => x.id === pid); const j = act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= state.players.length) return;
        [state.players[i], state.players[j]] = [state.players[j], state.players[i]]; commit(); break;
      }
      case 'toggle-trav': p.traveller = !p.traveller; commit(); break;
      case 'align': state.myAlign = el.dataset.v; commit(); break;
      case 'known-evil': state.knownEvil = state.knownEvil.includes(pid) ? state.knownEvil.filter(x => x !== pid) : [...state.knownEvil, pid]; commit(); break;
      case 'import-script': $('#script-file').click(); break;
      case 'export': download(`clocktower-game-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 1)); break;
      case 'import-game': $('#game-file').click(); break;
      case 'new-game': {
        if (!confirm('Start a new game? Players and seating are kept. Claims, info, deaths and votes are cleared.')) return;
        record('New game started', () => {
          const keep = state.players.map(x => ({ id: x.id, name: x.name, traveller: false, claims: [], dead: false, death: null, deadVoteUsed: false, gut: 0, lock: '', notes: '' }));
          state = Object.assign(freshState(), { players: keep, meId: state.meId, scriptId: state.scriptId, customScript: state.customScript });
        });
        uiTab = 'setup'; commit(); break;
      }
      case 'open-player': sheetKind = 'player:' + pid; sheetPlayer(pid); break;
      case 'close-sheet': closeSheet(); break;
      case 'gut': record(`${p.name}: read updated`, () => { p.gut = Number(el.dataset.v); }); save(); refreshSheet(); break;
      case 'lock': record(`${p.name}: lock updated`, () => { p.lock = el.dataset.v; }); save(); refreshSheet(); break;
      case 'death':
        record(() => `${p.name}: ${p.dead ? (p.death.how === 'night' ? 'died at night' : p.death.how === 'execution' ? 'executed' : 'died') : 'alive'}`, () => setDeath(p, el.dataset.v));
        commit(); refreshSheet(); break;
      case 'ghost': record(() => `${p.name}: ghost vote ${p.deadVoteUsed ? 'used' : 'available'}`, () => { p.deadVoteUsed = !p.deadVoteUsed; }); save(); refreshSheet(); break;
      case 'log-from': newDraft(pid, null); openEv(pid); break;
      case 'log-about': newDraft(null, pid); openEv(pid); break;
      case 'new-ev': newDraft(state.meId, null); openEv(null); break;
      case 'edit-ev': {
        const ev = state.evidence.find(x => x.id === el.dataset.eid); if (!ev) return;
        const from = sheetKind && sheetKind.startsWith('player:') ? sheetKind.slice(7) : null;
        draft = JSON.parse(JSON.stringify(ev)); openEv(from); break;
      }
      case 'cancel-ev': leaveEv(); break;
      case 'prompt': runPrompt(pid, Number(el.dataset.i)); break;
      case 'pick-open': {
        const f = el.dataset.for;
        if (f === 'claim' && p) openPicker({ key: f, for: f, pid, selected: Engine.latestClaim(p) || '', allowClear: true, clearLabel: 'No claim', exclude: [pid],
          title: pid === state.meId ? 'What you are telling the table' : `What does ${p.name} claim?` });
        else if (f === 'mychar') openPicker({ key: f, for: f, selected: state.myChar || '', allowClear: true, clearLabel: 'Not told yet', exclude: [state.meId], title: 'Your character' });
        else if (f === 'note' && noteDraft) openPicker({ key: f, for: f, selected: noteDraft.char || '', allowClear: true, clearLabel: 'No character', exclude: [noteDraft.player], title: 'Which character?' });
        else if (f === 'ev' && draft) openPicker({ key: f, for: f, selected: draft.char || '', allowClear: false, title: 'Which character?' });
        else if (f && f.startsWith('dbluff-')) {
          const slot = Number(f.slice(7));
          openPicker({ key: f, for: 'dbluff', slot, selected: state.bluff.demonBluffs[slot] || '', allowClear: true, clearLabel: 'No bluff', exclude: [state.meId], title: `Demon bluff ${slot + 1}` });
        }
        break;
      }
      case 'pick': applyPick(el.dataset.char); break;
      case 'picker-close': closePicker(); break;
      case 'undo': undo(); break;
      case 'draft-player': {
        const t = TEMPLATES.find(x => x.id === draft.template); const max = t.fields.players || 0;
        if (draft.players.includes(pid)) draft.players = draft.players.filter(x => x !== pid);
        else { draft.players.push(pid); if (draft.players.length > max) draft.players.shift(); }
        sheetEvidence(); break;
      }
      case 'draft-n': draft.n = Number(el.dataset.v); sheetEvidence(); break;
      case 'draft-yes': draft.yes = el.dataset.v === '1'; sheetEvidence(); break;
      case 'draft-same': draft.same = el.dataset.v === '1'; sheetEvidence(); break;
      case 'draft-evil': draft.evil = el.dataset.v === '1'; sheetEvidence(); break;
      case 'save-draft': {
        const t = TEMPLATES.find(x => x.id === draft.template);
        if (t.fields.players && t.fields.players <= 2 && draft.players.length !== t.fields.players) { alert(`Pick ${t.fields.players} player${t.fields.players > 1 ? 's' : ''}.`); return; }
        if (t.fields.char && !draft.char) { alert('Pick a character.'); return; }
        const ev = { ...draft, type: t.type, ...(t.fixed || {}) };
        record('Info saved', () => { if (!ev.id) { ev.id = uid(); state.evidence.push(ev); } else state.evidence = state.evidence.map(x => (x.id === ev.id ? ev : x)); });
        save();
        if (el.dataset.more === '1') {
          // Same source, kind and time; everything else starts blank.
          const prev = draft;
          draft = { id: null, source: prev.source, when: { ...prev.when }, template: prev.template, players: [], n: 0, char: '', yes: true, same: true, evil: true, day: prev.day, text: '' };
          applyAuto(); sheetEvidence();
        } else leaveEv();
        break;
      }
      case 'del-draft': record('Info deleted', () => { state.evidence = state.evidence.filter(x => x.id !== draft.id); }); save(); leaveEv(); break;
      case 'quick-death':
        record(() => `${p.name}: ${p.dead ? 'died at night' : 'alive'}`, () => setDeath(p, p.dead ? '' : 'night'));
        commit(); break;
      case 'new-note':
        noteDraft = { id: null, player: pid, when: { ...state.phase }, kind: pid === state.meId ? 'did' : 'said', targets: [], char: '', text: '', story: pid === state.meId ? 'true' : 'public' };
        sheetKind = 'note'; sheetNote(); break;
      case 'edit-note': {
        const n = state.notes.find(x => x.id === el.dataset.noteid); if (!n) return;
        noteReturn = !sheetKind;
        noteDraft = JSON.parse(JSON.stringify(n)); sheetKind = 'note'; sheetNote(); break;
      }
      case 'use-bluff': {
        const m = me(), c = el.dataset.char; if (!m || !c || Engine.latestClaim(m) === c) return;
        record(`Now claiming ${ci(c).name}`, () => { m.claims.push({ char: c, when: { ...state.phase } }); });
        commit(); window.scrollTo(0, 0); break;
      }
      case 'plan-new':
        noteReturn = true;
        noteDraft = { id: null, player: state.meId, when: { ...state.phase }, kind: 'did', targets: [], char: '', text: '', story: 'public', plan: true };
        sheetKind = 'note'; sheetNote(); break;
      case 'plan-edit': {
        const n = state.bluff.plan.find(x => x.id === el.dataset.planid); if (!n) return;
        noteReturn = true;
        noteDraft = { ...JSON.parse(JSON.stringify(n)), plan: true }; sheetKind = 'note'; sheetNote(); break;
      }
      case 'plan-told': {
        const n = state.bluff.plan.find(x => x.id === el.dataset.planid); if (!n) return;
        // Once said out loud it becomes part of your public timeline, dated no later than now.
        const when = Engine.phaseRank(n.when) > Engine.phaseRank(state.phase) ? { ...state.phase } : n.when;
        record('Marked as told', () => {
          state.bluff.plan = state.bluff.plan.filter(x => x.id !== n.id);
          state.notes.push({ ...n, id: uid(), player: state.meId, when, story: 'public' });
        });
        commit(); break;
      }
      case 'cancel-note': leaveNote(noteDraft.player); break;
      case 'note-story': noteDraft.story = el.dataset.v; sheetNote(); break;
      case 'note-kind': noteDraft.kind = el.dataset.v; sheetNote(); break;
      case 'note-target':
        noteDraft.targets = noteDraft.targets.includes(pid) ? noteDraft.targets.filter(x => x !== pid) : [...noteDraft.targets, pid];
        sheetNote(); break;
      case 'save-note': {
        const d = noteDraft;
        d.text = d.text.trim();
        if (!d.text && !d.char && !d.targets.length) { toast('Add a player, character or details'); return; }
        if (d.plan) {
          const { plan: _plan, ...line } = d;
          record('Added to your story', () => {
            if (!line.id) { line.id = uid(); state.bluff.plan.push(line); } else state.bluff.plan = state.bluff.plan.map(n => (n.id === line.id ? line : n));
          });
        } else {
          record('Added to timeline', () => { if (!d.id) { d.id = uid(); state.notes.push(d); } else state.notes = state.notes.map(n => (n.id === d.id ? d : n)); });
        }
        save();
        if (el.dataset.more === '1') {
          noteDraft = { id: null, player: d.player, when: { ...d.when }, kind: d.kind, targets: [], char: '', text: '', story: d.story, ...(d.plan ? { plan: true } : {}) };
          sheetNote();
        } else leaveNote(d.player);
        break;
      }
      case 'del-note': {
        const owner = noteDraft.player, nid = noteDraft.id, wasPlan = noteDraft.plan;
        record(wasPlan ? 'Planned line deleted' : 'Note deleted', () => {
          if (wasPlan) state.bluff.plan = state.bluff.plan.filter(n => n.id !== nid);
          else state.notes = state.notes.filter(n => n.id !== nid);
        });
        save(); leaveNote(owner); break;
      }
      case 'new-nom': nomDraft = { id: null, day: state.phase.n, nominator: '', nominee: '', voters: [], votes: 0, executed: false }; sheetKind = 'nom'; sheetNom(); break;
      case 'edit-nom': nomDraft = JSON.parse(JSON.stringify(state.noms.find(n => n.id === el.dataset.nid))); sheetKind = 'nom'; sheetNom(); break;
      case 'nom-voter': {
        nomDraft.voters = nomDraft.voters.includes(pid) ? nomDraft.voters.filter(x => x !== pid) : [...nomDraft.voters, pid];
        nomDraft.votes = nomDraft.voters.length; sheetNom(); break;
      }
      case 'nom-exec': nomDraft.executed = !nomDraft.executed; sheetNom(); break;
      case 'save-nom': {
        const d = nomDraft;
        if (!d.nominator || !d.nominee) { alert('Pick the nominator and the nominee.'); return; }
        record('Nomination saved', () => {
          const old = d.id ? state.noms.find(n => n.id === d.id) : null;
          // Only one execution per day: moving it brings the previous player back.
          if (old && old.executed && (!d.executed || old.nominee !== d.nominee)) undoExecution(old);
          if (d.executed) {
            state.noms.forEach(n => { if (n.day === d.day && n.id !== d.id && n.executed) { undoExecution(n); n.executed = false; } });
            const q = player(d.nominee); if (q && !q.dead) { q.dead = true; q.death = { how: 'execution', when: { kind: 'day', n: d.day } }; }
          }
          // Ghost votes: only a player who was already dead on that day spends one.
          (old ? old.voters : []).forEach(v => { if (!d.voters.includes(v)) refundGhostVote(v, old); });
          d.voters.forEach(v => { const q = player(v); if (deadDuring(q, d.day)) q.deadVoteUsed = true; });
          if (!d.id) { d.id = uid(); state.noms.push(d); } else state.noms = state.noms.map(n => (n.id === d.id ? d : n));
        });
        save(); closeSheet(); break;
      }
      case 'del-nom': {
        const nid = nomDraft.id;
        record('Nomination deleted', () => {
          const old = state.noms.find(n => n.id === nid);
          if (old) { if (old.executed) undoExecution(old); (old.voters || []).forEach(v => refundGhostVote(v, old)); }
          state.noms = state.noms.filter(n => n.id !== nid);
        });
        save(); closeSheet(); break;
      }
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    const ch = el.dataset.change;
    if (el.dataset.input === 'pname') { render(); }
    else if (ch === 'script') { state.scriptId = el.value; commit(); }
    else if (ch === 'me') {
      state.meId = el.value || null;
      state.bluff.plan = state.bluff.plan.map(x => ({ ...x, player: state.meId || x.player, targets: x.targets.filter(t => t !== state.meId) }));
      commit();
    }
    else if (ch === 'known-demon') { state.knownDemon = el.value || null; commit(); }
    else if (ch === 'evil-ov') { const v = parseInt(el.value, 10); state.evilOverride = v > 0 ? v : null; commit(); }
    else if (el.dataset.draft && draft) {
      const k = el.dataset.draft;
      if (k === 'when') { const [kind, n] = el.value.split(':'); draft.when = { kind, n: Number(n) }; }
      else if (k === 'day') draft.day = Number(el.value) || 1;
      else if (k === 'template') { draft.template = el.value; applyAuto(); }
      else if (k === 'source') { draft.source = el.value; const t = templateForSource(el.value); if (!draft.id && t) draft.template = t.id; applyAuto(); }
      else draft[k] = el.value;
      sheetEvidence();
    }
    else if (el.dataset.note && noteDraft) {
      const k = el.dataset.note;
      if (k === 'when') { const [kind, n] = el.value.split(':'); noteDraft.when = { kind, n: Number(n) }; }
      else noteDraft[k] = el.value;
    }
    else if (el.dataset.nom && nomDraft) {
      const k = el.dataset.nom; nomDraft[k] = k === 'votes' ? Number(el.value) : el.value;
    }
    else if (el.id === 'script-file' && el.files[0]) {
      el.files[0].text().then(t => {
        try { state.customScript = parseCustomScript(JSON.parse(t)); state.scriptId = 'custom'; commit(); toast(`Loaded ${state.customScript.name}`); }
        catch (err) { alert('Could not read that script: ' + err.message); }
      });
    }
    else if (el.id === 'game-file' && el.files[0]) {
      el.files[0].text().then(t => {
        try { const s = JSON.parse(t); if (!Array.isArray(s.players)) throw new Error('not a game file'); const next = Engine.sanitizeGame(s, freshState());
          record('Game loaded', () => { state = next; }); uiTab = state.players.length ? 'town' : 'setup'; commit(); }
        catch (err) { alert('Could not load that file: ' + err.message); }
      });
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.input === 'pname') { const p = player(el.closest('[data-pid]').dataset.pid); p.name = el.value; save(); }
    else if (el.dataset.input === 'pnotes') { const p = player(el.dataset.pid); p.notes = el.value; save(); }
    else if (el.dataset.input === 'guide-filter') {
      guideFilter = el.value; const pos = el.selectionStart; render();
      const inp = document.querySelector('[data-input="guide-filter"]'); inp.focus(); inp.setSelectionRange(pos, pos);
    }
    else if (el.dataset.input === 'picker-q' && pickerState) { pickerState.q = el.value; $('#picker-list').innerHTML = pickerListHtml(); }
    else if (el.dataset.draft === 'text' && draft) draft.text = el.value;
    else if (el.dataset.note === 'text' && noteDraft) noteDraft.text = el.value;
  });
  document.addEventListener('keydown', (e) => {
    // Enter in the picker's search picks the only match.
    if (e.key === 'Enter' && e.target.id === 'picker-q') { const hits = $('#picker-list').querySelectorAll('.pick'); if (hits.length === 1) { e.preventDefault(); hits[0].click(); } }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'new-player') { e.preventDefault(); document.querySelector('[data-act="add-player"]').click(); } });

  // Re-render the page underneath the sheet when it closes; while open, keep data fresh.
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (uiTab === 'town' || document.body.classList.contains('two-pane')) render(); }, 150); });
  window.__companion = { get state() { return state; }, get undoDepth() { return undoStack.length; }, Engine };
  render();
})();
