// Clocktower Companion: UI and state. Everything is stored in this browser only.
(() => {
  const KEY = 'botc-companion-v1';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ── State ────────────────────────────────────────────────────────────────
  function freshState() {
    return { v: 1, scriptId: 'trouble-brewing', customScript: null, players: [], meId: null, myChar: '', myAlign: 'good',
      knownEvil: [], knownDemon: null, evilOverride: null, phase: { kind: 'night', n: 1 }, evidence: [], noms: [], gameOver: false, tab: 'setup' };
  }
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || freshState(); } catch { state = freshState(); }
  state = Object.assign(freshState(), state);
  let uiTab = state.players.length ? (state.tab === 'setup' ? 'town' : state.tab) : 'setup';
  let analysisCache = { key: null, value: null };

  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
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
    const key = JSON.stringify([state.players, state.evidence, state.noms, state.meId, state.myAlign, state.myChar, state.knownEvil, state.knownDemon, state.evilOverride, state.scriptId, state.gameOver]);
    if (analysisCache.key !== key) analysisCache = { key, value: Engine.analyze(state, script()) };
    return analysisCache.value;
  }

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  // ── Shell ────────────────────────────────────────────────────────────────
  function render() {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === uiTab));
    const ph = state.phase;
    $('#phase-chip').innerHTML = state.players.length
      ? `<span class="chip ${ph.kind}">${ph.kind === 'night' ? '☾' : '☀'} ${Engine.phaseLabel(ph)}</span><button class="btn small" data-act="next-phase" title="Advance to the next phase">Next ›</button>`
      : '';
    const v = $('#view');
    v.innerHTML = ({ setup: viewSetup, town: viewTown, info: viewInfo, days: viewDays, read: viewRead, guide: viewGuide })[uiTab]();
    state.tab = uiTab; save();
  }

  document.getElementById('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    uiTab = b.dataset.tab; render(); window.scrollTo(0, 0);
  });

  function nextPhase() {
    const ph = state.phase;
    state.phase = ph.kind === 'night' ? { kind: 'day', n: ph.n } : { kind: 'night', n: ph.n + 1 };
    commit(); toast(Engine.phaseLabel(state.phase));
  }
  function prevPhase() {
    const ph = state.phase;
    if (ph.kind === 'night' && ph.n === 1) return;
    state.phase = ph.kind === 'day' ? { kind: 'night', n: ph.n } : { kind: 'day', n: ph.n - 1 };
    commit();
  }

  // ── Setup ────────────────────────────────────────────────────────────────
  function scriptOptions() {
    const opts = Object.entries(SCRIPTS).map(([id, s]) => `<option value="${id}" ${state.scriptId === id ? 'selected' : ''}>${esc(s.name)}</option>`);
    if (state.customScript) opts.push(`<option value="custom" ${state.scriptId === 'custom' ? 'selected' : ''}>${esc(state.customScript.name)} (custom)</option>`);
    return opts.join('');
  }
  function charOptions(selected, { blank = '— none —', teams = null } = {}) {
    const sc = script();
    const groups = {};
    sc.characters.forEach(id => { const c = ci(id); if (teams && !teams.includes(c.team)) return; (groups[c.team] = groups[c.team] || []).push(c); });
    let html = blank !== null ? `<option value="">${blank}</option>` : '';
    for (const t of TEAMS) if (groups[t]) {
      html += `<optgroup label="${TEAM_LABEL[t]}">` + groups[t].map(c => `<option value="${c.id}" ${selected === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('') + '</optgroup>';
    }
    // Claims that aren't on the script (bluffs, travellers) stay selectable.
    if (selected && !sc.characters.includes(selected)) html += `<option value="${esc(selected)}" selected>${esc(ci(selected).name)} (not on script)</option>`;
    html += `<optgroup label="Not on this script">` + Object.entries(CHARACTERS).filter(([id]) => !sc.characters.includes(id) && id !== selected).map(([id, c]) => `<option value="${id}">${esc(c.name)}</option>`).join('') + '</optgroup>';
    return html;
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
      <div><label class="field" for="mychar-sel">Your character (what the Storyteller showed you)</label>
        <select id="mychar-sel" data-change="mychar">${charOptions(state.myChar, { blank: '— not told yet —' })}</select></div>
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
    const [c1, c2] = t < a.prior ? [[92, 138, 163], [138, 128, 112]] : [[138, 128, 112], [214, 64, 52]];
    const k = t < a.prior ? t / a.prior : (t - a.prior) / (1 - a.prior);
    return `rgb(${lerp(c1[0], c2[0], k)},${lerp(c1[1], c2[1], k)},${lerp(c1[2], c2[2], k)})`;
  }

  function viewTown() {
    if (!state.players.length) return `<div class="card empty"><h2>No players yet</h2><p>Add the players in seating order on the Setup tab.</p><button class="btn primary" data-goto="setup">Go to setup</button></div>`;
    const N = state.players.length;
    const wrap = Math.min(window.innerWidth - 24, 620);
    const tok = Math.round(Math.min(N <= 8 ? 76 : N <= 12 ? 64 : 54, wrap * (N <= 6 ? 0.19 : N <= 8 ? 0.155 : N <= 12 ? 0.13 : 0.105)));
    const a = analysis();
    const showPct = a && !a.error && !isEvilMe();
    const radius = 40;
    const tokens = state.players.map((p, i) => {
      const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
      const x = 50 + radius * Math.cos(ang), y = 50 + radius * Math.sin(ang);
      const claim = Engine.claimOf(state, p);
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
      ${showPct ? `<div class="legend"><span><i style="background:#5c8aa3"></i>looks good</span><span><i style="background:#8a8070"></i>unknown</span><span><i style="background:#d64034"></i>looks evil</span><span><i style="background:#e8e2d0"></i>ghost vote left</span></div>` : ''}
      <p class="faint" style="text-align:center">Tap a player to record their claim, death, your read on them, or info they shared.</p>`;
  }

  function sheetPlayer(pid) {
    const p = player(pid); if (!p) return;
    const a = analysis();
    const claim = Engine.claimOf(state, p);
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
        ${isMe ? `<div class="tip info">Your own character is set on the Setup tab.</div>` : `
        <div><label class="field" for="claim-sel">What they claim to be</label>
          <select id="claim-sel" data-change="claim" data-pid="${p.id}">${charOptions(Engine.latestClaim(p), { blank: '— no claim —' })}</select>
          ${p.claims.length > 1 ? `<div class="faint" style="margin-top:4px">Claim history: ${p.claims.map(c => `${esc(ci(c.char).name)} (${Engine.phaseLabel(c.when)})`).join(' → ')}. <b>Changing claims is a red flag</b>, unless a Barber, Pit-Hag or madness explains it.</div>` : ''}
          ${info ? `<div class="tip info" style="margin-top:8px"><b class="team-${info.team}">${esc(info.name)}</b>: ${esc(info.ability)}<br><span class="muted"><b>If they claim this:</b> ${esc(info.spot || (TEAM_TIPS[info.team] || {}).spot || '')}</span></div>` : ''}
        </div>
        <div><label class="field">Your read</label>
          <div class="seg">${[-2, -1, 0, 1, 2].map(g => `<button data-act="gut" data-pid="${p.id}" data-v="${g}" class="${(p.gut || 0) === g ? 'on' : ''}">${gutLabels[g]}</button>`).join('')}</div>
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
        <div><label class="field" for="pnotes">Notes</label><textarea id="pnotes" data-input="pnotes" data-pid="${p.id}" placeholder="What did they tell you? Who do they defend?">${esc(p.notes || '')}</textarea></div>
        <div class="row"><button class="btn primary" data-act="log-from" data-pid="${p.id}">Log info ${isMe ? 'you' : esc(p.name)} learned</button>
          <button class="btn" data-act="log-about" data-pid="${p.id}">Log info about ${esc(p.name)}</button></div>
        ${evidenceFor(p.id)}
      </div>`);
  }

  function evidenceFor(pid) {
    const list = state.evidence.filter(e => e.source === pid || (e.players || []).includes(pid));
    if (!list.length) return '';
    return `<div><label class="field">Info involving ${esc(pname(pid))}</label>${list.map(entryHtml).join('')}</div>`;
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
      state.players.map(p => `<option value="${p.id}" ${draft.source === p.id ? 'selected' : ''}>${esc(p.name)}${p.id === state.meId ? ' (you)' : ''}${Engine.claimOf(state, p) ? ' · ' + esc(ci(Engine.claimOf(state, p)).name) : ''}</option>`).join('');
    const sc = new Set(script().characters);
    const relevant = TEMPLATES.filter(x => !x.chars.length || x.chars.some(c => sc.has(c)) || x.id === draft.template);
    const others = TEMPLATES.filter(x => !relevant.includes(x));
    const tplOpt = (x) => `<option value="${x.id}" ${x.id === draft.template ? 'selected' : ''}>${esc(x.label)}</option>`;
    const phases = []; for (let n = 1; n <= Math.max(state.phase.n, 1); n++) { phases.push({ kind: 'night', n }); if (n < state.phase.n || state.phase.kind === 'day') phases.push({ kind: 'day', n }); }
    openSheet(`
      <div class="grab"></div><button class="btn small close" data-act="close-sheet">Cancel</button>
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
        ${f.char ? `<div><label class="field" for="ev-char">Character</label><select id="ev-char" data-draft="char">${charOptions(draft.char, { blank: '— choose —' })}</select></div>` : ''}
        ${f.yes ? `<div><label class="field">Result</label><div class="seg"><button data-act="draft-yes" data-v="1" class="${draft.yes ? 'on' : ''}">${f.yes[0]}</button><button data-act="draft-yes" data-v="0" class="${!draft.yes ? 'on' : ''}">${f.yes[1]}</button></div></div>` : ''}
        ${f.same ? `<div><label class="field">Result</label><div class="seg"><button data-act="draft-same" data-v="1" class="${draft.same ? 'on' : ''}">Same alignment</button><button data-act="draft-same" data-v="0" class="${!draft.same ? 'on' : ''}">Different</button></div></div>` : ''}
        ${f.evil ? `<div><label class="field">Alignment</label><div class="seg"><button data-act="draft-evil" data-v="0" class="${!draft.evil ? 'on' : ''}">Good</button><button data-act="draft-evil" data-v="1" class="${draft.evil ? 'on' : ''}">Evil</button></div></div>` : ''}
        ${f.day ? `<div><label class="field" for="ev-day">Which day?</label><input type="number" id="ev-day" min="1" value="${draft.day}" data-draft="day" style="width:90px">
          <div class="faint">Uses the nominations and votes you logged on the Votes tab for that day.</div></div>` : ''}
        <div><label class="field" for="ev-text">Note (optional)</label><textarea id="ev-text" data-draft="text" placeholder="Exact wording, context…">${esc(draft.text)}</textarea></div>
        <div class="row"><button class="btn primary" data-act="save-draft">Save</button>
          ${draft.id ? '<button class="btn danger" data-act="del-draft">Delete</button>' : ''}</div>
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
    const srcClaim = srcP ? Engine.claimOf(state, srcP) : null;
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
      const b = Engine.bluffs(state, sc);
      return `<div class="card"><h2>You're evil</h2><p class="muted">You already know your team, so this tab helps you blend in instead.</p>
        <h3>Unclaimed good characters (possible bluffs)</h3>
        ${b.map(c => `<div class="tip ${c.safe ? 'good' : 'info'}"><b class="team-${c.team}">${esc(c.name)}</b>${c.safe ? ' · <span class="faint">hard to disprove</span>' : ''}<br><span class="muted">${esc(c.ability)}</span></div>`).join('')}
        <p class="faint">Use the bluffs your Demon gave you first: those characters are definitely not in play. Pick one that fits the number of Outsiders already claimed.</p></div>
        <div class="card"><h3>Table talk</h3>${tipsHtml}</div>`;
    }
    if (a.error) return `<div class="card"><h2>Who's lying?</h2><div class="tip warn">${esc(a.error)}</div></div><div class="card"><h3>Tips</h3>${tipsHtml}</div>`;
    const ranked = Engine.ring(state).filter(p => p.id !== state.meId).map(p => ({ p, ...a.players[p.id] })).sort((x, y) => y.evil - x.evil);
    const bar = (v, color) => `<div class="bar"><span style="width:${Math.round(v * 100)}%;background:${color}"></span><span class="prior" style="left:${Math.round(a.prior * 100)}%"></span></div>`;
    return `
      <div class="card">
        <h2>Who's lying?</h2>
        <p class="faint" style="margin-top:0">${a.evilCount} evil players. Checked ${a.worldCount.toLocaleString()} possible teams against ${a.factorCount} clue${a.factorCount === 1 ? '' : 's'}. The grey tick marks the starting chance before any clues (${Math.round(a.prior * 100)}%).</p>
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
      <div class="card"><h3>Most likely evil teams</h3>
        ${a.topTeams.map(t => `<div class="tip info"><span class="pct">${Math.round(t.p * 100)}%</span> · ${t.members.map(id => id === t.demon ? `<b class="team-demon">${esc(pname(id))} (Demon?)</b>` : esc(pname(id))).join(', ')}</div>`).join('')}
      </div>
      <div class="card"><h3>Tips</h3>${tipsHtml}</div>
      <details class="rule"><summary>How does this work?</summary><ul>
        <li>The app lists every way the evil team could be seated (with ${a.evilCount} evil players), and every choice of who is the Demon.</li>
        <li>Each piece of info is checked in each possible world. <b>Evil players may say anything</b>, so their info doesn't count against a world. Info from a <b>good</b> player is usually true. If it's false, that world becomes less likely (they might be drunk or poisoned), but not impossible.</li>
        <li>Suspicious claims (the same character claimed twice, characters not on the script), night deaths and executions without a win also shift the odds. Your reads count a little.</li>
        <li>The percentage is the share of the remaining likely worlds where that player is evil. ▲/▼ shows which clue moved it most.</li>
        <li>It only knows what you tell it, and it doesn't model every character (Vortox, Pit-Hag swaps, star passes). Treat it as a second opinion, not the answer.</li>
      </ul></details>`;
  }

  // ── Guide ────────────────────────────────────────────────────────────────
  let guideFilter = '';
  function charCard(c, open = false) {
    const tips = { play: c.play || (TEAM_TIPS[c.team] || {}).play, spot: c.spot || (TEAM_TIPS[c.team] || {}).spot };
    return `<details class="char" ${open ? 'open' : ''}><summary><span class="ico">${icon(c.id)}</span><span class="grow"><b class="team-${c.team}">${esc(c.name)}</b><div class="ab">${esc(c.ability)}</div></span></summary>
      <div class="body">${tips.play ? `<p><b>If you are the ${esc(c.name)}:</b> ${esc(tips.play)}</p>` : ''}${tips.spot ? `<p><b>If someone claims it:</b> ${esc(tips.spot)}</p>` : ''}</div></details>`;
  }
  function viewGuide() {
    const sc = script();
    const q = guideFilter.toLowerCase();
    const chars = sc.characters.map(ci).filter(c => !q || c.name.toLowerCase().includes(q) || (c.ability || '').toLowerCase().includes(q));
    const mine = state.myChar ? ci(state.myChar) : null;
    return `
      ${mine ? `<h2>Your character</h2>${charCard(mine, true)}` : ''}
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
    s.innerHTML = html; s.hidden = false; $('#sheet-backdrop').hidden = false; s.scrollTop = keep;
  }
  function closeSheet() { $('#sheet').hidden = true; $('#sheet-backdrop').hidden = true; sheetKind = null; draft = null; nomDraft = null; render(); }
  $('#sheet-backdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  function refreshSheet() {
    if (sheetKind && sheetKind.startsWith('player:')) sheetPlayer(sheetKind.slice(7));
    else if (sheetKind === 'ev') sheetEvidence();
    else if (sheetKind === 'nom') sheetNom();
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  function setDeath(p, how) {
    if (!how) { p.dead = false; p.death = null; p.deadVoteUsed = false; }
    else { p.dead = true; p.death = { how, when: { ...state.phase } }; }
  }

  function parseCustomScript(json) {
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const known = {};
    Object.keys(CHARACTERS).forEach(k => { known[norm(k)] = k; });
    const extra = {};
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
    if (g) { uiTab = g.dataset.goto; render(); return; }
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
        state.players = state.players.filter(x => x.id !== pid);
        state.evidence = state.evidence.filter(ev => ev.source !== pid && !(ev.players || []).includes(pid));
        state.noms = state.noms.filter(n => n.nominator !== pid && n.nominee !== pid).map(n => ({ ...n, voters: (n.voters || []).filter(v => v !== pid) }));
        if (state.meId === pid) state.meId = null;
        state.knownEvil = state.knownEvil.filter(x => x !== pid);
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
        const keep = state.players.map(x => ({ id: x.id, name: x.name, traveller: false, claims: [], dead: false, death: null, deadVoteUsed: false, gut: 0, lock: '', notes: '' }));
        state = Object.assign(freshState(), { players: keep, meId: state.meId, scriptId: state.scriptId, customScript: state.customScript });
        uiTab = 'setup'; commit(); break;
      }
      case 'open-player': sheetKind = 'player:' + pid; sheetPlayer(pid); break;
      case 'close-sheet': closeSheet(); break;
      case 'gut': p.gut = Number(el.dataset.v); save(); refreshSheet(); break;
      case 'lock': p.lock = el.dataset.v; save(); refreshSheet(); break;
      case 'death': setDeath(p, el.dataset.v); save(); refreshSheet(); break;
      case 'ghost': p.deadVoteUsed = !p.deadVoteUsed; save(); refreshSheet(); break;
      case 'log-from': newDraft(pid, null); sheetKind = 'ev'; sheetEvidence(); break;
      case 'log-about': newDraft(null, pid); sheetKind = 'ev'; sheetEvidence(); break;
      case 'new-ev': newDraft(state.meId, null); sheetKind = 'ev'; sheetEvidence(); break;
      case 'edit-ev': {
        const ev = state.evidence.find(x => x.id === el.dataset.eid); if (!ev) return;
        draft = JSON.parse(JSON.stringify(ev)); sheetKind = 'ev'; sheetEvidence(); break;
      }
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
        if (!ev.id) { ev.id = uid(); state.evidence.push(ev); } else state.evidence = state.evidence.map(x => (x.id === ev.id ? ev : x));
        save(); closeSheet(); toast('Info saved'); break;
      }
      case 'del-draft': state.evidence = state.evidence.filter(x => x.id !== draft.id); save(); closeSheet(); break;
      case 'quick-death': {
        setDeath(p, p.dead ? '' : 'night');
        commit(); break;
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
        const old = d.id ? state.noms.find(n => n.id === d.id) : null;
        // Ghost votes: mark dead voters as having used their vote.
        (old ? old.voters : []).forEach(v => { if (!d.voters.includes(v)) { const q = player(v); if (q && q.dead) q.deadVoteUsed = false; } });
        d.voters.forEach(v => { const q = player(v); if (q && q.dead) q.deadVoteUsed = true; });
        if (d.executed) {
          state.noms.forEach(n => { if (n.day === d.day && n.id !== d.id && n.executed) { n.executed = false; } });
          const q = player(d.nominee); if (q && !q.dead) { q.dead = true; q.death = { how: 'execution', when: { kind: 'day', n: d.day } }; }
        } else if (old && old.executed) {
          const q = player(d.nominee); if (q && q.death && q.death.how === 'execution') setDeath(q, '');
        }
        if (!d.id) { d.id = uid(); state.noms.push(d); } else state.noms = state.noms.map(n => (n.id === d.id ? d : n));
        save(); closeSheet(); break;
      }
      case 'del-nom': state.noms = state.noms.filter(n => n.id !== nomDraft.id); save(); closeSheet(); break;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    const ch = el.dataset.change;
    if (el.dataset.input === 'pname') { render(); }
    else if (ch === 'script') { state.scriptId = el.value; commit(); }
    else if (ch === 'me') { state.meId = el.value || null; commit(); }
    else if (ch === 'mychar') {
      state.myChar = el.value;
      const info = el.value ? ci(el.value) : null;
      if (info) state.myAlign = Engine.isEvilTeam(info.team) ? 'evil' : 'good';
      commit();
    }
    else if (ch === 'known-demon') { state.knownDemon = el.value || null; commit(); }
    else if (ch === 'evil-ov') { const v = parseInt(el.value, 10); state.evilOverride = v > 0 ? v : null; commit(); }
    else if (ch === 'claim') {
      const p = player(el.dataset.pid);
      if (el.value) p.claims.push({ char: el.value, when: { ...state.phase } }); else p.claims = [];
      save(); refreshSheet();
    }
    else if (el.dataset.draft && draft) {
      const k = el.dataset.draft;
      if (k === 'when') { const [kind, n] = el.value.split(':'); draft.when = { kind, n: Number(n) }; }
      else if (k === 'day') draft.day = Number(el.value) || 1;
      else if (k === 'template') { draft.template = el.value; applyAuto(); }
      else if (k === 'source') { draft.source = el.value; const t = templateForSource(el.value); if (!draft.id && t) draft.template = t.id; applyAuto(); }
      else draft[k] = el.value;
      sheetEvidence();
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
        try { const s = JSON.parse(t); if (!Array.isArray(s.players)) throw new Error('not a game file'); state = Object.assign(freshState(), s); commit(); toast('Game loaded'); }
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
    else if (el.dataset.draft === 'text' && draft) draft.text = el.value;
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'new-player') { e.preventDefault(); document.querySelector('[data-act="add-player"]').click(); } });

  // Re-render the page underneath the sheet when it closes; while open, keep data fresh.
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (uiTab === 'town') render(); }, 150); });
  window.__companion = { get state() { return state; }, Engine };
  render();
})();
