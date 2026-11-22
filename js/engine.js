// Pure game logic: setup counts, the "who's lying" world solver, and tips.
// No DOM access here, so it can be tested on its own.

const Engine = (() => {
  // Likelihood multipliers. A good player's info that turns out false is
  // possible (drunk / poisoned / Recluse / Spy), just unlikely.
  const NOISE = 0.15;          // a good source's info is false
  const CLEAN_NOISE = 0.05;    // the same, on a script with nothing that causes drunkenness or poison
  const ST_NOISE = 0.02;       // a public / Storyteller fact is false
  const DROISON_ROLES = ['drunk', 'poisoner', 'pukka', 'nodashii', 'sailor', 'innkeeper', 'courtier', 'goon', 'minstrel', 'philosopher', 'vigormortis', 'snakecharmer', 'sweetheart', 'widow', 'marionette'];
  const GUT = { '-2': 0.4, '-1': 0.7, '0': 1, '1': 1.4, '2': 2 };

  function charInfo(id, script) {
    if (!id) return null;
    if (CHARACTERS[id]) return { id, ...CHARACTERS[id] };
    const custom = script && script.custom && script.custom[id];
    if (custom) return { id, ...custom };
    if (typeof EXTRA_CHARACTERS !== 'undefined' && EXTRA_CHARACTERS[id]) return { id, ...EXTRA_CHARACTERS[id] };
    return { id, name: id, team: 'townsfolk', ability: '' };
  }
  const isEvilTeam = (team) => team === 'minion' || team === 'demon';
  const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function setupFor(count) {
    const n = Math.max(5, Math.min(15, count));
    const [t, o, m, d] = SETUP_TABLE[n];
    return { townsfolk: t, outsider: o, minion: m, demon: d, clamped: n !== count };
  }

  // Players who take part in the alignment solve (Travellers are excluded).
  const ring = (state) => state.players.filter(p => !p.traveller);
  const latestClaim = (p) => (p.claims && p.claims.length ? p.claims[p.claims.length - 1].char : null);

  function claimOf(state, p) {
    if (p.id === state.meId && state.myChar && state.myAlign === 'good') return state.myChar;
    return latestClaim(p);
  }

  function evilCountFor(state) {
    if (state.evilOverride) return state.evilOverride;
    const s = setupFor(ring(state).length);
    return s.minion + s.demon;
  }

  function aliveCount(state) { return state.players.filter(p => !p.dead).length; }
  function votesNeeded(state) { return Math.ceil(aliveCount(state) / 2); }

  function* combinations(n, k, start = 0, acc = []) {
    if (acc.length === k) { yield acc.slice(); return; }
    for (let i = start; i <= n - (k - acc.length); i++) { acc.push(i); yield* combinations(n, k, i + 1, acc); acc.pop(); }
  }

  function phaseLabel(ph) { return ph ? `${ph.kind === 'night' ? 'Night' : 'Day'} ${ph.n}` : ''; }

  // ── Build factors from claims, evidence and deaths ───────────────────────
  function buildFactors(state, script, idx, names) {
    const R = ring(state);
    const n = R.length;
    const factors = [];
    const scriptSet = new Set(script.characters);
    const has = (id) => scriptSet.has(id);
    const at = (id) => idx[id];
    const nm = (id) => names[id] || '?';
    const cname = (c) => charInfo(c, script).name;

    // When each player died, so facts about "the Demon" can respect a Demon that has since changed hands.
    const deathRank = R.map(p => (p.dead && p.death && p.death.when ? phaseRank(p.death.when) : Infinity));
    const demonGone = (w, when) => deathRank[w.demon] < phaseRank(when);
    const otherEvilAlive = (w, i, rank) => { for (let k = 0; k < n; k++) if (k !== i && w.evil[k] && deathRank[k] > rank) return true; return false; };
    // How likely a good player's whole set of info is unreliable (drunk or poisoned).
    const droisonRate = DROISON_ROLES.some(has) ? NOISE : CLEAN_NOISE;

    // Claims
    const claims = R.map(p => claimOf(state, p));
    claims.forEach((c, i) => {
      if (!c) return;
      const info = charInfo(c, script);
      if (info.team === 'traveller' || info.team === 'fabled') return;
      if (!has(c)) {
        factors.push({ kind: 'claim', label: `${R[i].name} claims ${info.name}, which is not on this script`, about: [R[i].id],
          fn: (w) => (w.evil[i] ? 1 : 0.1) });
      }
      if (isEvilTeam(info.team) && R[i].id !== state.meId) {
        const f = (info.team === 'demon' && has('lunatic')) ? 0.6 : 0.1;
        factors.push({ kind: 'claim', label: `${R[i].name} claims to be evil (${info.name})`, about: [R[i].id], fn: (w) => (w.evil[i] ? 1 : f) });
      }
    });
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!claims[i] || claims[i] !== claims[j]) continue;
      const info = charInfo(claims[i], script);
      if (info.team === 'traveller') continue;
      const lenient = info.team === 'townsfolk' && (has('drunk') || has('philosopher') || has('marionette'));
      const f = lenient ? 0.35 : 0.12;
      factors.push({ kind: 'claim', label: `${R[i].name} and ${R[j].name} both claim ${info.name}`, about: [R[i].id, R[j].id],
        fn: (w) => (w.evil[i] || w.evil[j] ? 1 : f) });
    }

    // Claim history and rule-breaking stories
    R.forEach((p, i) => {
      if (p.id === state.meId) return;
      const history = (p.claims || []).map(c => c.char).filter((c, j, a) => j === 0 || c !== a[j - 1]);
      if (history.length > 1) {
        const f = ['barber', 'pithag', 'snakecharmer', 'philosopher', 'cerenovus'].some(has) ? 0.7 : 0.45;
        factors.push({ kind: 'claim', label: `${p.name} changed their claim (${history.map(cname).join(' → ')})`, about: [p.id], fn: (w) => (w.evil[i] ? 1 : f) });
      }
      const claim = latestClaim(p);
      if (!claim || !['townsfolk', 'outsider'].includes(charInfo(claim, script).team)) return;
      const broken = bluffCheck({ ...state, meId: p.id, myChar: '', myAlign: 'good', bluff: { demonBluffs: [], plan: [] } }, script).issues.filter(x => x.rule && (x.level === 'bad' || x.level === 'warn'));
      if (broken.length) {
        const f = broken.some(x => x.level === 'bad') ? 0.3 : 0.55;
        factors.push({ kind: 'claim', label: `${p.name}'s ${cname(claim)} story does not fit that role or the public events`, about: [p.id], fn: (w) => (w.evil[i] ? 1 : f) });
      }
    });

    // Deaths
    R.forEach((p, i) => {
      if (!p.dead || !p.death) return;
      const rank = deathRank[i];
      if (p.death.how === 'night') {
        factors.push({ kind: 'death', label: `${p.name} died at night (Demons rarely kill their own team)`, about: [p.id],
          fn: (w) => (w.demon === i ? (has('imp') && otherEvilAlive(w, i, rank) ? 0.12 : 0.02) : w.evil[i] ? 0.4 : 1) });
      } else if (p.death.how === 'execution' && !state.gameOver) {
        const alive = R.filter((q, k) => deathRank[k] >= rank).length;
        const carriesOn = (w) => has('zombuul') || has('mastermind') || (has('scarletwoman') && alive >= 5 && otherEvilAlive(w, i, rank));
        factors.push({ kind: 'death', label: `${p.name} was executed and the game went on`, about: [p.id], fn: (w) => (w.demon === i ? (carriesOn(w) ? 0.25 : 0.03) : 1) });
      }
    });

    // Gut reads
    R.forEach((p, i) => {
      const g = GUT[String(p.gut || 0)];
      if (g !== 1) factors.push({ kind: 'gut', label: `Your read on ${p.name}`, about: [p.id], fn: (w) => (w.evil[i] ? g : 1) });
    });

    // Evidence
    const nomsByDay = {};
    (state.noms || []).forEach(nm => { (nomsByDay[nm.day] = nomsByDay[nm.day] || []).push(nm); });
    const bySource = new Map();
    const addItem = (src, label, about, lik) => {
      if (!bySource.has(src)) bySource.set(src, []);
      bySource.get(src).push({ label, about, lik });
    };
    const DEMON_FACTS = new Set(['clockmaker', 'ft', 'demonAmong', 'notDemon', 'demonVoted', 'minionNominated']);

    for (const ev of state.evidence || []) {
      const src = ev.source;
      const srcName = src === 'st' ? 'Public/Storyteller' : nm(src);
      const ps = (ev.players || []).map(at).filter(x => x !== undefined);
      let holds = null; let text = '';
      const t = ev.type;
      if (t === 'evilCount') {
        holds = (w) => ps.reduce((s, i) => s + w.evil[i], 0) === ev.n;
        text = `${ev.n} of ${ev.players.map(nm).join(', ')} evil`;
      } else if (t === 'chef') {
        holds = (w) => { let c = 0; for (let i = 0; i < n; i++) if (w.evil[i] && w.evil[(i + 1) % n]) c++; return c === ev.n; };
        text = `Chef: ${ev.n} evil pair(s)`;
      } else if (t === 'clockmaker') {
        holds = (w) => {
          let best = Infinity;
          for (let i = 0; i < n; i++) if (w.evil[i] && i !== w.demon) {
            const d = Math.abs(i - w.demon); best = Math.min(best, d, n - d);
          }
          return best === ev.n;
        };
        text = `Clockmaker: ${ev.n} step(s)`;
      } else if (t === 'oneIs' && ps.length) {
        const info = charInfo(ev.char, script);
        const evilChar = isEvilTeam(info.team);
        holds = (w) => {
          const anyMatch = ps.some(i => (evilChar ? w.evil[i] : !w.evil[i]));
          if (!anyMatch) return false;
          if (info.team === 'demon') return ps.includes(w.demon);
          if (!evilChar) {
            // A good player shown as that character should not claim something else.
            const goodOnes = ps.filter(i => !w.evil[i]);
            const fits = goodOnes.some(i => !claims[i] || claims[i] === ev.char || (ev.char === 'drunk'));
            return fits;
          }
          return true;
        };
        text = `one of ${ev.players.map(nm).join(' / ')} is the ${info.name}`;
      } else if (t === 'isChar' && ps.length) {
        const i = ps[0]; const info = charInfo(ev.char, script);
        if (isEvilTeam(info.team)) holds = (w) => w.evil[i] === 1;
        else holds = (w) => !w.evil[i] && (!claims[i] || claims[i] === ev.char || ev.char === 'drunk');
        if (info.team === 'demon') { const base = holds; holds = (w) => base(w) && w.demon === i; }
        text = `${nm(ev.players[0])} is the ${info.name}`;
      } else if (t === 'ft' && ps.length) {
        if (!ev.yes) { holds = (w) => !ps.includes(w.demon); text = `no Demon among ${ev.players.map(nm).join(' & ')}`; }
        else {
          addItem(src, `"yes" on ${ev.players.map(nm).join(' & ')} (${phaseLabel(ev.when)})`, [...ev.players, src].filter(x => x !== 'st'), (w) => {
            if (demonGone(w, ev.when) || ps.includes(w.demon)) return 1;
            return ps.some(i => !w.evil[i]) ? 0.3 : NOISE; // a good player may be the red herring
          });
          continue;
        }
      } else if (t === 'demonAmong' && ps.length) {
        holds = (w) => ps.includes(w.demon) === !!ev.yes;
        text = `the Demon ${ev.yes ? 'is' : 'is not'} among ${ev.players.map(nm).join(', ')}`;
      } else if (t === 'same' && ps.length === 2) {
        holds = (w) => (w.evil[ps[0]] === w.evil[ps[1]]) === !!ev.same;
        text = `${ev.players.map(nm).join(' & ')} are ${ev.same ? 'the same' : 'different'} alignment${ev.same ? '' : 's'}`;
      } else if (t === 'align' && ps.length) {
        holds = (w) => !!w.evil[ps[0]] === !!ev.evil;
        text = `${nm(ev.players[0])} is ${ev.evil ? 'evil' : 'good'}`;
      } else if (t === 'notDemon' && ps.length) {
        holds = (w) => w.demon !== ps[0];
        text = `${nm(ev.players[0])} is not the Demon`;
      } else if (t === 'demonVoted') {
        const voters = new Set(); (nomsByDay[ev.day] || []).forEach(x => (x.voters || []).forEach(v => voters.add(at(v))));
        holds = (w) => voters.has(w.demon) === !!ev.yes;
        text = `the Demon ${ev.yes ? 'voted' : 'did not vote'} on day ${ev.day}`;
      } else if (t === 'minionNominated') {
        const noms = new Set(); (nomsByDay[ev.day] || []).forEach(x => noms.add(at(x.nominator)));
        holds = (w) => [...noms].some(i => i !== undefined && w.evil[i] && w.demon !== i) === !!ev.yes;
        text = `a Minion ${ev.yes ? 'nominated' : 'did not nominate'} on day ${ev.day}`;
      }
      if (!holds) continue;
      const base = holds;
      const check = DEMON_FACTS.has(t) ? (w) => demonGone(w, ev.when) || base(w) : base;
      const misregisters = ps.some(i => claims[i] === 'recluse'); // a Recluse can show up as evil
      addItem(src, `${text} (${phaseLabel(ev.when)})`, [...(ev.players || []), src].filter(x => x && x !== 'st'),
        (w) => (check(w) ? 1 : misregisters ? 0.35 : 0));
    }

    // A drunk or poisoned player is wrong about everything at once, so a source's info is weighed as one story.
    for (const [src, items] of bySource) {
      if (src === 'st') {
        items.forEach(it => factors.push({ kind: 'ev', label: `Public/Storyteller: ${it.label}`, about: it.about, fn: (w) => Math.max(ST_NOISE, it.lik(w)) }));
        continue;
      }
      const si = at(src);
      if (si === undefined) continue;
      const claim = claims[si];
      const townsfolk = !!claim && charInfo(claim, script).team === 'townsfolk';
      const left = (si - 1 + n) % n, right = (si + 1) % n;
      const shown = items.slice(0, 2).map(it => it.label).join('; ') + (items.length > 2 ? `; +${items.length - 2} more` : '');
      factors.push({ kind: 'ev', label: `${nm(src)}: ${shown}`, about: [...new Set(items.flatMap(it => it.about))], fn: (w) => {
        if (w.evil[si]) return 1;
        if (w.vortox && townsfolk) { let v = 1; for (const it of items) v *= Math.max(0.05, 1 - it.lik(w)); return v; }
        let story = 1;
        for (const it of items) story *= Math.max(0.02, it.lik(w));
        const unreliable = has('nodashii') && (w.demon === left || w.demon === right) ? Math.max(droisonRate, 0.3) : droisonRate;
        return (1 - unreliable) * story + unreliable;
      } });
    }
    return factors;
  }

  // ── The solver ───────────────────────────────────────────────────────────
  function analyze(state, script) {
    const R = ring(state);
    const n = R.length;
    if (n < 5) return { error: 'Add at least 5 players (not counting Travellers) to see the analysis.' };
    const E = evilCountFor(state);
    if (E >= n) return { error: 'The number of evil players must be smaller than the player count.' };

    const idx = {}; const names = {};
    R.forEach((p, i) => { idx[p.id] = i; });
    state.players.forEach(p => { names[p.id] = p.name; });

    // Hard locks
    const forceGood = new Set(); const forceEvil = new Set(); let forceDemon = null; const notDemon = new Set();
    R.forEach((p, i) => {
      if (p.lock === 'good') forceGood.add(i);
      if (p.lock === 'evil') forceEvil.add(i);
      if (p.lock === 'demon') { forceEvil.add(i); forceDemon = i; }
      if (p.lock === 'notdemon') notDemon.add(i);
    });
    const me = idx[state.meId];
    if (me !== undefined && state.myAlign === 'good') forceGood.add(me);
    if (me !== undefined && state.myAlign === 'evil') {
      forceEvil.add(me);
      (state.knownEvil || []).forEach(id => { if (idx[id] !== undefined) forceEvil.add(idx[id]); });
      R.forEach((p, i) => { if (!forceEvil.has(i)) forceGood.add(i); });
      const myInfo = charInfo(state.myChar, script);
      if (myInfo && myInfo.team === 'demon') forceDemon = me;
      else if (state.knownDemon && idx[state.knownDemon] !== undefined) forceDemon = idx[state.knownDemon];
    }

    const factors = buildFactors(state, script, idx, names);
    const F = factors.length;

    // Vortox: if it is the Demon, Townsfolk info is false, and any day with no execution ends the game.
    let vortoxOptions = [false];
    const vortoxPrior = 1 / Math.max(1, script.characters.filter(c => charInfo(c, script).team === 'demon').length);
    if (script.characters.includes('vortox')) {
      const myTeam = state.myChar ? charInfo(state.myChar, script).team : '';
      const executed = new Set();
      state.players.forEach((p) => { if (p.dead && p.death && p.death.how === 'execution' && p.death.when) executed.add(p.death.when.n); });
      (state.noms || []).forEach((x) => { if (x.executed) executed.add(x.day); });
      let quietDay = false;
      for (let d = 1; d < (state.phase ? state.phase.n : 1); d++) if (!executed.has(d)) quietDay = true;
      if (state.myAlign === 'evil' && myTeam === 'demon') vortoxOptions = [state.myChar === 'vortox'];
      else if (quietDay && !state.gameOver) vortoxOptions = [false];
      else vortoxOptions = [false, true];
    }

    const worlds = [];  // {evil:Uint8Array, demon, logf: Float64Array, logw}
    for (const combo of combinations(n, E)) {
      const set = new Set(combo);
      let ok = true;
      for (const g of forceGood) if (set.has(g)) { ok = false; break; }
      if (!ok) continue;
      for (const e of forceEvil) if (!set.has(e)) { ok = false; break; }
      if (!ok) continue;
      const evil = new Uint8Array(n); combo.forEach(i => { evil[i] = 1; });
      for (const d of combo) {
        if (forceDemon !== null && d !== forceDemon) continue;
        if (notDemon.has(d)) continue;
        for (const vortox of vortoxOptions) {
          const w = { evil, demon: d, vortox };
          const logf = new Float64Array(F);
          let logw = vortoxOptions.length > 1 ? Math.log(vortox ? vortoxPrior : 1 - vortoxPrior) : 0;
          for (let j = 0; j < F; j++) { const v = Math.log(factors[j].fn(w)); logf[j] = v; logw += v; }
          worlds.push({ evil, demon: d, vortox, logf, logw });
        }
      }
    }
    if (!worlds.length) return { error: 'Your locks (confirmed good/evil/Demon) contradict each other or the evil count. Loosen one of them.' };

    let maxLog = -Infinity;
    for (const w of worlds) if (w.logw > maxLog) maxLog = w.logw;
    // Who holds the Demon now: if the starting Demon is dead and the game goes on, it passed to a living teammate.
    const demonNow = (w) => {
      if (!R[w.demon].dead || state.gameOver) return [[w.demon, 1]];
      const heirs = [];
      for (let i = 0; i < n; i++) if (i !== w.demon && w.evil[i] && !R[i].dead) heirs.push(i);
      return heirs.length ? heirs.map(i => [i, 1 / heirs.length]) : [[w.demon, 1]];
    };
    let Z = 0, vortoxWeight = 0;
    const pe = new Float64Array(n), pd = new Float64Array(n);
    for (const w of worlds) {
      w.p = Math.exp(w.logw - maxLog); Z += w.p;
      if (w.vortox) vortoxWeight += w.p;
      for (let i = 0; i < n; i++) if (w.evil[i]) pe[i] += w.p;
      for (const [i, share] of demonNow(w)) pd[i] += w.p * share;
    }
    for (let i = 0; i < n; i++) { pe[i] /= Z; pd[i] /= Z; }

    // Leave-one-out: how much does each factor move each player's evil %?
    const reasons = Array.from({ length: n }, () => []);
    for (let j = 0; j < F; j++) {
      let Zj = 0; const pej = new Float64Array(n);
      for (const w of worlds) {
        const p = Math.exp(w.logw - w.logf[j] - maxLog);
        Zj += p;
        for (let i = 0; i < n; i++) if (w.evil[i]) pej[i] += p;
      }
      for (let i = 0; i < n; i++) {
        const delta = pe[i] - pej[i] / Zj;
        if (Math.abs(delta) >= 0.04) reasons[i].push({ delta, label: factors[j].label, kind: factors[j].kind });
      }
    }
    reasons.forEach(r => r.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)));

    // Most likely evil teams
    const teams = new Map();
    for (const w of worlds) {
      const key = Array.from(w.evil).map((v, i) => (v ? i : -1)).filter(i => i >= 0).join(',');
      const t = teams.get(key) || { p: 0, demons: new Map(), members: key.split(',').map(Number) };
      t.p += w.p / Z; for (const [i, share] of demonNow(w)) t.demons.set(i, (t.demons.get(i) || 0) + (w.p / Z) * share);
      teams.set(key, t);
    }
    const topTeams = [...teams.values()].sort((a, b) => b.p - a.p).slice(0, 3).map(t => {
      const [dem] = [...t.demons.entries()].sort((a, b) => b[1] - a[1])[0];
      return { p: t.p, members: t.members.map(i => R[i].id), demon: R[dem].id };
    });

    // Prior (no evidence) for comparison
    const prior = E / n;

    const players = {};
    R.forEach((p, i) => { players[p.id] = { evil: pe[i], demon: pd[i], reasons: reasons[i].slice(0, 3) }; });
    return { players, topTeams, worldCount: worlds.length, evilCount: E, prior, factorCount: factors.length,
      vortox: script.characters.includes('vortox') ? vortoxWeight / Z : null };
  }

  // ── Tips ─────────────────────────────────────────────────────────────────
  // Tip text is rendered as HTML, so player and character names are escaped here.
  function tips(rawState, script, analysis) {
    const state = { ...rawState, players: rawState.players.map(p => ({ ...p, name: escHtml(p.name) })) };
    const out = [];
    const push = (level, text) => out.push({ level, text });
    const R = ring(state);
    const scriptSet = new Set(script.characters);
    const has = (id) => scriptSet.has(id);
    const nameOf = (id) => (state.players.find(p => p.id === id) || {}).name || '?';
    const cname = (c) => escHtml(charInfo(c, script).name);
    const s = setupFor(R.length);
    const alive = aliveCount(state);

    if (R.length >= 5) {
      const mods = script.characters.filter(c => OUTSIDER_MODS[c]).map(c => {
        const [lo, hi] = OUTSIDER_MODS[c]; return `${cname(c)} (${lo === hi ? (lo > 0 ? '+' : '') + lo : lo + ' / +' + hi})`;
      });
      push('info', `With ${R.length} players: <b>${s.townsfolk} Townsfolk, ${s.outsider} Outsider${s.outsider === 1 ? '' : 's'}, ${s.minion} Minion${s.minion > 1 ? 's' : ''}, 1 Demon</b>.` +
        (mods.length ? ` Outsider count can change with ${mods.join(', ')}.` : ''));
    }

    // Claims
    const claims = R.map(p => ({ p, c: claimOf(state, p) }));
    const byChar = {};
    claims.forEach(({ p, c }) => { if (c) (byChar[c] = byChar[c] || []).push(p); });
    for (const [c, ps] of Object.entries(byChar)) {
      if (ps.length > 1 && charInfo(c, script).team !== 'traveller') {
        let extra = '';
        if (has('drunk') && charInfo(c, script).team === 'townsfolk') extra = ' (or one is the Drunk)';
        if (has('philosopher')) extra += ' (or a Philosopher copied it)';
        push('warn', `<b>${ps.map(p => p.name).join(' and ')}</b> all claim <b>${cname(c)}</b>. At least one is lying${extra}.`);
      }
      const info = charInfo(c, script);
      if (!has(c) && info.team !== 'traveller' && info.team !== 'fabled') push('warn', `<b>${ps.map(p => p.name).join(', ')}</b> claimed <b>${cname(c)}</b>, which is not on this script. That is almost certainly a lie.`);
    }
    // A good player bluffing: the solver uses your true role, so flag clashes with your cover here.
    const mine = state.players.find(p => p.id === state.meId);
    const cover = mine && latestClaim(mine);
    if (cover && state.myAlign === 'good' && cover !== state.myChar) {
      const rivals = claims.filter(x => x.p.id !== state.meId && x.c === cover);
      if (rivals.length) push('warn', `<b>${rivals.map(x => x.p.name).join(', ')}</b> also claim${rivals.length === 1 ? 's' : ''} <b>${cname(cover)}</b>, the role you are bluffing.`);
    }
    const outsiderClaims = claims.filter(x => x.c && charInfo(x.c, script).team === 'outsider');
    const tfClaims = claims.filter(x => x.c && charInfo(x.c, script).team === 'townsfolk');
    let maxO = s.outsider, minO = s.outsider;
    script.characters.forEach(c => { if (OUTSIDER_MODS[c]) { minO = Math.min(minO, s.outsider + OUTSIDER_MODS[c][0]); maxO = Math.max(maxO, s.outsider + OUTSIDER_MODS[c][1]); } });
    minO = Math.max(0, minO);
    if (outsiderClaims.length > s.outsider) {
      const mods = script.characters.filter(c => OUTSIDER_MODS[c] && OUTSIDER_MODS[c][1] > 0).map(cname);
      if (outsiderClaims.length > maxO) push('warn', `${outsiderClaims.length} Outsider claims (${outsiderClaims.map(x => x.p.name).join(', ')}), but at most ${maxO} are possible. Someone is bluffing an Outsider.`);
      else push('warn', `${outsiderClaims.length} Outsider claims but only ${s.outsider} expected. Either ${mods.join(' or ') || 'a setup character'} is in play, or someone is bluffing an Outsider.`);
    }
    const tfSlots = s.townsfolk + (has('drunk') ? 1 : 0) + Math.max(0, s.outsider - minO);
    if (tfClaims.length > tfSlots) push('warn', `${tfClaims.length} Townsfolk claims but only ${tfSlots} could be real. At least ${tfClaims.length - tfSlots} of them ${tfClaims.length - tfSlots === 1 ? 'is' : 'are'} bluffing.`);
    const unclaimed = R.filter(p => !claimOf(state, p) && p.id !== state.meId);
    if (unclaimed.length && state.phase && state.phase.kind === 'day' && state.phase.n >= 2) push('info', `No claim yet from: ${unclaimed.map(p => p.name).join(', ')}. Players who avoid claiming by day 2 or later are worth pressing.`);

    // Evidence vs claims
    for (const ev of state.evidence || []) {
      const src = ev.source === 'st' ? 'The Storyteller' : nameOf(ev.source);
      if (ev.type === 'isChar' && ev.players && ev.players[0]) {
        const p = state.players.find(x => x.id === ev.players[0]);
        const pc = p && claimOf(state, p);
        if (pc && pc !== ev.char) push('warn', `${src} says <b>${p.name}</b> is the <b>${cname(ev.char)}</b>, but ${p.name} claims <b>${cname(pc)}</b>. One of them is lying (or drunk or poisoned).`);
      }
      if (ev.type === 'oneIs' && ev.players && ev.players.length === 2) {
        const info = charInfo(ev.char, script);
        if (!isEvilTeam(info.team)) {
          const ps = ev.players.map(id => state.players.find(x => x.id === id)).filter(Boolean);
          const cs = ps.map(p => claimOf(state, p));
          if (cs.every(Boolean) && !cs.includes(ev.char) && ev.char !== 'drunk') push('warn', `${src} says one of <b>${ps.map(p => p.name).join(' / ')}</b> is the <b>${cname(ev.char)}</b>, but neither claims it. ${src} is lying, or one of those two is.`);
        } else {
          const ps = ev.players.map(id => state.players.find(x => x.id === id)).filter(Boolean);
          push('info', `${src}'s ${cname(ev.char)} ping: one of <b>${ps.map(p => p.name).join(' / ')}</b> should be evil (unless ${src} is lying, or a Recluse is involved).`);
        }
      }
      if (ev.type === 'ft' && ev.yes) push('info', `${src}'s Fortune Teller "yes" could be the red herring, a good player who registers as the Demon.`);
    }

    // Specific claims worth remembering
    const claimed = (c) => byChar[c] || [];
    if (claimed('saint').some(p => !p.dead)) push('warn', `<b>${claimed('saint').filter(p => !p.dead).map(p => p.name).join(', ')}</b> claims Saint. Executing a real Saint loses the game, so be sure before you do.`);
    if (claimed('virgin').length) push('info', `Virgin claim (${claimed('virgin').map(p => p.name).join(', ')}): if a trusted player nominates them and dies, both are confirmed.`);
    if (claimed('klutz').length) push('info', `Klutz claim (${claimed('klutz').map(p => p.name).join(', ')}): make sure they know who the town trusts before they die.`);
    if (has('vortox')) push('info', 'The Vortox is on this script. If it is in play, all Townsfolk info is false, and a day with no execution means evil wins.');
    if (has('eviltwin') && claimed('eviltwin').length === 0 && state.phase.n >= 2) push('info', 'If two players accuse each other of being the Evil Twin, one of them is telling the truth. Executing the wrong one (the good twin) loses the game.');

    // Endgame
    if (state.players.length) {
      const nonTravAlive = R.filter(p => !p.dead).length;
      push('info', `${alive} alive. It takes <b>${votesNeeded(state)} votes</b> to put someone on the block.`);
      if (nonTravAlive === 4) push('warn', '<b>4 players alive.</b> If today\'s execution misses the Demon, tonight\'s kill can end the game. With no execution, tomorrow is the final 3. Choose carefully, and use ghost votes.');
      if (nonTravAlive === 3) push('warn', '<b>Final 3!</b> If the Demon isn\'t executed today, evil wins after tonight\'s kill. ' + (has('mayor') ? 'A real Mayor wins for good if there is no execution.' : ''));
      const ghost = state.players.filter(p => p.dead && !p.deadVoteUsed).length;
      if (ghost && nonTravAlive <= 5) push('info', `${ghost} dead player${ghost > 1 ? 's' : ''} still ${ghost > 1 ? 'have' : 'has'} a ghost vote. Those votes decide endgames.`);
    }

    // Analysis headline
    if (analysis && !analysis.error && state.myAlign === 'good') {
      const ranked = R.filter(p => p.id !== state.meId).map(p => ({ p, ...analysis.players[p.id] })).sort((a, b) => b.evil - a.evil);
      const top = ranked.slice(0, 3).filter(x => x.evil > analysis.prior + 0.1);
      if (top.length) push('good', `Most suspicious right now: ${top.map(x => `<b>${x.p.name}</b> (${Math.round(x.evil * 100)}%)`).join(', ')}.`);
      const dem = R.map(p => ({ p, d: analysis.players[p.id].demon })).sort((a, b) => b.d - a.d)[0];
      if (dem && dem.d > 0.3) push('good', `Best Demon guess: <b>${dem.p.name}</b> (${Math.round(dem.d * 100)}%).`);
      const cleared = ranked.filter(x => x.evil < 0.08);
      if (cleared.length) push('good', `Looking trustworthy: ${cleared.map(x => x.p.name).join(', ')}.`);
    }
    return out;
  }

  // Bluff suggestions for evil players: good characters nobody has claimed.
  function bluffs(state, script) {
    const claimedSet = new Set(state.players.filter(p => p.id !== state.meId).map(p => latestClaim(p)).filter(Boolean));
    const safe = ['washerwoman', 'librarian', 'investigator', 'chef', 'undertaker', 'monk', 'soldier', 'ravenkeeper', 'clockmaker', 'dreamer', 'oracle', 'flowergirl', 'towncrier', 'sage', 'chambermaid', 'grandmother', 'innkeeper', 'exorcist', 'courtier'];
    return script.characters
      .map(c => charInfo(c, script))
      .filter(c => (c.team === 'townsfolk' || c.team === 'outsider') && !claimedSet.has(c.id))
      .map(c => ({ ...c, safe: safe.includes(c.id) }))
      .sort((a, b) => (b.safe - a.safe) || (a.team === 'townsfolk' ? -1 : 1));
  }

  // ── Player timeline ──────────────────────────────────────────────────────
  // One chronological story per player, built from what is already recorded.
  // Private notes stay on your own timeline and never appear on anyone else's.
  const phaseRank = (ph) => (ph ? ph.n * 2 + (ph.kind === 'day' ? 1 : 0) : 0);
  function timeline(state, pid) {
    const p = state.players.find(x => x.id === pid);
    if (!p) return [];
    const out = [];
    (p.claims || []).forEach(c => out.push({ type: 'claim', when: c.when, char: c.char }));
    (state.notes || []).forEach((note) => {
      if (note.player === pid) out.push({ type: 'note', when: note.when, note, mentioned: false });
      else if ((note.targets || []).includes(pid) && note.story !== 'true') out.push({ type: 'note', when: note.when, note, mentioned: true });
    });
    (state.evidence || []).forEach((ev) => {
      if (ev.source === pid) out.push({ type: 'info', when: ev.when, ev, role: 'source' });
      else if ((ev.players || []).includes(pid)) out.push({ type: 'info', when: ev.when, ev, role: 'about' });
    });
    (state.noms || []).forEach((nom) => {
      const when = { kind: 'day', n: nom.day };
      if (nom.nominator === pid) out.push({ type: 'nom', when, nom, role: 'nominated' });
      if (nom.nominee === pid) out.push({ type: 'nom', when, nom, role: 'nominee' });
      if ((nom.voters || []).includes(pid)) out.push({ type: 'nom', when, nom, role: 'voted' });
    });
    if (p.dead && p.death) out.push({ type: 'death', when: p.death.when, how: p.death.how });
    return out.map((item, i) => ({ item, i })).sort((a, b) => (phaseRank(a.item.when) - phaseRank(b.item.when)) || (a.i - b.i)).map(x => x.item);
  }

  // ── Bluff Studio ─────────────────────────────────────────────────────────
  // Works from the wording of each ability, so official and custom characters are treated alike.
  const abilityShape = (c) => {
    const ab = (c && c.ability) || '';
    return {
      firstOnly: /^You start knowing/i.test(ab),
      nightly: /^Each night/i.test(ab) && c.id !== 'goon',
      notFirstNight: /^Each night\*|^Once per game, at night\*/i.test(ab),
      once: /^Once per game/i.test(ab),
      dayOnly: /^Once per game, during the day/i.test(ab),
      onDeath: /you die|you died|kills you/i.test(ab),
    };
  };
  function outsiderRange(state, script) {
    const s = setupFor(ring(state).length);
    let min = s.outsider, max = s.outsider;
    script.characters.forEach((c) => {
      if (OUTSIDER_MODS[c]) { min = Math.min(min, s.outsider + OUTSIDER_MODS[c][0]); max = Math.max(max, s.outsider + OUTSIDER_MODS[c][1]); }
    });
    return { setup: s, min: Math.max(0, min), max };
  }

  // Good characters ranked by how safe they are to claim right now.
  function bluffOptions(state, script) {
    const others = ring(state).filter(p => p.id !== state.meId);
    const demonBluffs = (state.bluff && state.bluff.demonBluffs) || [];
    const range = outsiderRange(state, script);
    const outsiders = others.filter(p => { const c = latestClaim(p); return c && charInfo(c, script).team === 'outsider'; }).length;
    return script.characters.map(id => charInfo(id, script))
      // Nobody is told they are the Drunk or the Lunatic, so claiming either gives the bluff away.
      .filter(c => ['townsfolk', 'outsider'].includes(c.team) && c.id !== state.myChar && !['drunk', 'lunatic'].includes(c.id))
      .map((c) => {
        const shape = abilityShape(c);
        const takenBy = others.filter(p => latestClaim(p) === c.id).map(p => p.name);
        const reasons = [];
        let score = 0;
        const add = (n, why) => { score += n; reasons.push({ good: n > 0, text: why }); };
        if (state.myAlign === 'evil' && demonBluffs.includes(c.id)) add(3, 'Not in play, so there is no real one (a Drunk could still think they are it)');
        if (takenBy.length) add(-4, `Already claimed by ${takenBy.join(', ')}`);
        if (c.team === 'outsider') {
          if (outsiders >= range.max) add(-3, 'No Outsider slots left');
          else if (outsiders >= range.setup.outsider) add(-1, 'Would mean more Outsiders than usual');
        }
        if (c.id === 'mutant') add(-2, 'A real Mutant would avoid admitting it');
        if (c.id === 'virgin' || c.id === 'slayer') add(-2, 'Can be tested in public');
        if (shape.firstOnly) add(1, 'Only one piece of info to invent');
        else if (shape.nightly) add(-1, 'Needs a new story every night');
        else if (!shape.once) add(1, 'No nightly story needed');
        return { id: c.id, name: c.name, team: c.team, ability: c.ability, score, reasons, takenBy,
          rating: score >= 2 ? 'strong' : score >= 0 ? 'okay' : 'risky' };
      })
      .sort((a, b) => (b.score - a.score) || (a.team === b.team ? 0 : a.team === 'townsfolk' ? -1 : 1));
  }

  // Compare your cover story with the public record. Issues are plain text.
  function bluffCheck(state, script) {
    const me = state.players.find(p => p.id === state.meId);
    const cover = me ? latestClaim(me) : null;
    if (!cover) return { cover: null, isBluff: false, issues: [], clean: false };
    const isBluff = cover !== state.myChar;
    if (!isBluff) return { cover, isBluff, issues: [], clean: true };

    const info = charInfo(cover, script);
    const shape = abilityShape(info);
    const seen = new Set(); const issues = [];
    let ruleCheck = false; // set while checking the story against the role's rules and public events
    const push = (level, text) => { if (!seen.has(text)) { seen.add(text); issues.push({ level, text, rule: ruleCheck }); } };
    const nameOf = (id) => (state.players.find(p => p.id === id) || {}).name || '?';
    const label = (ph) => phaseLabel(ph);
    const bluff = state.bluff || { demonBluffs: [], plan: [] };
    const entries = [...(bluff.plan || []), ...(state.notes || []).filter(n => n.player === me.id && n.story === 'public')];
    const acts = entries.filter(e => e.kind !== 'said');
    const R = ring(state);

    // The role itself
    if (!script.characters.includes(cover)) push('bad', `${info.name} is not on this script, so nobody will believe it.`);
    if (isEvilTeam(info.team)) push('bad', `${info.name} is an evil character. Claiming it paints a target on you.`);
    const team = state.myAlign === 'evil' ? new Set([...(state.knownEvil || []), state.knownDemon].filter(Boolean)) : new Set();
    state.players.filter(p => p.id !== me.id && latestClaim(p) === cover).forEach((p) => {
      push('bad', team.has(p.id) ? `Your teammate ${p.name} also claims ${info.name}. Agree who keeps it.` : `${p.name} also claims ${info.name}, so one of you will be called a liar.`);
    });
    const history = (me.claims || []).map(c => c.char).filter((c, i, a) => i === 0 || c !== a[i - 1]);
    if (history.length > 1) push('warn', `You publicly changed your claim: ${history.map(c => charInfo(c, script).name).join(' → ')}. Have a reason ready.`);
    if (state.myAlign === 'evil' && (bluff.demonBluffs || []).length) {
      if (bluff.demonBluffs.includes(cover)) push('good', `${info.name} is one of the Demon's bluffs, so no real ${info.name} is in play.`);
      else if (info.team === 'townsfolk' || info.team === 'outsider') push('warn', `${info.name} is not one of the Demon's bluffs, so the real one could be in play.`);
    }

    // Character counts
    const claimsOf = (team) => R.filter(p => { const c = latestClaim(p); return c && charInfo(c, script).team === team; }).length;
    const range = outsiderRange(state, script);
    if (R.length >= 5 && info.team === 'outsider') {
      const n = claimsOf('outsider');
      if (n > range.max) push('bad', `That makes ${n} Outsider claims, but at most ${range.max} are possible.`);
      else if (n > range.setup.outsider) push('warn', `That makes ${n} Outsider claims when ${range.setup.outsider} is normal. People will suspect a bluff or a Baron-style setup change.`);
    }
    if (R.length >= 5 && info.team === 'townsfolk') {
      const slots = range.setup.townsfolk + (script.characters.includes('drunk') ? 1 : 0) + Math.max(0, range.setup.outsider - range.min);
      const n = claimsOf('townsfolk');
      if (n > slots) push('warn', `That makes ${n} Townsfolk claims, but only ${slots} can be real.`);
    }

    // Public events
    ruleCheck = true;
    const executedOn = new Set();
    state.players.forEach((p) => { if (p.dead && p.death && p.death.how === 'execution' && p.death.when) executedOn.add(p.death.when.n); });
    (state.noms || []).forEach((n) => { if (n.executed) executedOn.add(n.day); });
    const executedPlayers = (day) => state.players.filter(p => p.dead && p.death && p.death.how === 'execution' && p.death.when && p.death.when.n === day).map(p => p.id);
    const dayIsOver = (day) => phaseRank(state.phase) > day * 2 + 1;
    const myDeath = me.dead && me.death ? me.death : null;
    if ((cover === 'soldier' || cover === 'sailor') && myDeath && myDeath.how === 'night') push('warn', `You died at night, which a healthy ${info.name} should not. You will need to say you were drunk or poisoned.`);
    if (cover === 'sailor' && myDeath && myDeath.how === 'execution') push('warn', 'You were executed, but a healthy Sailor cannot die.');
    if (cover === 'saint' && myDeath && myDeath.how === 'execution' && !state.gameOver) push('bad', 'You were executed and the game went on, which disproves a healthy Saint.');
    if (cover === 'virgin') {
      const first = (state.noms || []).filter(n => n.nominee === me.id).sort((a, b) => a.day - b.day)[0];
      if (first) {
        const by = state.players.find(p => p.id === first.nominator);
        const c = by && latestClaim(by);
        const died = by && by.dead && by.death && by.death.how === 'execution' && by.death.when && by.death.when.n === first.day;
        if (c && charInfo(c, script).team === 'townsfolk' && !died) push('warn', `${by.name} claims Townsfolk and nominated you first, but was not executed. A real Virgin would have triggered.`);
      }
    }

    // Your story, line by line
    const deathRank = myDeath ? phaseRank(myDeath.when) : Infinity;
    entries.forEach((e) => {
      const isAct = e.kind !== 'said';
      if (isAct && e.when.kind === 'night') {
        if (shape.firstOnly && e.when.n > 1) push('warn', `${info.name} only learns something on Night 1, but your story has info on ${label(e.when)}.`);
        if (shape.notFirstNight && e.when.n === 1) push('bad', `${info.name} does not act on Night 1, but your story has it acting then.`);
        if (shape.dayOnly) push('warn', `${info.name} acts during the day, but your story has it acting on ${label(e.when)}.`);
      }
      if (isAct && !shape.onDeath && phaseRank(e.when) > deathRank) push('bad', `You were dead by ${label(e.when)}, so ${info.name} would have no ability then.`);
      if (cover === 'undertaker' && e.kind === 'learned' && e.when.n >= 2 && dayIsOver(e.when.n - 1)) {
        const day = e.when.n - 1;
        if (!executedOn.has(day)) push('bad', `Nobody was executed on Day ${day}, so an Undertaker would learn nothing on Night ${e.when.n}.`);
        else {
          const wrong = (e.targets || []).filter(t => !executedPlayers(day).includes(t));
          if (wrong.length && executedPlayers(day).length) push('bad', `${wrong.map(nameOf).join(', ')} was not executed on Day ${day}, so an Undertaker could not have seen them.`);
        }
      }
      if (cover === 'monk' && e.kind === 'did') {
        (e.targets || []).forEach((t) => {
          const q = state.players.find(p => p.id === t);
          if (q && q.dead && q.death && q.death.how === 'night' && q.death.when && q.death.when.n === e.when.n) push('warn', `You protected ${q.name} on Night ${e.when.n}, but they died that night.`);
        });
      }
    });
    if (cover === 'ravenkeeper' && acts.some(e => e.kind === 'learned' || e.kind === 'did') && !(myDeath && myDeath.how === 'night')) push('bad', 'A Ravenkeeper only learns something after dying at night, and you have not.');
    if (shape.once && acts.filter(e => e.kind === 'did').length > 1) push('warn', `${info.name} can only act once per game, but your story has it acting more than once.`);

    // Nights you will be asked about
    ruleCheck = false;
    const lastNight = state.phase.kind === 'day' ? state.phase.n : state.phase.n - 1;
    const missing = [];
    if (shape.firstOnly) { if (lastNight >= 1 && !entries.length) missing.push(1); }
    else if (shape.nightly) {
      const told = new Set(entries.map(e => e.when.n));
      for (let n = shape.notFirstNight ? 2 : 1; n <= lastNight; n++) {
        if (n * 2 >= deathRank || told.has(n)) continue;
        if (cover === 'undertaker' && !executedOn.has(n - 1)) continue;
        missing.push(n);
      }
    }
    if (missing.length) push('info', `You have no story yet for ${missing.map(n => `Night ${n}`).join(', ')}. Someone will ask.`);

    const order = { bad: 0, warn: 1, info: 2, good: 3 };
    issues.sort((a, b) => order[a.level] - order[b.level]);
    return { cover, isBluff, issues, missing, clean: !issues.some(i => i.level === 'bad' || i.level === 'warn') };
  }

  // ── Coaching ─────────────────────────────────────────────────────────────
  // Text comes from js/coach.js. A character with no entry (for example on a custom script) gets general advice
  // for its team, shaped only by the wording of its ability. Drunk and Lunatic are never bluffable.
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function coachFor(id, script) {
    const info = charInfo(id, script);
    if (!info || !['townsfolk', 'outsider'].includes(info.team) || ['drunk', 'lunatic'].includes(id)) return null;
    if (typeof BLUFF_COACH !== 'undefined' && hasOwn(BLUFF_COACH, id)) return { generic: false, ...BLUFF_COACH[id] };
    if (typeof TEAM_COACH === 'undefined') return null;
    const t = TEAM_COACH[info.team];
    const sh = abilityShape(info);
    const line = sh.firstOnly ? t.shape.first : sh.onDeath ? t.shape.death : sh.once ? t.shape.once
      : sh.nightly ? (sh.notFirstNight ? t.shape.notFirst : t.shape.nightly) : t.shape.passive;
    return { generic: true, pitch: t.pitch, say: [t.say.replace('[role]', info.name)], reveal: t.reveal, prep: line, risk: t.risk };
  }
  const evilCoachFor = (id) => (typeof EVIL_ROLE_COACH !== 'undefined' && hasOwn(EVIL_ROLE_COACH, id) ? EVIL_ROLE_COACH[id] : null);

  // A short, prioritised list of what to do right now. Uses only what the player knows: their own role, their
  // public claim, the public record and (if evil) the team they were shown. Never more than 4 items.
  function coachNow(state, script) {
    const me = state.players.find(p => p.id === state.meId);
    if (!me || !state.myChar) return [{ level: 'info', title: 'Set yourself up', text: 'Choose which player you are and your character on the Setup tab, and this will coach you through the game.' }];
    if (state.gameOver) return [{ level: 'info', title: 'Game over', text: 'The game is marked as over. Start a new game from Setup when you are ready.' }];
    const items = [];
    const add = (pri, level, title, text) => items.push({ pri, level, title, text });
    const evil = state.myAlign === 'evil';
    const isDemon = evil && charInfo(state.myChar, script).team === 'demon';
    const ph = state.phase || { kind: 'night', n: 1 };
    const isDay = ph.kind === 'day';
    const cover = latestClaim(me);
    const bluffing = !!cover && cover !== state.myChar;
    const check = bluffCheck(state, script);
    const coverInfo = cover ? charInfo(cover, script) : null;
    const cName = coverInfo ? coverInfo.name : 'your claim';
    const shape = coverInfo ? abilityShape(coverInfo) : {};
    const coach = bluffing ? coachFor(cover, script) : null;
    const alive3 = ring(state).filter(p => !p.dead).length;
    const names = (list) => list.map(p => p.name).join(' and ');
    const team = evil ? new Set([...(state.knownEvil || []), state.knownDemon].filter(Boolean)) : new Set();

    // Dead
    if (me.dead) {
      const ghost = me.deadVoteUsed ? 'Your ghost vote is already spent.' : 'You still have one ghost vote for the rest of the game, so save it for a vote that matters.';
      add(5, 'info', 'You are dead', `You no longer have an ability, but you can still talk. ${ghost} Keep your ${bluffing ? cName + ' ' : ''}story straight: the table still believes or doubts dead players.`);
      if (bluffing && !evil) add(8, 'info', 'Come clean when it helps', 'If you are good and still bluffing, say your real role once it can help your team. A dead player the town trusts is worth more than a safe story.');
    } else if (isDay) {
      // On the block, or nominated today
      const todays = (state.noms || []).filter(n => n.day === ph.n && !n.executed);
      const mine = todays.filter(n => n.nominee === me.id);
      const need = votesNeeded(state);
      const onBlock = mine.some(n => n.votes >= need && todays.every(o => o === n || o.votes < n.votes));
      const saint = cover === 'saint' ? ' As a Saint, say plainly that executing a real Saint loses the game for the town. If you are executed and the game goes on, the claim is false.' : '';
      if (onBlock) {
        if (evil) add(0, 'bad', 'You are on the block', `Stay calm and say your ${cName} claim in one plain sentence, then answer with the details you prepared. Do not accuse a teammate to save yourself, and your team should not all rush to vote the same way for you.${saint}`);
        else if (bluffing) add(0, 'bad', 'You are on the block', `Dying behind a cover story helps nobody on your team. Unless it protects someone, say your real role now and give your real information.${saint}`);
        else add(0, 'bad', 'You are on the block', 'Say your role and exactly what you learned, night by night, then ask who is voting and why.');
      } else if (mine.length) {
        const ask = evil ? ' Do not ask your teammates to save you, and do not change your story under pressure.' : ' Do not change your story under pressure.';
        add(2, 'warn', 'You were nominated today', `Answer in a sentence or two and repeat what you have already said${bluffing ? ` as the ${cName}` : ''}.${ask}${saint}`);
      }
    }

    // Endgame (alive players only)
    if (!me.dead && alive3 === 3) {
      const mayorNote = cover === 'mayor' && evil ? ' A Mayor claim fits here: asking for no execution is natural, and if the town agrees the night kill can end the game.' : '';
      if (!isDay) add(3, evil ? 'info' : 'bad', 'Final 3', evil
        ? 'If the Demon kills tonight, only 2 players remain and evil wins. Keep your story steady until the game ends.'
        : 'If the Demon kills tonight, only 2 players remain and evil wins. Only a night with no death keeps the game going.');
      else if (evil) add(3, 'bad', 'Final 3', isDemon
        ? `If you are not executed today, you win after the night kill or sooner. Keep your cover calm and make the town split its vote.${mayorNote}`
        : `The town must execute the Demon today, or evil wins. Keep the vote off your Demon, and do not let your votes or defence line up with theirs.${mayorNote}`);
      else add(3, 'bad', 'Final 3', 'If nobody is executed today, the Demon wins after the night kill, unless a real Mayor is among the three. Executing the wrong player ends the game too. Do not skip the vote: choose the most likely Demon and stand behind it.');
      if (isDay && bluffing && !evil) add(4, 'warn', 'Come clean now', 'With three left, nobody can verify a cover story. If you have been bluffing, say your real role and what you know.');
      if (evil && state.myChar === 'witch') add(6, 'info', 'Witch', 'With 3 players alive you lose your ability.');
    } else if (!me.dead && alive3 === 4) {
      const text = !isDay
        ? `Tonight's kill will probably leave 3 alive, so tomorrow's execution decides the game.${evil ? ' Keep your story steady and do not vote in step with your Demon.' : ''}`
        : evil
          ? "If today's execution misses the Demon, 3 remain and tonight's kill wins the game for evil. With no execution, tomorrow is the Final 3. Keep your story steady and do not vote in step with your Demon."
          : "A wrong execution today leaves 3, and tonight's kill ends the game. If you are unsure, skipping the execution keeps one last vote for tomorrow's Final 3.";
      add(3, 'warn', '4 alive', text);
      if (evil && state.myChar === 'scarletwoman') add(6, 'info', 'Scarlet Woman', 'You only replace a dead Demon while 5 or more players are alive, so at 4 alive that backup is gone.');
    }

    // No cover yet
    if (!cover && !me.dead) {
      if (evil) {
        const bluffsKnown = (state.bluff && state.bluff.demonBluffs || []).length;
        const hint = bluffsKnown ? ' One of the Demon\'s bluffs is the safest pick, since no real one is in play.' : ' Choose a role nobody has claimed yet from the list below.';
        add(1, 'warn', 'Pick a cover', (ph.kind === 'night' && ph.n === 1
          ? 'Choose your cover tonight, before the first day conversation: "who are you?" is the first question.'
          : isDay && ph.n === 1 ? 'It is Day 1 and you have no public claim. Pick one before you are asked, because a prepared answer draws less suspicion than silence.'
            : `You still have no public claim on ${phaseLabel(ph)}. Pick one before you are asked again.`) + hint);
      } else {
        add(9, 'info', 'No claim yet', 'You have not told the table a role. As a good player you can claim your real one when it helps. Bluff only with a clear reason.');
      }
    }

    // Claiming your own evil character
    if (evil && cover && cover === state.myChar) add(1, 'bad', 'You claimed your real role', 'You are publicly claiming your true evil character. Unless that is a deliberate plan, pick a good character as your cover.');

    // Your cover against the record
    if (bluffing) {
      const rivals = state.players.filter(p => p.id !== me.id && latestClaim(p) === cover);
      const mates = rivals.filter(p => team.has(p.id));
      const others = rivals.filter(p => !team.has(p.id));
      if (mates.length) add(1, 'bad', 'Double claim with your teammate', `${names(mates)} also claims ${cName}. Settle it in private before the next public talk: one keeps it, and the other moves to a different role. Do not argue about it in public.`);
      if (others.length) {
        const bluffRole = evil && ((state.bluff && state.bluff.demonBluffs) || []).includes(cover);
        add(1, 'bad', 'Double claim', evil
          ? `${names(others)} also claims ${cName}${bluffRole ? ', which is one of the Demon\'s bluffs, so unless they are a Drunk they are lying, though the table cannot know that' : ' and could be the real one'}. Do not fight them: stay calm, keep your details consistent, and decide in advance whether to drop it.`
          : `${names(others)} also claims ${cName}. Give your details first and in full, and ask for theirs, because the gaps will show. If your bluff protects nobody, your real role may be the stronger claim now.`);
      }
      const fixes = [
        [/not on this script/, 'Change your cover', 'Pick a character from this script. Switching once is better than defending a claim nobody can believe.'],
        [/evil character/, 'Your claim is an evil character', 'Switch to a good character from the ranked list below, and switch only once.'],
        [/publicly changed your claim/, 'You changed your claim', 'Have one short reason ready for the switch and do not change again. The table remembers every change.'],
        [/Outsider claims/, 'Too many Outsider claims', 'The table counts Outsiders. Move to a Townsfolk cover, or be ready to explain why the count is high.'],
        [/Townsfolk claims/, 'Many Townsfolk claims', 'Some of those claims are false. Expect the table to compare details, and make yours the most specific.'],
        [/You were dead by/, 'Your story acts after death', 'Remove or correct the line that has you using the ability after you died.']
      ];
      let serious = 0;
      check.issues.filter(i => (i.level === 'bad' || i.level === 'warn') && !/also claims/.test(i.text)).forEach((i) => {
        if (serious >= 2) return;
        const f = fixes.find(x => x[0].test(i.text));
        add(i.level === 'bad' ? 1 : 4, i.level, f ? f[1] : 'Fix this in your story', f ? `${i.text} ${f[2]}` : `${i.text} Edit that line in Your story, or change your cover before you speak again.`);
        serious++;
      });

      if (!me.dead) {
        const missing = check.missing || [];
        if (missing.length) {
          const label = missing.map(n => `Night ${n}`).join(', ');
          const prep = coach ? coach.prep : 'Write down what your ability would have told you.';
          add(4, 'warn', `Prepare ${label}`, `Someone will ask what you learned as the ${cName}. ${prep}`);
        }
        const hasNight1 = shape.firstOnly || (shape.nightly && !shape.notFirstNight);
        if (ph.kind === 'night' && ph.n === 1) add(7, 'info', 'Before Day 1', hasNight1
          ? `The ${cName} gets information on Night 1. Write down what you will say, and who it points at, before the first talk.`
          : `The ${cName} gives you nothing you must report from Night 1. If asked, say so plainly rather than inventing something.`);
        else if (isDay && ph.n === 1) add(shape.notFirstNight ? 2 : 7, shape.notFirstNight ? 'warn' : 'info', 'Day 1 talk', `${shape.notFirstNight ? `The ${cName} does not act on Night 1, so do not say "last night I..." yet. ` : ''}Say your claim the same way each time and give details only when asked. Mark lines as told in Your story as you say them.`);
        else if (ph.kind === 'night') add(7, 'info', 'Plan tomorrow', shape.nightly || shape.firstOnly
          ? `Decide your ${cName} info for ${phaseLabel(ph)} now, before anyone asks.`
          : `The ${cName} has nothing new to report for ${phaseLabel(ph)}. Keep your story as it is.`);
        else add(7, 'info', 'Stay consistent', 'Before you speak, check Your story for last night, and mark each line you say as told. Match what you said on earlier days.');
        if (evil) add(9, 'info', 'Play the evil team', isDemon
          ? 'Let your cover do the work and stay low. Avoid voting in the same pattern as your Minions.'
          : 'Protect your Demon without being seen to. Do not accuse them, and do not vote the same way as your team every time: a group that always votes together is easy to spot.');
        else add(9, 'info', 'Come clean on purpose', 'Bluff only for a reason, such as keeping a weak role away from the Demon. Good players must be believed in the end, so decide when you will say your real role: before an execution, or once the danger passes.');
      }
    }
    if (evil && !bluffing && !me.dead && cover !== state.myChar) {
      add(9, 'info', 'Play the evil team', isDemon
        ? 'Let your cover do the work and stay low. Avoid voting in the same pattern as your Minions.'
        : 'Protect your Demon without being seen to. Do not accuse them, and do not vote the same way as your team every time.');
    }
    return items.map((x, i) => ({ x, i })).sort((a, b) => (a.x.pri - b.x.pri) || (a.i - b.i)).slice(0, 4)
      .map(({ x }) => ({ level: x.level, title: x.title, text: x.text }));
  }

  // ── Saved games ──────────────────────────────────────────────────────────
  // Game files can come from other people, so keep only well-formed values.
  function safeId(v) {
    return typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v) ? v : null;
  }
  const safeNum = (v, min, max, fallback) => { const x = Number(v); return Number.isFinite(x) ? Math.max(min, Math.min(max, Math.trunc(x))) : fallback; };
  const safeText = (v, max) => (v === null || v === undefined ? '' : String(v).slice(0, max));
  const safePhase = (ph) => ({ kind: ph && ph.kind === 'day' ? 'day' : 'night', n: safeNum(ph && ph.n, 1, 99, 1) });
  const safeIds = (list) => [...new Set((Array.isArray(list) ? list : []).map(safeId).filter(Boolean))];

  // A custom script, from a game file or the saved script library.
  function sanitizeScript(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const custom = {};
    Object.entries(raw.custom || {}).forEach(([k, c]) => {
      if (safeId(k) && c && typeof c === 'object') custom[k] = { name: safeText(c.name, 60) || k, team: TEAMS.includes(c.team) ? c.team : 'townsfolk', ability: safeText(c.ability, 500) };
    });
    const libId = safeId(raw.libId);
    return { id: 'custom', ...(libId ? { libId } : {}), name: safeText(raw.name, 80) || 'Custom script', characters: safeIds(raw.characters), custom };
  }

  function sanitizeGame(raw, base) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const seen = new Set();
    const players = (Array.isArray(s.players) ? s.players : []).flatMap((p) => {
      const id = p && safeId(p.id);
      if (!id || seen.has(id)) return [];
      seen.add(id);
      const how = p.death && ['night', 'execution', 'other'].includes(p.death.how) ? p.death.how : null;
      return [{ id, name: safeText(p.name, 60), traveller: !!p.traveller,
        claims: (Array.isArray(p.claims) ? p.claims : []).flatMap(c => (c && safeId(c.char) ? [{ char: c.char, when: safePhase(c.when) }] : [])),
        dead: !!p.dead, death: p.dead && how ? { how, when: safePhase(p.death.when) } : null, deadVoteUsed: !!p.deadVoteUsed,
        gut: safeNum(p.gut, -2, 2, 0), lock: ['good', 'evil', 'demon', 'notdemon'].includes(p.lock) ? p.lock : '', notes: safeText(p.notes, 5000) }];
    });
    const evidence = (Array.isArray(s.evidence) ? s.evidence : []).flatMap((e) => {
      const id = e && safeId(e.id);
      const source = e && (e.source === 'st' ? 'st' : safeId(e.source));
      const type = e && safeId(e.type);
      if (!id || !source || !type) return [];
      return [{ id, source, type, template: safeId(e.template) || 'note', when: safePhase(e.when), players: safeIds(e.players), n: safeNum(e.n, 0, 99, 0),
        char: safeId(e.char) || '', yes: !!e.yes, same: !!e.same, evil: !!e.evil, day: safeNum(e.day, 1, 99, 1), text: safeText(e.text, 2000) }];
    });
    const noms = (Array.isArray(s.noms) ? s.noms : []).flatMap((n) => {
      const id = n && safeId(n.id);
      if (!id || !safeId(n.nominator) || !safeId(n.nominee)) return [];
      return [{ id, day: safeNum(n.day, 1, 99, 1), nominator: n.nominator, nominee: n.nominee, voters: safeIds(n.voters), votes: safeNum(n.votes, 0, 99, 0), executed: !!n.executed }];
    });
    const notes = (Array.isArray(s.notes) ? s.notes : []).flatMap((x) => {
      const id = x && safeId(x.id);
      if (!id || !seen.has(x.player)) return [];
      return [{ id, player: x.player, when: safePhase(x.when), kind: ['did', 'learned', 'said'].includes(x.kind) ? x.kind : 'said',
        targets: safeIds(x.targets).filter(t => seen.has(t)), char: safeId(x.char) || '', text: safeText(x.text, 2000),
        story: x.story === 'true' && x.player === s.meId ? 'true' : 'public' }];
    });
    const rawBluff = s.bluff && typeof s.bluff === 'object' ? s.bluff : {};
    const bluff = { demonBluffs: safeIds(rawBluff.demonBluffs).slice(0, 3),
      plan: (Array.isArray(rawBluff.plan) ? rawBluff.plan : []).flatMap((x) => {
        const id = x && safeId(x.id);
        if (!id) return [];
        return [{ id, player: seen.has(x.player) ? x.player : (seen.has(s.meId) ? s.meId : ''), when: safePhase(x.when), kind: ['did', 'learned', 'said'].includes(x.kind) ? x.kind : 'said',
          targets: safeIds(x.targets).filter(t => seen.has(t)), char: safeId(x.char) || '', text: safeText(x.text, 2000), story: 'public' }];
      }) };
    const customScript = sanitizeScript(s.customScript);
    const hasScript = s.scriptId === 'custom' ? !!customScript : Object.prototype.hasOwnProperty.call(SCRIPTS, s.scriptId);
    const has = (id) => (seen.has(id) ? id : null);
    return { ...base, scriptId: hasScript ? s.scriptId : base.scriptId, customScript, players, meId: has(s.meId), myChar: safeId(s.myChar) || '',
      myAlign: s.myAlign === 'evil' ? 'evil' : 'good', knownEvil: safeIds(s.knownEvil).filter(has), knownDemon: has(s.knownDemon),
      evilOverride: s.evilOverride ? safeNum(s.evilOverride, 1, 14, null) : null, phase: safePhase(s.phase), evidence, noms, notes, bluff, gameOver: !!s.gameOver,
      tab: ['setup', 'town', 'info', 'days', 'read', 'bluff', 'guide'].includes(s.tab) ? s.tab : base.tab };
  }

  return { charInfo, isEvilTeam, setupFor, evilCountFor, analyze, tips, bluffs, aliveCount, votesNeeded, phaseLabel, latestClaim, claimOf, ring, timeline, phaseRank, bluffOptions, bluffCheck, coachFor, evilCoachFor, coachNow, safeId, sanitizeScript, sanitizeGame };
})();
