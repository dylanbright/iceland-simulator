/* The turn: draws the weather, runs the economy, then deals with the people (hunger, death, birth,
 * marriage, thralls) and, if the head of the house has died, the succession. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const R = IS.Rules, E = IS.Economy, P = IS.Person, N = IS.Names, A = IS.Ancestry, T = IS.Traits;
  const C = E.C;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const r1 = (v) => Math.round(v * 10) / 10;
  const r2 = (v) => Math.round(v * 100) / 100;
  const round10 = (v) => Math.round(v / 10) * 10;
  const fmt = (x) => Math.round(x).toLocaleString('en-US');
  const tons = (x) => (Math.round(x * 10) / 10).toLocaleString('en-US');
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const alive = (state, id) => state.people[id] && state.people[id].deathYear == null;

  const OMEN = [
    { name: 'dire', text: 'Ice lingers in the fjords and the thaw is late. The old people expect a hard year.' },
    { name: 'poor', text: 'A cold, grudging spring. The birds are late and the grass is slow.' },
    { name: 'middling', text: 'An ordinary spring, neither kind nor cruel.' },
    { name: 'fair', text: 'A mild spring. The first lambs are strong and the grass is coming early.' },
    { name: 'excellent', text: 'The thaw came early and the grass is thick. People say it will be a good year.' },
  ];

  const rngOf = (state) => { const r = new IS.RNG(state.seed); r.setState(state.rngState); return r; };
  const idGen = (state) => () => 'n' + (state.idn = (state.idn || 0) + 1);

  /* ---------- the year's character ---------- */
  function prepare(state, rng) {
    IS.Stable.sync(state, rng);
    const S = E.seasonOf(state);
    const env = state.env || {};
    if (S === 'summer' || env.omen == null) {
      env.omen = rng.weighted([{ o: -2, w: 6 }, { o: -1, w: 19 }, { o: 0, w: 50 }, { o: 1, w: 19 }, { o: 2, w: 6 }], (x) => x.w).o;
    }
    const lw = state.lastWeather == null ? 1 : state.lastWeather;
    const g = (sd) => rng.normal(0, sd);
    env.prices = {
      cattle: r2(clamp(1 + g(0.07), 0.85, 1.2)),
      sheep: r2(clamp(1 + g(0.07), 0.85, 1.2)),
      horses: r2(clamp(1 + g(0.07), 0.85, 1.2)),
      hay: r2(S === 'summer' ? clamp(1 + g(0.06), 0.85, 1.2) : clamp(1 + (1 - lw) * 1.6 + g(0.08), 0.8, 2.4)),
      food: r2(clamp(1 + g(0.06) + (env.omen < 0 ? -0.05 * env.omen : 0), 0.85, 1.4)),
      thrall: r2(clamp(1 + g(0.08), 0.8, 1.25)),
      land: 1,
    };
    // yesterday's selling and buying still weighs on the market, at half strength each season
    const mk = (state.market = state.market || {});
    for (const k of Object.keys(mk)) {
      mk[k] = r2(mk[k] * 0.5);
      if (Math.abs(mk[k]) < 0.01) delete mk[k];
      else if (env.prices[k] != null) env.prices[k] = r2(clamp(env.prices[k] * (1 + mk[k]), 0.4, 1.9));
    }
    state.env = env;
  }

  function drawEnv(state, rng, S) {
    const mod = C.OMEN_MOD[state.env.omen + 2];
    const weather = clamp(1 + 0.6 * mod + rng.normal(0, 0.13), 0.55, 1.4);
    const fishLuck = clamp(rng.normal(1, 0.25), 0.5, 1.6);
    let sev = 'normal';
    if (S === 'winter') {
      const o = state.env.omen;
      const w = { mild: 18 + 5 * o, normal: 47 + 3 * o, hard: 25 - 4 * o, severe: 10 - 4 * o };
      sev = rng.weighted(E.SEV_ORDER, (k) => w[k]);
    }
    const ev = IS.FarmEvents.roll(state, rng, S);
    return { season: S, weather, fishLuck, sev, prices: state.env.prices, mods: ev.mods, notes: ev.notes };
  }

  /* ---------- people ---------- */
  function removeFromHousehold(state, id) {
    const hh = state.household;
    for (const k of ['wives', 'concubines', 'children', 'kin', 'servants', 'thralls']) {
      const i = (hh[k] || []).indexOf(id);
      if (i >= 0) hh[k].splice(i, 1);
    }
  }
  const roleOf = (p) => (p.kind === 'thrall' ? 'thrall' : p.role === 'head' ? 'head of the house' : p.role || '');
  const nameOf = (p) => (p.kind === 'thrall' ? p.first : N.fullName(p));

  function mortality(state, rng, S, year, hungerFrac, out) {
    for (const p of E.members(state)) {
      const age = year - p.birthYear;
      const base = R.turnDeathChance(age, p.sex) * (S === 'winter' ? 1.3 : 0.7);
      const hungry = hungerFrac * (age < 5 || age > 60 ? 0.3 : 0.1);
      const total = 1 - (1 - base) * (1 - hungry);
      if (!rng.chance(total)) continue;
      const starved = hungry > 0 && rng.chance(hungry / (hungry + base));
      const cause = starved ? { id: 'starved', text: 'died of hunger' } : R.deathCause(rng, age, p.sex);
      p.deathYear = year; p.deathCause = cause.id; p.deathText = cause.text; p.deathAge = age;
      if (p.id !== state.headId) removeFromHousehold(state, p.id);
      const m = state.marriages.find((x) => x.wifeId === p.id && x.status === 'married');
      if (m) m.status = 'wife died';
      if (p.motherId && age < 14 && state.people[p.motherId]) state.people[p.motherId].lastLossTurn = state.turn;
      out.push({ id: p.id, text: `${nameOf(p)} (${p.id === state.headId ? 'head of the house' : roleOf(p)}, ${age}) ${cause.text}.` });
    }
  }

  function births(state, rng, year, hungerFrac, out) {
    const head = state.people[state.headId];
    for (const id of [...state.household.wives, ...(state.household.concubines || [])]) {
      const w = state.people[id];
      const age = year - w.birthYear;
      if (age < 16 || age > 41) continue;
      if (!rng.chance(0.19 * (1 - 0.6 * hungerFrac))) continue;
      const sex = rng.chance(0.5) ? 'M' : 'F';
      const kid = P.make(rng, idGen(state), { sex, birthYear: year, father: head, role: 'none' });
      kid.motherId = w.id; kid.role = sex === 'M' ? 'son' : 'daughter';
      if (w.role === 'concubine') kid.legit = false;
      P.refresh(kid, year);
      state.people[kid.id] = kid;
      state.household.children.push(kid.id);
      w.lastBirthTurn = state.turn;
      out.push({ id: kid.id, text: `${w.first} bore ${sex === 'M' ? 'a son' : 'a daughter'}, ${kid.first}.` });
    }
  }

  function marryOffDaughters(state, rng, year, out, rep) {
    const hh = state.household;
    const tier = E.tierOfFarm(state.farm);
    const girls = [...hh.children, ...hh.kin].map((id) => state.people[id])
      .filter((p) => p && p.sex === 'F' && p.deathYear == null && (p.role === 'daughter' || p.role === 'sister') && year - p.birthYear >= 17);
    for (const g of girls) {
      if (!rng.chance(0.14)) continue;
      const dowry = round10((80 + 40 * tier) * rng.float(0.8, 1.4));
      if (E.cashOf(state.farm) < dowry * 1.2) continue;
      E.pay(state.farm, dowry);
      const fam = A.newFamily({ rng, families: state.families }, 'son-in-law', clamp(tier + rng.int(-1, 1), 1, 5));
      g.marriedInto = fam.farm; g.role = 'married away';
      removeFromHousehold(state, g.id);
      out.push({ id: g.id, text: `${g.first} married ${fam.head.first} of ${fam.farm}. Her dowry was ${fmt(dowry)} ells.` });
      rep.honorParts.push({ d: 0.8, why: `${g.first} was married well` });
    }
  }

  /** Court a bride (the first wife or a second one). */
  function seekWife(state, rng, year, wedding, rep) {
    if (!rng.chance(IS.Marriage.suitChance(state))) {
      state.farm.vadmal += Math.round(wedding.cost / 2);
      rep.household.push('You made your suit and were refused. Half of what you spent on gifts was lost.');
      return;
    }
    const had = state.household.wives.length;
    const wordy = IS.Marriage.poetryBonus(state) >= 0.1;
    const r = IS.Marriage.newWife(state, rng, year);
    rep.household.push(`You married ${N.fullName(r.wife)}, of ${r.kinFarm}. She brought ${fmt(r.dowry)} ells with her. You know only a little of her ways yet.`);
    if (wordy) rep.household.push('Your verses did part of your wooing: her family liked a man who could turn a phrase.');
    r.lines.forEach((l) => rep.household.push(l));
    if (had) rep.household.push('Two wives under one roof will take some managing.');
  }

  function takeConcubine(state, rng, year, cost, rep) {
    const r = IS.Marriage.newConcubine(state, rng, year);
    rep.household.push(`You took ${N.fullName(r.woman)} into the house as your concubine (${fmt(cost)} ells in gifts to her family).`);
    r.lines.forEach((l) => rep.household.push(l));
    if (state.household.wives.length) rep.honorParts.push({ d: -0.4, why: 'A concubine in the house of a married man' });
  }

  function buyThralls(state, rng, year, n, rep) {
    for (let i = 0; i < n; i++) {
      const sex = rng.chance(0.55) ? 'M' : 'F';
      const t = P.make(rng, idGen(state), { sex, birthYear: year - rng.int(15, 35), role: 'none', kind: 'thrall' });
      t.role = 'thrall'; P.refresh(t, year);
      state.people[t.id] = t; state.household.thralls.push(t.id);
    }
    if (n) rep.household.push(`You bought ${plural(n, 'thrall', 'thralls')}.`);
  }

  function sellThralls(state, n, rep) {
    if (!n) return;
    // the troublemakers go first
    const list = state.household.thralls.map((id) => state.people[id]).filter(Boolean)
      .sort((a, b) => (b.attrs.resentment == null ? 35 : b.attrs.resentment) - (a.attrs.resentment == null ? 35 : a.attrs.resentment)).slice(0, n);
    for (const t of list) { removeFromHousehold(state, t.id); t.sold = true; }
    if (list.length) rep.household.push(`You sold ${list.map((t) => t.first).join(', ')} at market.`);
  }

  function hireServants(state, rng, year, n, rep) {
    for (let i = 0; i < n; i++) {
      const sv = P.make(rng, idGen(state), { sex: rng.chance(0.5) ? 'M' : 'F', birthYear: year - rng.int(16, 45), role: 'none' });
      sv.role = 'servant'; P.refresh(sv, year);
      state.people[sv.id] = sv; state.household.servants.push(sv.id);
    }
    if (n) rep.household.push(`You took on ${plural(n, 'servant', 'servants')}.`);
  }

  function dismissUnpaid(state, short, rep) {
    const n = Math.min(state.household.servants.length, Math.ceil(short / C.WAGE));
    for (let i = 0; i < n; i++) {
      const id = state.household.servants.pop();
      state.people[id].left = true;
    }
    if (n) {
      rep.household.push(`You could not pay ${plural(n, 'servant', 'servants')}, and they left.`);
      rep.honorParts.push({ d: -1, why: 'You could not pay your servants' });
    }
  }

  function thrallMood(state, rng, hungerFrac, treatment, rep) {
    const hh = state.household;
    if (!hh.thralls.length) return;
    const wf = E.workforce(state, treatment);
    const ratio = hh.thralls.length / Math.max(1, wf.freeAdults);
    const f = state.farm;
    for (const id of hh.thralls.slice()) {
      const t = state.people[id];
      const target = 38 + C.TREAT[treatment].res + 35 * hungerFrac + 12 * clamp(ratio - 0.8, 0, 1.2) - (f.condition >= 70 ? 4 : 0);
      const cur = t.attrs.resentment == null ? 35 : t.attrs.resentment;
      t.attrs.resentment = clamp(Math.round(cur + (target - cur) * 0.3 + rng.normal(0, 3)), 1, 100);
      if (t.attrs.resentment > 80 && rng.chance(0.18)) {
        removeFromHousehold(state, id);
        t.fled = true;
        rep.household.push(`${t.first}, one of your thralls, ran away in the night.`);
      }
    }
  }

  /* ---------- succession ---------- */
  function succeed(state, rng, year, rep) {
    const hh = state.household, people = state.people;
    const old = people[state.headId];
    const oldName = N.fullName(old);
    state.deadHeads = state.deadHeads || [];
    state.deadHeads.push({ id: old.id, name: oldName, born: old.birthYear, died: year, honor: Math.round(old.attrs.honor), cause: old.deathText });

    const kids = hh.children.filter((id) => alive(state, id)).map((id) => people[id]);
    const bySon = (a, b) => a.birthYear - b.birthYear;
    const legit = kids.filter((p) => p.sex === 'M' && p.legit !== false).sort(bySon);
    const natural = kids.filter((p) => p.sex === 'M' && p.legit === false).sort(bySon);
    let heir = legit[0] || natural[0] || null;
    const contested = !!heir && heir.legit === false;
    if (!heir) {
      const bros = hh.kin.filter((id) => alive(state, id)).map((id) => people[id])
        .filter((p) => p.sex === 'M' && p.role === 'brother').sort((a, b) => a.birthYear - b.birthYear);
      heir = bros[0] || null;
    }
    if (!heir) {
      state.mode = 'over';
      state.over = { year, reason: `${oldName} died with no son or brother to hold the farm, and the line ended.` };
      rep.succession = { ended: true, text: state.over.reason };
      return false;
    }

    // Split the movable estate between the old head's children.
    const f = state.farm;
    const others = kids.filter((p) => p.id !== heir.id);
    const otherSons = others.filter((p) => p.sex === 'M');
    const W = 1.5 + otherSons.length + 0.5 * others.filter((p) => p.sex === 'F').length;
    const leavers = otherSons.filter((p) => year - p.birthYear >= 18);
    const payouts = [];
    for (const b of leavers) {
      const share = 1 / W;
      const take = { cattle: Math.round(f.cattle * share), sheep: Math.round(f.sheep * share), horses: Math.round(f.horses * share), vadmal: Math.round(f.vadmal * share), silver: Math.floor(f.silver * share) };
      f.cattle -= take.cattle; f.sheep -= take.sheep; f.horses -= take.horses; f.vadmal -= take.vadmal; f.silver -= take.silver;
      const value = take.cattle * C.PRICE.cattle + take.sheep * C.PRICE.sheep + take.horses * C.PRICE.horses + take.vadmal + take.silver * C.EYRIR;
      payouts.push(`${b.first} took his share, worth about ${fmt(value)} ells, and left to find a farm of his own.`);
      removeFromHousehold(state, b.id);
      b.role = 'brother (living apart)';
      state.away.push(b.id);
    }
    f.wealth = E.wealth(f); f.tier = E.tierOfFarm(f); f.tierLabel = IS.Start.TIER_LABEL[f.tier];

    // Move the household around the new head.
    const widows = [...hh.wives, ...(hh.concubines || [])];
    hh.wives = []; hh.concubines = [];
    for (const id of widows) {
      const w = people[id];
      w.role = w.id === heir.motherId ? 'mother' : w.role === 'concubine' ? 'stepmother' : 'stepmother';
      hh.kin.push(id);
    }
    removeFromHousehold(state, heir.id);
    for (const id of hh.children.slice()) {
      const p = people[id];
      p.role = p.sex === 'M' ? 'brother' : 'sister';
      hh.kin.push(id);
    }
    hh.children = [];
    state.headId = heir.id;
    heir.role = 'head';
    if (!heir.traits.length) heir.traits = T.rollHusband(rng, old.traits);
    P.assignByname(rng, heir);
    heir.attrs.honor = r1(clamp(old.attrs.honor * 0.8 + heir.attrs.honor * 0.2 - 1, 1, 100));
    state.married = false;
    for (const m of state.marriages) if (m.status === 'married') m.status = 'widowed';

    const age = year - heir.birthYear;
    const lines = [`${oldName} ${old.deathText}. ${N.fullName(heir)}, ${age}, now holds ${f.name}.`, ...payouts];
    if (contested) {
      heir.attrs.honor = r1(clamp(heir.attrs.honor - 6, 1, 100));
      lines.push('He is a concubine\'s son, and not every man in the district accepts his claim.');
    }
    if (age < 16) lines.push(`He is only ${age}. The household and his mother keep the farm going until he is grown.`);
    rep.succession = { text: lines[0], lines };
    return true;
  }

  /* ---------- scoring (provisional) ---------- */
  function summary(state) {
    const heads = (state.deadHeads || []).length + 1;
    const living = E.members(state).length;
    const peak = state.peakHonor || 0;
    const honor = state.people[state.headId] && state.people[state.headId].deathYear == null ? state.people[state.headId].attrs.honor : (state.lastHonor || 0);
    const years = Math.floor(state.turn / 2);
    const score = Math.round(0.6 * peak + 0.4 * honor + 4 * (heads - 1) + 0.5 * years + state.farm.wealth / 400);
    return { years, heads, living, peakHonor: Math.round(peak), honor: Math.round(honor), wealth: state.farm.wealth, score };
  }

  /* ---------- the turn ---------- */
  function snapshot(state) {
    const f = state.farm, h = state.people[state.headId];
    return { honor: r1(h.attrs.honor), cash: Math.round(E.cashOf(f)), wealth: f.wealth, cattle: f.cattle, sheep: f.sheep, horses: f.horses, hay: f.hay, people: E.members(state).length + (state.expedition && h.deathYear == null && state.turn < state.expedition.untilTurn ? 1 : 0) };
  }

  function resolve(state, planIn) {
    if (state.mode !== 'plan') return state.report;
    const rng = rngOf(state);
    const S = E.seasonOf(state), year = E.yearOf(state);
    const awayAtStart = IS.Raid.isAway(state);
    const plan = E.normalizePlan(state, awayAtStart ? E.suggest(state) : planIn, S);
    const rep = { turn: state.turn, year, season: S, farm: [], herd: [], household: [], events: [], raid: [], honorParts: [], before: snapshot(state) };
    if (awayAtStart) rep.raid.push(`You are abroad. ${state.people[state.expedition.deputyId].first} runs the farm through the winter.`);
    const sailing = !awayAtStart && plan.raid ? IS.Raid.begin(state, plan.raid, rep) : null;
    if (sailing) { plan.seekWife = false; }

    if (S === 'summer') for (const p of E.members(state)) P.refresh(p, year);

    const env = drawEnv(state, rng, S);
    if (S === 'summer') state.lastWeather = env.weather;
    rep.events.push(...env.notes);
    rep.sev = S === 'winter' ? env.sev : null;
    rep.weather = env.weather;

    const res = E.season(state, plan, env);
    const r = res.rep;
    state.farm = res.farm;
    state.lastPlan = plan;
    rep.honorParts.push(...(r.honorParts || []));
    rep.notes = r.notes;

    // ---- farm and herd, in words
    if (S === 'summer') {
      const n = r.needs, have = r.hayHave;
      const verdict = have >= n.severe ? 'enough even for a severe winter' : have >= n.hard ? 'enough for a hard winter, but not a severe one'
        : have >= n.normal ? 'enough for an ordinary winter, but a hard one would hurt' : have >= n.mild ? 'only enough for a mild winter' : 'not enough even for a mild winter';
      rep.farm.push(`Haymaking: your hands cut ${tons(r.hayMade)} tons. The barns now hold ${tons(have)} tons. An ordinary winter needs about ${tons(n.normal)}, so that is ${verdict}.`);
      rep.farm.push(`The cows${r.fish > 0.5 ? ' and the water' : ''} gave the house about ${fmt(r.dairy + r.fish)} rations. Everyone needed ${fmt(r.rationNeed)}.`);
      const born = [r.calves && plural(r.calves, 'calf', 'calves'), r.lambs && plural(r.lambs, 'lamb', 'lambs'), r.foals && plural(r.foals, 'foal', 'foals')].filter(Boolean);
      rep.herd.push(born.length ? `Born this year: ${born.join(', ')}.` : 'No young were born this year.');
    } else {
      rep.farm.push(`The winter was ${C.SEV[env.sev].label}. Your animals needed ${tons(r.hayNeedNow)} tons of hay and you had ${tons(r.hayHave)}.`);
      if (r.hayShort > 0.02) rep.farm.push(`You ran short by ${Math.round(r.hayShort * 100)} in every hundred, and the stock paid for it.`);
      const lost = [r.lostCattle && plural(r.lostCattle, 'head of cattle', 'head of cattle'), r.lostSheep && plural(r.lostSheep, 'sheep', 'sheep'), r.lostHorses && plural(r.lostHorses, 'horse', 'horses')].filter(Boolean);
      rep.herd.push(lost.length ? `Lost to the winter: ${lost.join(', ')}.` : 'The winter took none of your stock.');
      if (r.woven > 0.5 || r.crafted > 0.5) rep.farm.push(`${fmt(r.woven)} ells of cloth were woven${r.crafted > 0.5 ? ` and ${fmt(r.crafted)} ells of goods made for sale` : ''}.`);
      if (r.fish > 0.5) rep.farm.push(`Hunting and fishing brought in ${fmt(r.fish)} rations.`);
    }
    if (r.cullC || r.cullS) rep.herd.push(`You slaughtered ${[r.cullC && plural(r.cullC, 'head of cattle', 'head of cattle'), r.cullS && plural(r.cullS, 'sheep', 'sheep')].filter(Boolean).join(' and ')}.`);
    const sold = [r.sold.cattle && plural(r.sold.cattle, 'head of cattle', 'head of cattle'), r.sold.sheep && plural(r.sold.sheep, 'sheep', 'sheep'), r.sold.horses && plural(r.sold.horses, 'horse', 'horses')].filter(Boolean);
    if (sold.length) rep.herd.push(`You sold ${sold.join(', ')}.`);
    {
      const mk = (state.market = state.market || {});
      for (const [k, n] of Object.entries(r.pressure || {})) mk[k] = clamp((mk[k] || 0) + (C.IMPACT[k] || 0) * n * 0.5, -0.3, 0.3);
      if (r.pressure && r.pressure.sheep < -10) rep.herd.push('So many sheep at market drove the price down.');
      else if (r.pressure && r.pressure.cattle < -4) rep.herd.push('So many cattle at market drove the price down.');
    }
    const b = r.bought;
    const got = [b.hay && `${fmt(b.hay)} tons of hay`, b.food && `${fmt(b.food)} rations of food`, b.cattle && plural(b.cattle, 'head of cattle', 'head of cattle'), b.sheep && plural(b.sheep, 'sheep', 'sheep'), b.horses && plural(b.horses, 'horse', 'horses'), b.land && `${plural(b.land, 'parcel', 'parcels')} of land`].filter(Boolean);
    if (got.length) rep.farm.push(`You bought ${got.join(', ')}.`);
    for (const n of r.notes) rep.farm.push(n);
    if (r.hungerFrac > 0.01) rep.household.push(`There was not enough to eat: the house went short by ${Math.round(r.hungerFrac * 100)} in every hundred.`);
    if (r.clothShort > 0.5) rep.household.push('There was not enough cloth to go round, and people went in rags.');
    if (r.dues) rep.household.push(`Thing dues and gifts to your goði took ${fmt(r.dues)} ells.`);
    if (r.hosp) rep.household.push(r.hosp.level === 'lavish' ? `You kept a lavish table (${fmt(r.hosp.cost)} ells). People talked about it.` : `You kept an open hand (${fmt(r.hosp.cost)} ells).`);

    // ---- the raid, if you sailed
    if (sailing) {
      const out = IS.Raid.run(state, rng, sailing, (d, why) => rep.honorParts.push({ d: Math.round(d * 100) / 100, why }));
      rep.raid.push(...out.lines);
    }

    // ---- people
    sellThralls(state, r.sold.thralls, rep);
    if (r.sold.horses) IS.Stable.sell(state, r.sold.horses);
    buyThralls(state, rng, year, b.thralls, rep);
    hireServants(state, rng, year, b.servants, rep);
    if (r.wagesShort > 0.5) dismissUnpaid(state, r.wagesShort, rep);
    if (r.wedding) seekWife(state, rng, year, r.wedding, rep);
    if (r.concubine) takeConcubine(state, rng, year, r.concubine.cost, rep);
    thrallMood(state, rng, res.hungerFrac, plan.treatment, rep);
    const died = [];
    mortality(state, rng, S, year, res.hungerFrac, died);
    const marriages = [];
    if (S === 'summer') marryOffDaughters(state, rng, year, marriages, rep);
    const born = [];
    if (!(awayAtStart && S === 'winter')) births(state, rng, year, res.hungerFrac, born);
    for (const m of marriages) rep.household.push(m.text);
    for (const d of died) rep.household.push(d.text);
    for (const x of born) rep.household.push(x.text);

    // ---- honor
    const head = state.people[state.headId];
    const honorSum = rep.honorParts.reduce((s, p) => s + p.d, 0);
    if (head.deathYear == null) head.attrs.honor = r1(clamp(head.attrs.honor + honorSum, 1, 100));
    state.lastHonor = head.attrs.honor;
    state.peakHonor = Math.max(state.peakHonor || 0, state.lastHonor);

    // ---- the head's death and the line
    let carryOn = true;
    if (head.deathYear != null) carryOn = succeed(state, rng, year, rep);

    // ---- the wives: moods, housekeeping, and the incidents that wait for an answer
    state.pending = [];
    if (carryOn && IS.Household) IS.Household.afterSeason(state, rng, rep, res);
    IS.Stable.sync(state, rng);
    state.pendingTotal = state.pending.length;

    const f = state.farm;
    f.wealth = E.wealth(f); f.tier = E.tierOfFarm(f); f.tierLabel = IS.Start.TIER_LABEL[f.tier];
    rep.after = snapshot(state);
    rep.honorDelta = r1(honorSum);
    state.history = state.history || [];
    state.history.push({ turn: state.turn, year, season: S, wealth: f.wealth, honor: rep.after.honor, people: rep.after.people, cattle: f.cattle, sheep: f.sheep, hay: f.hay, cash: rep.after.cash });

    if (state.expedition && state.turn + 1 >= state.expedition.untilTurn) {
      if (awayAtStart) rep.raid.push('The ship is home: you are back on the farm.');
      state.expedition = null;
    }
    state.turn += 1;
    if (carryOn) { prepare(state, rng); state.mode = state.pending.length ? 'incident' : 'report'; } else { state.mode = 'over'; state.over.summary = summary(state); }
    state.report = rep;
    state.rngState = rng.getState();
    return rep;
  }

  /** The head died outside the season's resolution (for instance on a raid you chose in an event). */
  function headDied(state, rng) {
    const year = E.yearOf(state);
    state.pending = []; state.pendingTotal = 0;
    state.lastHonor = state.people[state.headId].attrs.honor;
    const ok = succeed(state, rng, year, state.report);
    state.report.after = snapshot(state);
    if (!ok) state.over.summary = summary(state);
    return ok;
  }

  function proceed(state) {
    if (state.mode === 'report') state.mode = 'plan';
    return state;
  }

  IS.Turn = { OMEN, omenOf: (state) => OMEN[state.env.omen + 2], prepare, drawEnv, resolve, proceed, summary, snapshot, rngOf, removeFromHousehold, headDied };
})();
