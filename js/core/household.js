/* The household: wives' moods, the seasonal chance of an incident, and what happens when the player answers one.
 * Each wife has a 50% chance per season of an incident. Which one depends on her Happiness, her temperament,
 * her grudges, and who else lives nearby. Incidents wait in state.pending until the player answers each. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const E = IS.Economy, T = IS.Traits, N = IS.Names;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const r1 = (v) => Math.round(v * 10) / 10;
  const INCIDENT_CHANCE = 0.5;
  const TOUCHY = ['jealous', 'proud', 'meddling', 'vindictive', 'malicious'];

  const alive = (state, id) => state.people[id] && state.people[id].deathYear == null;
  const hhHas = (state, id) => ['wives', 'concubines', 'children', 'kin', 'servants', 'thralls'].some((k) => (state.household[k] || []).includes(id));
  const rngOf = (state) => IS.Turn.rngOf(state);

  /** A word for how a wife feels, from her Happiness. */
  function mood(h) { return h < 20 ? 'hostile' : h < 40 ? 'sullen' : h < 60 ? 'uneasy' : h < 75 ? 'content' : 'happy'; }

  function roleOf(p) {
    if (p.kind === 'thrall') return 'a thrall';
    const r = p.role;
    if (r === 'servant') return 'a servant';
    if (['mother', 'stepmother', 'brother', 'sister', 'concubine'].includes(r)) return 'your ' + r;
    if (r === 'wife') return 'your other wife';
    return r || 'of the house';
  }

  function neighbors(state, wife) {
    return Object.values(state.families || {}).filter((f) => f.head && f.farm !== state.farm.name && !(wife && wife.kin && f.farm === wife.kin.farm));
  }

  /* ---------- the context the incident definitions work with ---------- */
  function makeCtx(state, rng, wife, params, log) {
    const head = state.people[state.headId];
    const rep = state.report;
    const ctx = {
      state, rng, wife, head, p: params || {}, tier: E.tierOfFarm(state.farm),
      /** The man who fights for the house: the head, or for a boy head his strongest grown kinsman. */
      get fighter() { return (IS.Feud && IS.Feud.champion(state)) || head; },
      get minor() { return E.yearOf(state) - head.birthYear < 16; },
      wname: wife ? wife.first : '',
      has: (t) => !!wife && wife.traits.includes(t),
      pay: (x) => E.pay(state.farm, x),
      earn: (x) => { state.farm.vadmal += x; },
      honor(d, why) {
        if (!d) return;
        if (head.deathYear == null) head.attrs.honor = r1(clamp(head.attrs.honor + d, 1, 100));
        if (rep) { rep.honorParts.push({ d, why }); rep.honorDelta = r1((rep.honorDelta || 0) + d); }
        if (IS.Saga && Math.abs(d) >= 1.5) IS.Saga.note(state, 'deed', why, d);
        if (/was outlawed/.test(why || '') && params && params.farm) { state.struck = state.struck || {}; state.struck[params.farm] = true; }
        state.lastHonor = head.attrs.honor;
        state.peakHonor = Math.max(state.peakHonor || 0, head.attrs.honor);
      },
      // How you treat her leaves a lasting mark (bias) as well as an immediate one.
      happy(d) {
        if (!wife) return;
        wife.attrs.happiness = clamp(Math.round(wife.attrs.happiness + d), 0, 100);
        wife.bias = clamp((wife.bias || 0) + (d < 0 ? d * 0.45 : d * 0.2), -35, 10);
      },
      goodwill(farm, d) { if (!farm) return; state.relations[farm] = clamp((state.relations[farm] || 0) + d, -100, 100); },
      reveal(t) {
        if (wife && wife.traits.includes(t) && !wife.knownTraits.includes(t)) {
          wife.knownTraits.push(t);
          log.push(`You have learned something of her: she is ${T.WIFE[t].name.toLowerCase()}.`);
        }
      },
      sulk(n) { if (wife) wife.sulkUntil = state.turn + n; },
      neighbor() {
        const pool = neighbors(state, wife);
        if (!pool.length) return null;
        // houses that dislike you are the ones who turn up with quarrels; friends seldom do
        const wts = pool.map((x) => { const r = (state.relations && state.relations[x.farm]) || 0; return r < 0 ? 1 + (-r) / 12 : r > 20 ? 0.5 : 1; });
        let pick = rng.float(0, wts.reduce((a, b) => a + b, 0)), k = 0;
        while (k < pool.length - 1 && pick > wts[k]) { pick -= wts[k]; k++; }
        const f = pool[k];
        return { farm: f.farm, head: f.head.first, nwife: N.female(rng).first };
      },
      addGrudge(target, reason, intensity) {
        if (!wife) return;
        const list = (state.grudges[wife.id] = state.grudges[wife.id] || []);
        const same = list.find((g) => g.target.type === target.type && g.target.farm === target.farm && g.target.id === target.id);
        if (same) same.intensity = Math.min(100, same.intensity + intensity); else list.push({ target, reason, intensity });
      },
      feud(farm, why) {
        IS.Feud.ensure(state, farm, why);
      },
      removePerson(id) {
        IS.Turn.removeFromHousehold(state, id);
        state.people[id].left = true;
      },
      roleOf,
      age: (p) => E.yearOf(state) - p.birthYear,
      marriage: {
        needsHeir: () => IS.Marriage.needsHeir(state),
        suit: () => IS.Marriage.suitChance(state),
        wife: () => IS.Marriage.newWife(state, rng, E.yearOf(state)),
        concubine: () => IS.Marriage.newConcubine(state, rng, E.yearOf(state)),
        can: () => ({ wife: state.household.wives.length < 2, concubine: IS.Marriage.canTakeConcubine(state) }),
      },
      raid: IS.Raid ? {
        deputies: () => IS.Raid.deputies(state),
        fit: () => IS.Raid.headFit(state) && !state.expedition,
        run: (spec) => IS.Raid.run(state, rng, spec, (d, why) => ctx.honor(d, why)),
        estimate: (dest) => IS.Raid.deathEstimate(state, dest, false),
        raiders: () => IS.Raid.raiders(state),
        runMember: (spec) => IS.Raid.runMember(state, rng, spec, (d, why) => ctx.honor(d, why)),
        memberEstimate: (p, dest, outfitted) => IS.Raid.memberDeathEstimate(state, p, dest, outfitted),
      } : null,
      kill(p, text, cause) {
        const year = E.yearOf(state), age = year - p.birthYear;
        p.deathYear = year; p.deathCause = cause || 'fever'; p.deathText = text; p.deathAge = age;
        if (p.role === 'wife' || p.role === 'concubine') { (state.news = state.news || []).push({ type: 'funeral', pid: p.id, hid: state.headId }); const mm = state.marriages.find((x) => x.wifeId === p.id && x.status === 'married'); if (mm) mm.status = 'wife died'; }
        if (IS.Saga) IS.Saga.death(state, p, text, true);
        if (/feud|fight|killed/.test(cause || '') && p.sex === 'M' && ['son', 'brother', 'servant'].includes(p.role)) state.lastFeudDead = { name: p.first, role: p.role, turn: state.turn };
        IS.Turn.removeFromHousehold(state, p.id);
        const mother = p.motherId && state.people[p.motherId];
        if (mother) { mother.lastLossTurn = state.turn; if (mother.attrs && state.household.wives.includes(mother.id)) mother.attrs.happiness = clamp(mother.attrs.happiness - 10, 0, 100); }
      },
      divorce(byWife) {
        const m = state.marriages.find((x) => x.wifeId === wife.id && x.status === 'married');
        const dowry = m ? m.dowry : 0;
        const paid = E.pay(state.farm, dowry);
        IS.Turn.removeFromHousehold(state, wife.id);
        wife.role = 'divorced'; wife.divorcedYear = E.yearOf(state);
        if (m) { m.status = 'divorced'; m.endY = E.yearOf(state); }
        state.married = state.household.wives.length > 0;
        const kin = wife.kin && wife.kin.farm;
        const short = dowry - paid;
        let enemy = '';
        if (kin && byWife) {
          // a wife who leaves because of you takes her family's friendship with her
          state.relations[kin] = clamp(Math.min((state.relations[kin] || 0) - 45, -55), -100, 100);
          if (IS.Feud && state.families && state.families[kin]) {
            const f = IS.Feud.ensure(state, kin, `${wife.first} left your house and went home to them`);
            if (short > 0.5) f.owedThem += Math.round(short);
            enemy = ` Her father said, in front of witnesses, that ${state.farm.name} is no friend of ${kin} from this day.`;
          }
          if (IS.Saga) IS.Saga.note(state, 'divorce', `His wife ${wife.first} left him and went home to ${kin}, and her kin were his enemies after.`, 2);
        } else ctx.goodwill(kin, -25);
        return `${wife.first} went back to ${kin || 'her kin'}. ${Math.round(paid).toLocaleString('en-US')} ells of her dowry went with her${short > 0.5 ? `, and you owe the rest of ${Math.round(short)} ells` : ''}.${enemy}`;
      },
    };
    return ctx;
  }

  /* ---------- seasonal mood ---------- */
  function updateHappiness(state, rng, rep, res) {
    const head = state.people[state.headId];
    const hunger = res ? res.hungerFrac : 0;
    for (const id of state.household.wives) {
      const w = state.people[id];
      const grudgeSum = (state.grudges[id] || []).reduce((s, g) => s + g.intensity, 0);
      let target = 65 + (head.attrs.honor - 50) * 0.12 - 45 * hunger - Math.min(14, grudgeSum * 0.12);
      if (w.lastLossTurn != null && state.turn - w.lastLossTurn <= 3) target -= 8;
      if (w.lastBirthTurn != null && state.turn - w.lastBirthTurn <= 2) target += 5;
      if (state.expedition) target -= 3;
      if (w.traits.includes('jealous')) target -= 3;
      if (w.traits.includes('vindictive')) target -= 3;
      if (w.traits.includes('proud')) target -= 2;
      if (w.traits.includes('malicious')) target -= 4;
      if (w.traits.includes('peacemaker')) target += 4;
      if (w.traits.includes('capable')) target += 2;
      target += w.bias || 0;
      w.bias = Math.abs(w.bias || 0) < 0.5 ? 0 : (w.bias || 0) * 0.93;
      const cur = w.attrs.happiness;
      w.attrs.happiness = clamp(Math.round(cur + (target - cur) * 0.2 + rng.normal(0, 3)), 0, 100);
      // grudges fade
      const list = state.grudges[id] || [];
      list.forEach((g) => { g.intensity -= w.traits.includes('vindictive') ? 0.5 : 2; });
      state.grudges[id] = list.filter((g) => g.intensity > 0);
      // slowly learn her ways
      const hidden = w.traits.filter((t) => !w.knownTraits.includes(t));
      if (hidden.length && rng.chance(0.08)) w.knownTraits.push(rng.pick(hidden));
      // a restless wife picks someone to resent
      const hh = state.household;
      if (w.attrs.happiness < 35 && w.traits.some((t) => TOUCHY.includes(t)) && !(state.grudges[id] || []).some((g) => g.target.type === 'person') && rng.chance(0.15)) {
        const pool = [...hh.kin, ...hh.servants, ...hh.thralls].filter((x) => alive(state, x));
        if (pool.length) { const t = rng.pick(pool); (state.grudges[id] = state.grudges[id] || []).push({ target: { type: 'person', id: t }, reason: 'friction in the house', intensity: rng.int(20, 40) }); }
      }
    }
  }

  /** Cash the wives' temperaments add or take from the household each season (the player is only hinted at it). */
  function wifeFlow(state, rep) {
    let flow = 0;
    const tier = E.tierOfFarm(state.farm);
    for (const id of state.household.wives) {
      const w = state.people[id];
      if (w.traits.includes('wasteful')) flow -= 6 + 4 * tier;
      if (w.traits.includes('thrifty')) flow += 5 + 3 * tier;
    }
    if (!flow) return;
    if (flow < 0) { const paid = E.pay(state.farm, -flow); flow = -paid; } else state.farm.vadmal += flow;
    rep.wifeFlow = Math.round(flow);
    if (flow <= -3) rep.household.push('The housekeeping cost more than it should have.');
    else if (flow >= 3) rep.household.push('The housekeeping came in under what you had expected.');
  }

  /* ---------- picking incidents ---------- */
  function pickIncident(state, rng, wife) {
    const h = wife.attrs.happiness;
    const ctx = makeCtx(state, rng, wife, {}, []);
    const cands = [];
    for (const d of IS.Incidents.DEFS) {
      if (h < d.band[0] || h > d.band[1]) continue;
      const params = d.needs(ctx);
      if (!params) continue;
      let w = d.w;
      for (const [t, m] of Object.entries(d.traits || {})) if (wife.traits.includes(t)) w *= m;
      // an incident fits best near the middle of its band
      const mid = (d.band[0] + d.band[1]) / 2, half = (d.band[1] - d.band[0]) / 2 || 1;
      w *= 1 - 0.35 * Math.min(1, Math.abs(h - mid) / half);
      cands.push({ d, params, w });
    }
    if (!cands.length) return null;
    const pick = rng.weighted(cands, (c) => c.w);
    return { id: pick.d.id, wifeId: wife.id, params: pick.params };
  }

  const EVENT_CHANCE = 0.6, SECOND_EVENT_CHANCE = 0.16;

  function pickEvent(state, rng, S, exclude) {
    const ctx = makeCtx(state, rng, null, {}, []);
    const cands = [];
    for (const d of IS.Events.DEFS) {
      if (exclude.includes(d.id) || (d.seasons && !d.seasons.includes(S))) continue;
      const params = d.needs(ctx);
      if (!params) continue;
      cands.push({ d, params, w: d.w * (S === 'winter' && d.winterBonus ? d.winterBonus : 1) });
    }
    if (!cands.length) return null;
    const pick = rng.weighted(cands, (c) => c.w);
    return { id: pick.d.id, wifeId: null, params: pick.params, kind: 'event' };
  }

  function rollEvents(state, rng, S) {
    const used = [];
    if (!rng.chance(EVENT_CHANCE)) return;
    for (let i = 0; i < 2; i++) {
      const ev = pickEvent(state, rng, S, used);
      if (!ev) return;
      state.pending.push(ev); used.push(ev.id);
      if (!rng.chance(SECOND_EVENT_CHANCE)) return;
    }
  }

  function afterSeason(state, rng, rep, res) {
    state.pending = state.pending || [];
    state.relations = state.relations || {};
    state.feuds = state.feuds || [];
    if (IS.Stable) IS.Stable.sync(state, rng);
    rep.incidents = rep.incidents || [];
    // the law does not wait for anyone, and an outlaw in the highlands has his own seasons
    if (IS.Law) { IS.Law.tick(state, rng); IS.Law.exileTick(state, rng); }
    if (state.vowDuel) { state.pending.unshift({ id: 'vow_duel', wifeId: null, kind: 'event', params: state.vowDuel }); state.vowDuel = null; }
    // wintering abroad: nobody is home to answer anything
    if (state.expedition && state.expedition.untilTurn > state.turn + 1) return;
    if (IS.Raid) {
      const v = IS.Raid.offerVow(state);
      if (v) state.pending.push(v);
      // an oath left unfulfilled for fifteen years is forgotten, but not by everyone
      if (state.vow && state.vow.status === 'sworn' && state.turn - state.vow.turn > 30) {
        rep.household.push(`The years have gone by and you never sailed against ${state.vow.killer}. Few still remember the oath.`);
        state.hooks = (state.hooks || []).filter((h) => h.type !== 'raid_vow'); state.vow = null;
      }
    }
    if (state.household.wives.length) {
      updateHappiness(state, rng, rep, res);
      wifeFlow(state, rep);
      for (const id of state.household.wives.slice()) {
        const w = state.people[id];
        if (w.sulkUntil != null && state.turn >= w.sulkUntil) w.sulkUntil = null;
        if (!rng.chance(INCIDENT_CHANCE)) continue;
        const inc = pickIncident(state, rng, w);
        if (inc) state.pending.push(inc);
      }
    }
    const fctx = makeCtx(state, rng, null, {}, []);
    if (IS.Feud) IS.Feud.tick(state, rng, rep, fctx);
    if (IS.Saga) IS.Saga.checkAmbition(state, (d, why) => fctx.honor(d, why), rep);
    if (IS.History) IS.History.tick(state, rng, rep, fctx);
    if (IS.Saga && !state.ambition && state.turn >= (state.ambitionAsk || 0) && !state.pending.some((p) => p.id === 'ambition_new')) state.pending.push({ id: 'ambition_new', wifeId: null, kind: 'event', params: { done: '' } });
    rollEvents(state, rng, rep.season);
    if (IS.Stable) IS.Stable.sync(state, rng);
    drainNews(state, 0);
  }

  /** Weddings, funerals and new women in the house come first, before anything that assumes you know of them. */
  function drainNews(state, at) {
    const news = state.news || [];
    if (!news.length) return;
    state.news = [];
    const order = { headdeath: 0, succession: 1, regency: 2 };
    news.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
    const items = news.map((n) => ({ id: 'house_' + n.type, wifeId: n.type === 'wedding' ? n.pid : null, kind: 'event', params: Object.assign({}, n, { pid: undefined, wid: n.pid }) }));
    state.pending.splice(at, 0, ...items);
    state.pendingTotal = (state.pendingTotal || 0) + items.length;
  }

  /* ---------- presenting and answering ---------- */
  function valid(state, item) {
    if (item.wifeId && (!state.household.wives.includes(item.wifeId) || !alive(state, item.wifeId))) return false;
    const p = item.params || {};
    for (const k of ['id', 'who', 'kin']) if (p[k] && (!alive(state, p[k]) || !hhHas(state, p[k]))) return false;
    if (p.hook && !(state.hooks || []).some((x) => x.id === p.hook)) return false;
    if (p.farm && item.kind === 'event' && state.families && !state.families[p.farm] && !/^(hist_|ambition_)/.test(item.id)) return false;
    return true;
  }
  function dropInvalid(state) {
    while (state.pending.length && !valid(state, state.pending[0])) state.pending.shift();
  }

  const defOf = (item) => (item.kind === 'event' ? IS.Events.byId(item.id) : IS.Incidents.byId(item.id));

  /** When nothing is left to answer, close the matters and go on to the season's report. */
  function finishIfDone(state) {
    if (state.pending.length || state.mode !== 'incident') return false;
    const f = state.farm;
    f.wealth = E.wealth(f); f.tier = E.tierOfFarm(f); f.tierLabel = IS.Start.TIER_LABEL[f.tier];
    state.pendingTotal = 0;
    state.report.after = IS.Turn.snapshot(state);
    state.mode = 'report';
    const last = state.history[state.history.length - 1];
    if (last) { last.wealth = f.wealth; last.honor = state.report.after.honor; last.cash = state.report.after.cash; last.cattle = f.cattle; last.sheep = f.sheep; last.people = state.report.after.people; }
    return true;
  }

  function wifeCard(state, w) {
    const known = w.knownTraits.map((t) => ({ id: t, name: T.WIFE[t].name, desc: T.WIFE[t].desc }));
    const hidden = w.traits.length - w.knownTraits.length;
    return {
      id: w.id, name: IS.Names.fullName(w), age: E.yearOf(state) - w.birthYear, kin: w.kin ? w.kin.farm : null,
      happiness: w.attrs.happiness, mood: mood(w.attrs.happiness), traits: known, hidden,
      law: Math.round(w.attrs.law), poetry: Math.round(w.attrs.poetry), beauty: Math.round(w.attrs.beauty),
    };
  }

  /** What the incident screen shows, or null if nothing is waiting. */
  function describe(state) {
    state.pending = state.pending || [];
    dropInvalid(state);
    const item = state.pending[0];
    if (!item) { finishIfDone(state); return null; }
    const def = defOf(item);
    const wife = item.wifeId ? state.people[item.wifeId] : null;
    const ctx = makeCtx(state, rngOf(state), wife, item.params, []);
    const cash = E.cashOf(state.farm);
    let body = def.body(ctx);
    const opts0 = def.options(ctx);
    // a boy at the head of the house does not fight himself: say who does
    if (ctx.minor && item.id !== 'battle' && opts0.some((o) => /odds|Strength|fight|duel|island|ride|strike/i.test((o.label || '') + ' ' + (o.desc || '')))) {
      const ch = IS.Feud && IS.Feud.champion(state), age = E.yearOf(state) - ctx.head.birthYear;
      body = body.concat(ch ? [`You are ${age}. If it comes to blows, ${ch.first} (Strength ${Math.round(ch.attrs.strength)}) will fight in your name.`] : [`You are ${age}, and there is no grown man in the house to fight for you.`]);
    }
    return {
      id: item.id, number: (state.pendingTotal || state.pending.length) - state.pending.length + 1, total: state.pendingTotal || state.pending.length,
      kind: item.kind || 'incident', title: def.title(ctx), body, wife: wife ? wifeCard(state, wife) : null,
      options: opts0.map((o) => ({ id: o.id, label: o.label, desc: o.desc, cost: o.cost || 0, disabled: !!o.cost && cash < o.cost })),
      view: def.view ? def.view(ctx) : null,
    };
  }

  function choose(state, optionId) {
    dropInvalid(state);
    const item = state.pending[0];
    if (!item) return null;
    const rng = rngOf(state);
    const def = defOf(item);
    const wife = item.wifeId ? state.people[item.wifeId] : null;
    const log = [];
    const ctx = makeCtx(state, rng, wife, item.params, log);
    const head0 = ctx.head;
    const opt = def.options(ctx).find((o) => o.id === optionId);
    if (!opt) return null;
    if (opt.cost && E.cashOf(state.farm) < opt.cost) return null;
    const text = opt.run();
    if (IS.Saga && head0.deathYear == null) IS.Saga.checkAmbition(state, (d, why) => ctx.honor(d, why), null);
    if (head0.deathYear != null) IS.Turn.headDied(state, rng);
    if (IS.Stable) IS.Stable.sync(state, rng);
    state.report.incidents = state.report.incidents || [];
    state.report.incidents.push({ title: def.title(ctx), wife: wife ? wife.first : null, text: [text, ...log].join(' ') });
    state.pending.shift();
    drainNews(state, 0);
    { const v = IS.Raid && IS.Raid.offerVow(state); if (v) state.pending.push(v); }
    const f = state.farm;
    f.wealth = E.wealth(f); f.tier = E.tierOfFarm(f); f.tierLabel = IS.Start.TIER_LABEL[f.tier];
    dropInvalid(state);
    finishIfDone(state);
    state.rngState = rng.getState();
    return text;
  }

  /** For tests: pick an option by strategy ('first' = first affordable, 'last', or a number 0..1 for a random pick). */
  function autoChoose(state, strategy) {
    const d = describe(state);
    if (!d) return null;
    const ok = d.options.filter((o) => !o.disabled);
    if (!ok.length) { state.pending.shift(); finishIfDone(state); return null; }
    let o = ok[0];
    if (strategy === 'last') o = ok[ok.length - 1];
    else if (typeof strategy === 'number') o = ok[Math.min(ok.length - 1, Math.floor(strategy * ok.length))];
    choose(state, o.id);
    return { incident: d.id, option: o.id };
  }

  IS.Household = {
    _ctxFor: (state, wife) => makeCtx(state, rngOf(state), wife, {}, []), INCIDENT_CHANCE, mood, afterSeason, describe, choose, autoChoose, wifeCard, makeCtx };
})();
