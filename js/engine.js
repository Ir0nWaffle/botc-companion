// Pure game logic: setup counts, the "who's lying" world solver, and tips.
// No DOM access here, so it can be tested on its own.

const Engine = (() => {
  // Likelihood multipliers. A good player's info that turns out false is
  // possible (drunk / poisoned / Recluse / Spy), just unlikely.
  const NOISE = 0.15;          // a good source's info is false
  const ST_NOISE = 0.02;       // a public / Storyteller fact is false
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

    // Source wrapper: evil sources may say anything; good ones are usually right.
    function sourced(src, fn) {
      if (src === 'st') return (w) => (fn(w) ? 1 : ST_NOISE);
      const si = at(src);
      if (si === undefined) return null;
      return (w) => (w.evil[si] ? 1 : (fn(w) ? 1 : NOISE));
    }

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

    // Deaths
    R.forEach((p, i) => {
      if (!p.dead || !p.death) return;
      if (p.death.how === 'night') {
        factors.push({ kind: 'death', label: `${p.name} died at night (Demons rarely kill their own team)`, about: [p.id], fn: (w) => (w.evil[i] ? 0.4 : 1) });
      } else if (p.death.how === 'execution' && !state.gameOver) {
        factors.push({ kind: 'death', label: `${p.name} was executed and the game went on`, about: [p.id], fn: (w) => (w.demon === i ? 0.2 : 1) });
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
          const si = src === 'st' ? undefined : at(src);
          factors.push({ kind: 'ev', ev: ev.id, label: `${srcName}: "yes" on ${ev.players.map(nm).join(' & ')} (${phaseLabel(ev.when)})`, about: [...ev.players, src].filter(x => x !== 'st'),
            fn: (w) => {
              if (si !== undefined && w.evil[si]) return 1;
              if (ps.includes(w.demon)) return 1;
              return ps.some(i => !w.evil[i]) ? 0.3 : NOISE;
            } });
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
      const fn = sourced(src, holds);
      if (!fn) continue;
      factors.push({ kind: 'ev', ev: ev.id, label: `${srcName}: ${text} (${phaseLabel(ev.when)})`, about: [...(ev.players || []), src].filter(x => x && x !== 'st'), fn });
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
        const w = { evil, demon: d };
        const logf = new Float64Array(F);
        let logw = 0;
        for (let j = 0; j < F; j++) { const v = Math.log(factors[j].fn(w)); logf[j] = v; logw += v; }
        worlds.push({ evil, demon: d, logf, logw });
      }
    }
    if (!worlds.length) return { error: 'Your locks (confirmed good/evil/Demon) contradict each other or the evil count. Loosen one of them.' };

    const maxLog = Math.max(...worlds.map(w => w.logw));
    let Z = 0;
    const pe = new Float64Array(n), pd = new Float64Array(n);
    for (const w of worlds) {
      w.p = Math.exp(w.logw - maxLog); Z += w.p;
      for (let i = 0; i < n; i++) if (w.evil[i]) pe[i] += w.p;
      pd[w.demon] += w.p;
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
      t.p += w.p / Z; t.demons.set(w.demon, (t.demons.get(w.demon) || 0) + w.p / Z);
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
    return { players, topTeams, worldCount: worlds.length, evilCount: E, prior, factorCount: factors.length };
  }

  // ── Tips ─────────────────────────────────────────────────────────────────
  function tips(state, script, analysis) {
    const out = [];
    const push = (level, text) => out.push({ level, text });
    const R = ring(state);
    const scriptSet = new Set(script.characters);
    const has = (id) => scriptSet.has(id);
    const nameOf = (id) => (state.players.find(p => p.id === id) || {}).name || '?';
    const cname = (c) => charInfo(c, script).name;
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
      if (!has(c) && info.team !== 'traveller' && info.team !== 'fabled') push('warn', `<b>${ps.map(p => p.name).join(', ')}</b> claimed <b>${info.name}</b>, which is not on this script. That is almost certainly a lie.`);
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
          if (cs.every(Boolean) && !cs.includes(ev.char) && ev.char !== 'drunk') push('warn', `${src} says one of <b>${ps.map(p => p.name).join(' / ')}</b> is the <b>${info.name}</b>, but neither claims it. ${src} is lying, or one of those two is.`);
        } else {
          const ps = ev.players.map(id => state.players.find(x => x.id === id)).filter(Boolean);
          push('info', `${src}'s ${info.name} ping: one of <b>${ps.map(p => p.name).join(' / ')}</b> should be evil (unless ${src} is lying, or a Recluse is involved).`);
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
      if (nonTravAlive === 4) push('warn', '<b>4 players alive.</b> If today\'s execution misses the Demon, the next night may bring the final 3. Choose carefully, and use ghost votes.');
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
    const claimedSet = new Set(state.players.map(p => latestClaim(p)).filter(Boolean));
    const safe = ['washerwoman', 'librarian', 'investigator', 'chef', 'undertaker', 'monk', 'soldier', 'ravenkeeper', 'clockmaker', 'dreamer', 'oracle', 'flowergirl', 'towncrier', 'sage', 'chambermaid', 'grandmother', 'innkeeper', 'exorcist', 'courtier'];
    return script.characters
      .map(c => charInfo(c, script))
      .filter(c => (c.team === 'townsfolk' || c.team === 'outsider') && !claimedSet.has(c.id))
      .map(c => ({ ...c, safe: safe.includes(c.id) }))
      .sort((a, b) => (b.safe - a.safe) || (a.team === 'townsfolk' ? -1 : 1));
  }

  return { charInfo, isEvilTeam, setupFor, evilCountFor, analyze, tips, bluffs, aliveCount, votesNeeded, phaseLabel, latestClaim, claimOf, ring };
})();
