/* History on schedule, and the dangers inside the house.
 *
 * Dated events (pushed the season before they happen, with a window in case the head is abroad):
 *   975-976  the famine winters (óaldarvetr): forced dire omens, severe winters, dear food
 *   985-986  Eiríkr the Red gathers ships for Greenland: sail and start over, or stay
 *   997-998  Þangbrandr the priest preaches in the district
 *   1000     the Alþing takes up the faith (in Greenland: Leifr's priest and Þjóðhildr's church)
 *   1003-06  (Greenland only) Þorfinnr Karlsefni's voyage to Vínland
 *
 * Household drama (Kin):
 *   sons get a temper at 14; a hot-tempered son makes trouble you did not choose (kin-events: son_hothead)
 *   a proud or spiteful wife may quarrel with a friendly neighbor's wife: a ladder of insults and killings
 *     between the women's servants while the husbands pay (state.wq)
 *   at a succession, a grown brother may contest the land (inherit_claim): a new neighbor house, friendly or not
 */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const E = () => IS.Economy;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; };

  /* ================= the famine years ================= */
  const FAMINE = [975, 976];
  const isFamine = (y) => FAMINE.includes(y);
  /** Called from Turn.prepare after prices are set: a famine year is dire, and food and hay are dear. */
  function adjustEnv(state, env, S) {
    const y = E().yearOf(state);
    if (state.greenland || !isFamine(y)) return;
    if (S === 'summer') env.omen = -2;
    env.prices.food = Math.round(env.prices.food * 1.4 * 100) / 100;
    env.prices.hay = Math.round(env.prices.hay * 1.25 * 100) / 100;
    env.famine = true;
  }
  /** Called from Turn.drawEnv: the famine winters are hard or worse. */
  function winterSev(state, rng, sev) {
    if (state.greenland || !isFamine(E().yearOf(state))) return sev;
    return rng.chance(0.7) ? 'severe' : 'hard';
  }

  /* ================= faith ================= */
  /** Which neighbors lean to the new faith: a few early, more as the year 1000 nears. */
  function faithOf(state, farm) {
    const f = state.families && state.families[farm];
    if (f && f.faith) return f.faith;
    const y = E().yearOf(state);
    const share = y >= 1000 ? 1 : y >= 995 ? 0.35 : y >= 985 ? 0.15 : 0.05;
    return hash(state.seed + '|faith|' + farm) < share ? 'christian' : 'heathen';
  }

  /* ================= the schedule ================= */
  const SCHEDULE = [
    { id: 'hist_famine', from: 975, to: 975, season: 'summer', ok: (s) => !s.greenland },
    { id: 'hist_famine_poor', from: 975, to: 976, season: 'winter', ok: (s) => !s.greenland },
    { id: 'hist_greenland', from: 985, to: 986, season: 'summer', ok: (s) => !s.greenland },
    { id: 'hist_thangbrand', from: 997, to: 998, season: 'summer', ok: (s) => !s.greenland },
    { id: 'hist_conversion', from: 1000, to: 1001, season: 'summer', ok: (s) => !s.greenland },
    { id: 'hist_greenland_faith', from: 1000, to: 1001, season: 'summer', ok: (s) => !!s.greenland },
    { id: 'hist_vinland', from: 1003, to: 1006, season: 'summer', ok: (s) => !!s.greenland },
  ];
  /** Push the events of the coming season (we are at the end of turn T; the player answers before planning T+1). */
  function schedule(state, rng) {
    const nx = IS.Calendar.turnInfo(state.turn + 1, state.startYear);
    state.histDone = state.histDone || {};
    for (const ev of SCHEDULE) {
      if (state.histDone[ev.id] || ev.season !== nx.season || nx.year < ev.from || nx.year > ev.to || !ev.ok(state)) continue;
      if (ev.id === 'hist_famine_poor' && !isFamine(nx.year)) continue;
      state.histDone[ev.id] = state.turn + 1;
      const params = { year: nx.year };
      if (ev.id === 'hist_greenland') {
        const sons = sonsOf(state, 16).filter((p) => p.id !== state.headId);
        if (sons.length > 1) params.sonId = sons[sons.length - 1].id;
      }
      state.pending.push({ id: ev.id, wifeId: null, kind: 'event', params });
    }
  }

  const sonsOf = (state, minAge) => {
    const y = E().yearOf(state);
    return state.household.children.map((id) => state.people[id]).filter((p) => p && p.deathYear == null && p.sex === 'M' && y - p.birthYear >= (minAge || 0)).sort((a, b) => a.birthYear - b.birthYear);
  };

  /* ================= Greenland ================= */
  const GREEN_FARMS = ['Hvalsey', 'Garðar', 'Sandnes', 'Herjólfsnes', 'Dýrnes', 'Undir Höfða', 'Vatnahverfi', 'Stokkanes', 'Steinsnes', 'Langanes', 'Ánavík', 'Eyrar', 'Hóll', 'Hvammr'];
  /** Sell up in Iceland and sail with Eiríkr. outcome: 'safe' | 'storm' | 'wreck'. Returns lines for the report. */
  function migrate(state, rng, ctx, outcome) {
    const f = state.farm, P = E().C.PRICE, lines = [];
    const oldFarm = f.name;
    // the land and what cannot be carried
    const landCash = f.tenure === 'owned' ? Math.round(f.landValue * 0.8) : 0;
    const keep = { cattle: Math.min(f.cattle, 4), sheep: Math.min(f.sheep, 20), horses: Math.min(f.horses, 2) };
    const sold = Math.round(((f.cattle - keep.cattle) * P.cattle + (f.sheep - keep.sheep) * P.sheep + (f.horses - keep.horses) * P.horses) * 0.7);
    f.vadmal += landCash + sold;
    f.cattle = keep.cattle; f.sheep = keep.sheep; f.horses = keep.horses;
    f.provisions = Math.min(f.provisions, 8); f.hay = 0; f.wool = Math.min(f.wool, 40);
    lines.push(`You sold the land at ${oldFarm}${landCash ? ` for ${landCash.toLocaleString('en-US')} ells` : ''} and the stock you could not carry for ${sold.toLocaleString('en-US')} more.`);
    // the voyage
    const people = [...state.household.wives, ...state.household.children, ...state.household.kin, ...state.household.servants, ...state.household.thralls].map((id) => state.people[id]).filter((p) => p && p.deathYear == null);
    const lost = [];
    if (outcome !== 'safe') {
      const pr = outcome === 'storm' ? 0.1 : 0.25;
      f.cattle = Math.round(f.cattle * (outcome === 'storm' ? 0.6 : 0.4)); f.sheep = Math.round(f.sheep * (outcome === 'storm' ? 0.6 : 0.4)); f.horses = Math.round(f.horses * 0.5);
      for (const p of people) if (rng.chance(pr)) { ctx.kill(p, 'was lost overboard on the voyage to Greenland', 'drowned'); lost.push(p.first); }
      lines.push(outcome === 'storm'
        ? `The fleet ran into storms off the glaciers. Some ships turned back and some were never seen again. Yours came through, lighter by much of its stock${lost.length ? ` and by ${lost.join(', ')}` : ''}.`
        : `The ship was driven far off course and came close to breaking up. When you finally raised the Greenland coast, half the stock was dead${lost.length ? `, and so were ${lost.join(', ')}` : ''}.`);
      if (outcome === 'wreck' && rng.chance(0.3)) { ctx.kill(ctx.head, 'was lost at sea on the voyage to Greenland', 'drowned'); lines.push('You did not live to see the land.'); }
    } else lines.push('Of the twenty-five ships that sailed, fourteen reached Greenland. Yours was one, and the sea was kind to it.');
    // the new land: claimed, not bought, and plenty of it, but the house is new turf
    const name = GREEN_FARMS.filter((x) => !(state.families || {})[x])[Math.floor(rng.float(0, 1) * 8)] || 'Hvalsey';
    const fjord = rng.pick(['Eiríksfjörðr', 'Einarsfjörðr', 'Hrafnsfjörðr']);
    f.name = name; f.valley = fjord; f.quarter = 'Greenland'; f.setting = 'coast'; f.tenure = 'owned';
    f.landValue = Math.max(f.landValue, 26 * E().C.LAND_PER_TON); f.condition = 35;
    state.origin = state.origin || { farm: oldFarm, valley: state.ancestry.region.valley, quarter: state.ancestry.region.quarter };
    state.greenland = { year: E().yearOf(state), from: oldFarm };
    // new neighbors: Eiríkr at Brattahlíð, and the others who came with him
    const fams = { [name]: { farm: name, head: null, tier: E().tierOfFarm(f), roles: ['home'], goði: false } };
    fams['Brattahlíð'] = { farm: 'Brattahlíð', head: { first: 'Eiríkr', gen: 'Eiríks' }, tier: 5, roles: ['chieftain'], goði: true, faith: 'heathen' };
    const pool = GREEN_FARMS.filter((x) => x !== name);
    for (let i = 0; i < 7 && pool.length; i++) {
      const farm = pool.splice(Math.floor(rng.float(0, 1) * pool.length) % pool.length, 1)[0];
      fams[farm] = { farm, head: IS.Names.male(rng), tier: rng.weighted([{ t: 1, w: 3 }, { t: 2, w: 4 }, { t: 3, w: 2 }], (x) => x.w).t, roles: ['settler'], goði: false };
    }
    state.families = fams;
    const debts = (state.hooks || []).filter((h) => h.type === 'debt' || h.type === 'blood_money_owed');
    if (debts.length) ctx.honor(-2, 'You left debts behind in Iceland');
    state.hooks = (state.hooks || []).filter((h) => !h.farm);
    state.relations = { 'Brattahlíð': 25 }; state.feuds = []; state.nq = {}; state.bondShift = {}; state.knownNature = {}; state.wq = null;
    if (state.ambition && state.ambition.id === 'avenge') state.ambition = IS.Saga.makeAmbition(state, 'wealth');
    if (IS.Saga) IS.Saga.note(state, 'migration', `He sold the land at ${oldFarm} and sailed with Eiríkr the Red to Greenland, and took land at ${name} in ${fjord}.`, 5);
    lines.push(`You have taken land at ${name} in ${fjord}. Eiríkr the Red is your neighbor at Brattahlíð. The house is new turf and the pasture is untouched.`);
    return lines;
  }

  /* ================= the household ================= */
  const TEMPER_AGE = 14;
  /** Sons come into their temper at fourteen: some are hot-tempered, more often if their father was. */
  function tempers(state, rng) {
    const head = state.people[state.headId];
    const hotFather = head && head.traits && head.traits.includes('hotheaded');
    for (const p of sonsOf(state, TEMPER_AGE)) {
      if (p.temper) continue;
      p.temper = rng.chance(hotFather ? 0.4 : 0.22) ? 'hot' : 'even';
    }
  }
  const hotSon = (state, rng) => { const l = sonsOf(state, 16).filter((p) => p.temper === 'hot' && p.id !== state.headId && !(p.hotCalm > state.turn)); return l.length ? rng.pick(l) : null; };

  const SPITE = ['proud', 'vindictive', 'malicious', 'jealous'];
  /** The wives' quarrel: opens between a spiteful wife and the wife of a FRIENDLY neighbor, and climbs. */
  function wivesQuarrel(state, rng, ctx) {
    if (state.expedition) return;
    const wq = state.wq;
    if (wq) {
      const w = state.people[wq.wifeId], fam = state.families && state.families[wq.farm];
      if (!w || w.deathYear != null || !state.household.wives.includes(w.id) || !fam || !fam.head) { state.wq = null; return; }
      if (state.turn < wq.next) return;
      if (rng.chance(0.55)) {
        wq.stage++; wq.next = state.turn + 2;
        if (wq.stage > 4) { state.wq = null; return; }
        const params = { farm: wq.farm, head: fam.head.first, nwife: wq.nwife, stage: wq.stage };
        // the killings of the women's quarrel have already happened when you hear of them
        if (wq.stage >= 3) {
          const y = E().yearOf(state), hh = state.household;
          const pool = (wq.stage === 3 ? [...hh.servants, ...hh.thralls] : [...hh.kin, ...hh.children, ...hh.servants]).map((id) => state.people[id])
            .filter((p) => p && p.deathYear == null && (wq.stage === 3 || (p.sex === 'M' && y - p.birthYear >= 16)));
          if (!pool.length) { state.wq = null; return; }
          const v = rng.pick(pool);
          ctx.kill(v, wq.stage === 3 ? `was killed on ${wq.nwife}'s orders` : `was killed by a kinsman of ${fam.head.first}, goaded on by ${wq.nwife}`, wq.stage === 3 ? 'killed in a quarrel' : 'killed in a feud');
          params.dead = v.first; params.rel = v.role;
          if (wq.stage === 4) IS.Feud.slain(state, wq.farm, 'you');
        }
        state.pending.push({ id: 'wives_quarrel', wifeId: w.id, kind: 'event', params });
      }
      return;
    }
    if (!rng.chance(0.05)) return;
    const wives = state.household.wives.map((id) => state.people[id]).filter((w) => w && w.deathYear == null && (w.traits || []).some((t) => SPITE.includes(t)));
    if (!wives.length) return;
    const friends = Object.values(state.families || {}).filter((f) => f.head && f.farm !== state.farm.name && ((state.relations || {})[f.farm] || 0) >= 15);
    if (!friends.length) return;
    const w = rng.pick(wives), fam = rng.pick(friends);
    state.wq = { wifeId: w.id, farm: fam.farm, nwife: IS.Names.female(rng).first, stage: 1, next: state.turn + 2, paid: 0 };
    state.pending.push({ id: 'wives_quarrel', wifeId: w.id, kind: 'event', params: { farm: fam.farm, head: fam.head.first, nwife: state.wq.nwife, stage: 1 } });
  }

  /** A brother who took his share at the succession may contest the land itself. */
  function inheritance(state, rng) {
    const c = state.inheritClaim;
    if (!c) return;
    state.inheritClaim = null;
    const b = state.people[c.brotherId];
    if (!b || b.deathYear != null) return;
    state.pending.push({ id: 'inherit_claim', wifeId: null, kind: 'event', params: { brotherId: b.id, brother: b.first, father: c.father } });
  }
  /** The brother sets up as a neighbor: friendly, or not. Returns the new farm's name. */
  function brotherFarm(state, b, rel) {
    const farm = (rel >= 0 ? 'Ytri-' : 'Syðri-') + state.farm.name;
    state.families = state.families || {};
    state.families[farm] = { farm, head: { first: b.first, gen: null }, tier: Math.max(1, E().tierOfFarm(state.farm) - 2), roles: ['brother'], goði: false };
    state.relations[farm] = rel;
    return farm;
  }

  /** Called from Household.afterSeason. */
  function tick(state, rng, rep, ctx) {
    state.pending = state.pending || [];
    schedule(state, rng);
    tempers(state, rng);
    inheritance(state, rng);
    wivesQuarrel(state, rng, ctx);
  }

  IS.History = { FAMINE, isFamine, adjustEnv, winterSev, faithOf, SCHEDULE, migrate, tick, hotSon, sonsOf, brotherFarm, GREEN_FARMS };
})();
