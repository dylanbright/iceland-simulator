/* The Alþing, and outlawry.
 *
 * state.cases[] { cid, side: 'plaintiff'|'defendant', farm, head, charge, victim, stakes: 'outlawry'|'fine', value,
 *                 hearing (turn), witnesses, theirWitnesses, theirBacker, backer, backerName, lawyer, falseW, defied }
 * A case is heard at the first Alþing at least one season after it is filed. The hearing is a chain of events
 * (data/law-events.js): law_witnesses -> law_backer -> law_plead (verdict) -> perhaps law_brawl (a battle).
 *
 * state.exile { kind: 'lesser'|'full', where: 'mikligardr'|'norway'|'highlands', since, until, gains, farm }
 * Exile uses the expedition machinery (state.expedition with exile: true): the head is away and a deputy runs the farm.
 */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const E = () => IS.Economy;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const CHARGE = {
    killing:      { word: (cs) => `the killing of ${cs.victim || 'a man of the house'}`, strength: 0.08 },
    burning:      { word: () => 'the burning of a house with men inside it', strength: 0.18 },
    broken_peace: { word: (cs) => `the killing of ${cs.victim || 'a man'} in a sworn peace`, strength: 0.2 },
  };

  /* ================= cases ================= */
  const nextHearing = (state) => { let t = state.turn + 2; if (t % 2) t++; return t; };
  /** File a case. Returns the case, or null if one with that house is already waiting. */
  function file(state, rng, spec) {
    state.cases = state.cases || [];
    if (state.cases.some((c) => c.farm === spec.farm)) return null;
    const fam = state.families && state.families[spec.farm];
    const strong = fam && (fam.goði || fam.tier >= 4);
    const cs = Object.assign({
      cid: 'c' + (state.caseSeq = (state.caseSeq || 0) + 1), hearing: nextHearing(state), witnesses: 0,
      theirWitnesses: rng.int(1, 3), theirBacker: strong ? 0.1 : Math.round(rng.float(0, 0.06) * 100) / 100,
      backer: 0, backerName: '', lawyer: false, falseW: false, defied: false, stakes: 'outlawry',
    }, spec);
    state.cases.push(cs);
    return cs;
  }
  const caseOf = (state, cid) => (state.cases || []).find((c) => c.cid === cid) || null;
  const drop = (state, cid) => { state.cases = (state.cases || []).filter((c) => c.cid !== cid); };
  const chargeWord = (cs) => (CHARGE[cs.charge] || CHARGE.killing).word(cs);
  /** The chance that your side carries the case (plaintiff: a verdict for you; defendant: acquittal). */
  function odds(state, cs) {
    const head = state.people[state.headId], fam = state.families && state.families[cs.farm];
    const gap = fam ? (fam.tier - E().tierOfFarm(state.farm)) * 0.03 : 0;
    const ch = (CHARGE[cs.charge] || CHARGE.killing).strength;
    let p = 0.3 + head.attrs.law / 260 + head.attrs.honor / 600 + 0.06 * (cs.witnesses - cs.theirWitnesses) + cs.backer - cs.theirBacker + (cs.lawyer ? 0.08 : 0) - gap;
    p += cs.side === 'plaintiff' ? ch : -ch;
    if (cs.defied) p -= 0.3;
    return clamp(p, 0.08, 0.9);
  }
  const oddsWord = (p) => (p >= 0.7 ? 'the court should be with you' : p >= 0.52 ? 'the case leans your way' : p >= 0.4 ? 'it could go either way' : p >= 0.25 ? 'the case leans against you' : 'the court will likely be against you');

  /** Called from Household.afterSeason: a case whose Alþing is next season begins its hearing now. */
  function tick(state, rng) {
    const cs = (state.cases || []).find((c) => c.hearing <= state.turn + 1);
    if (!cs || state.pending.some((p) => /^law_/.test(p.id))) return;
    const head = state.people[state.headId];
    if (state.expedition && state.turn + 1 < state.expedition.untilTurn) {
      // abroad: a plaintiff's case waits; a defendant is judged without him
      if (cs.side === 'plaintiff') { cs.hearing += 2; return; }
      cs.defied = true;
    }
    if (!head || head.deathYear != null) return;
    state.pending.push({ id: cs.defied && cs.side === 'defendant' ? 'law_absent' : 'law_witnesses', wifeId: null, kind: 'event', params: { cid: cs.cid, farm: cs.farm, head: cs.head } });
  }

  /* ================= exile ================= */
  const WHERE = {
    mikligardr: { name: 'Miklagarðr', death: 0.05, gain: [150, 450], honor: 0.6, line: (rng) => rng.pick(['You stood guard in the emperor\'s hall in Miklagarðr, among Norsemen and Rus.', 'The Varangians fought the Bulgars in the mountains this season. You came back with gold on your arm.', 'You walked the walls of the greatest city in the world and were paid in gold for it.']) },
    norway: { name: 'Norway', death: 0.015, gain: [60, 160], honor: 0.4, line: (rng) => rng.pick(['You spent the season at the earl\'s court in Trondheim, and he gave you a cloak.', 'You went on the earl\'s ships along the coast, and came back with a share.', 'You wintered in Norway among men who had heard of your case and did not hold it against you.']) },
  };
  /** Who can run the farm while the head is gone: the best of the family, or a servant. */
  function steward(state) {
    const d = IS.Raid ? IS.Raid.deputies(state) : [];
    if (d.length) return d[0].id;
    const s = state.household.servants.find((id) => state.people[id] && state.people[id].deathYear == null);
    return s || null;
  }
  function begin(state, kind, where, farm) {
    const len = kind === 'lesser' ? 6 : 40;
    state.exile = { kind, where, since: state.turn, until: state.turn + len, gains: 0, farm };
    state.expedition = { dest: 'exile', exile: true, deputyId: steward(state), untilTurn: state.turn + len };
  }
  function end(state) { state.exile = null; if (state.expedition && state.expedition.exile) state.expedition = null; }
  /** Called from Turn.resolve each season the head is in exile. May kill him; brings him home at the end. */
  function season(state, rng, rep) {
    const x = state.exile;
    if (!x) return;
    const head = state.people[state.headId], year = E().yearOf(state);
    const W = WHERE[x.where];
    if (W) {
      if (rng.chance(W.death)) {
        head.deathYear = year; head.deathCause = 'killed abroad'; head.deathText = x.where === 'mikligardr' ? 'fell in the emperor\'s wars, far from Iceland' : 'died abroad in Norway'; head.deathAge = year - head.birthYear;
        rep.raid.push(`Word came from ${W.name}: you are dead. ${x.where === 'mikligardr' ? 'You fell in the emperor\'s wars.' : 'A fever took you.'}`);
        state.exile = null; return;
      }
      x.gains += rng.int(W.gain[0], W.gain[1]);
      rep.honorParts.push({ d: W.honor, why: `Service in ${W.name}` });
      if (x.where === 'mikligardr') head.attrs.strength = Math.min(90, head.attrs.strength + 1);
      rep.raid.push(W.line(rng));
    } else {
      // the highlands: cold and hunger wear a man down
      const loss = rng.int(1, 3);
      head.attrs.strength = Math.max(5, head.attrs.strength - loss);
      rep.raid.push(rng.pick(['You lived in a cave above the glacier and ate what you could catch.', 'You moved from shieling to shieling, never sleeping in the same place twice.', 'The cold got into your bones this season. You are not the man you were.']));
      if (head.attrs.strength <= 8 && rng.chance(0.4)) {
        head.deathYear = year; head.deathCause = 'exposure'; head.deathText = 'died of cold and hunger as an outlaw in the highlands'; head.deathAge = year - head.birthYear;
        rep.raid.push('The cold took you in the end, alone in the highlands.'); state.exile = null; return;
      }
    }
    if (state.turn + 1 >= x.until) homecoming(state, rep);
  }
  function homecoming(state, rep) {
    const x = state.exile, W = WHERE[x.where];
    state.farm.vadmal += x.gains;
    if (W) {
      rep.raid.push(`Your three years are served. You came home from ${W.name}${x.gains ? ` with ${x.gains.toLocaleString('en-US')} ells in gold and silver` : ''}, and the case is closed.`);
      rep.honorParts.push({ d: 2, why: `You came home from ${W.name} with your sentence served` });
      if (IS.Saga) IS.Saga.note(state, 'exile', `He served three years of outlawry in ${W.name} and came home ${x.gains > 900 ? 'a rich man' : 'with his sentence served'}.`, x.where === 'mikligardr' ? 4 : 2);
    } else {
      rep.raid.push('After twenty years in the highlands, the law lets you go. You came down to your own farm an old, hard man.');
      if (IS.Saga) IS.Saga.note(state, 'exile', 'He lived twenty years as an outlaw in the highlands, and the law let him go at last.', 6);
    }
    if (x.farm && IS.Feud) IS.Feud.end(state, x.farm);
    end(state);
  }
  /** Called from Household.afterSeason, even while away: the highland outlaw's season. */
  function exileTick(state, rng) {
    const x = state.exile;
    if (!x || x.where !== 'highlands') return;
    const head = state.people[state.headId];
    if (!head || head.deathYear != null) return;
    state.pending.push({ id: 'outlaw_season', wifeId: null, kind: 'event', params: { farm: x.farm || '', head: '', summer: IS.Calendar.turnInfo(state.turn + 1, state.startYear).season === 'summer' } });
  }

  IS.Law = { CHARGE, file, caseOf, drop, odds, oddsWord, chargeWord, tick, nextHearing, WHERE, steward, begin, end, season, homecoming, exileTick };
})();
