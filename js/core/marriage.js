/* Taking a wife or a concubine, and how the women already in the house take it.
 * A second wife is a legal marriage with a dowry; a concubine is cheaper, brings nothing, and her children
 * are not legitimate heirs unless there is no legitimate son. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const E = IS.Economy, P = IS.Person, A = IS.Ancestry, T = IS.Traits, N = IS.Names;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round10 = (v) => Math.round(v / 10) / 1 * 10 / 10;
  const r10 = (v) => Math.round(v / 10) * 10;
  const idGen = (state) => () => 'n' + (state.idn = (state.idn || 0) + 1);
  const conc = (state) => (state.household.concubines = state.household.concubines || []);
  const alive = (state, id) => state.people[id] && state.people[id].deathYear == null;
  void round10;

  const headAge = (state) => E.yearOf(state) - state.people[state.headId].birthYear;
  const concubineCost = (tier) => 40 + 15 * tier;
  const canTakeConcubine = (state) => !(state.expedition && state.turn < state.expedition.untilTurn) && conc(state).length < 2 && headAge(state) >= 17;

  /** Is a new bride sensible? (for hints) No sons, and no wife young enough to bear them. */
  function needsHeir(state) {
    const hh = state.household, year = E.yearOf(state);
    const sons = hh.children.filter((id) => alive(state, id) && state.people[id].sex === 'M' && state.people[id].legit !== false);
    const fertile = [...hh.wives].some((id) => alive(state, id) && year - state.people[id].birthYear <= 38);
    return !sons.length && !fertile;
  }

  /** How the women already in the house take a rival. Returns text lines. */
  function reaction(state, rng, newcomer, kind) {
    const hh = state.household, lines = [];
    for (const id of hh.wives) {
      if (id === newcomer.id) continue;
      const w = state.people[id];
      let d = kind === 'wife' ? -10 : -7;
      if (w.traits.includes('jealous')) d -= kind === 'wife' ? 15 : 13;
      if (w.traits.includes('proud')) d -= 5;
      if (w.traits.includes('peacemaker')) d += 6;
      w.attrs.happiness = clamp(Math.round(w.attrs.happiness + d), 0, 100);
      w.bias = clamp((w.bias || 0) + d * 0.6, -35, 10);
      const g = w.traits.includes('jealous') ? 55 : w.traits.includes('vindictive') || w.traits.includes('proud') ? 35 : 15;
      (state.grudges[id] = state.grudges[id] || []).push({ target: { type: 'person', id: newcomer.id }, reason: kind === 'wife' ? 'a rival wife' : 'the concubine', intensity: g });
      if (d <= -12) lines.push(`${w.first} took it badly.`);
      else if (d <= -7) lines.push(`${w.first} was cool about it.`);
    }
    return lines;
  }

  /** Create a bride and bring her in. Returns { wife, dowry, lines }. */
  function newWife(state, rng, year) {
    const tier = E.tierOfFarm(state.farm);
    const kinTier = clamp(tier + rng.int(-1, 1), 1, 5);
    const fam = A.newFamily({ rng, families: state.families }, 'wife-kin', kinTier);
    const age = rng.clampedNormal(20, 3, 16, 30);
    const wife = P.make(rng, idGen(state), {
      sex: 'F', birthYear: year - age, father: fam.head, role: 'wife',
      honor: rng.clampedNormal(40 + kinTier * 3, 10, 8, 90), happiness: clamp(rng.clampedNormal(62, 10, 25, 90), 20, 92),
    });
    wife.kin = { farm: fam.farm, tier: kinTier }; wife.role = 'wife';
    wife.knownTraits = wife.traits.filter((t) => T.WIFE[t].visible);
    P.refresh(wife, year);
    const dowry = r10(A.TIER_WEALTH[kinTier] * rng.float(0.07, 0.14));
    state.farm.vadmal += dowry;
    state.people[wife.id] = wife;
    const lines = reaction(state, rng, wife, 'wife');
    state.household.wives.push(wife.id);
    state.marriages.push({ wifeId: wife.id, startY: year, kinFarm: fam.farm, kinTier, dowry, status: 'married' });
    state.grudges[wife.id] = state.grudges[wife.id] || [];
    state.married = true;
    return { wife, dowry, kinFarm: fam.farm, lines };
  }

  /** What weighs on a suit: Honor, wealth (farm tier) and a way with words (Poetry). Each is a plus or minus to the chance. */
  function suitParts(state) {
    const head = state.people[state.headId];
    return {
      honor: (head.attrs.honor - 50) / 150,                     // -0.33 .. +0.33
      wealth: (E.tierOfFarm(state.farm) - 3) * 0.05,            // -0.10 .. +0.10
      poetry: clamp((head.attrs.poetry - 30) / 250, -0.04, 0.26), // +0.24 at Poetry 90
      rival: state.household.wives.length ? -0.08 : 0,
    };
  }
  const poetryBonus = (state) => suitParts(state).poetry;
  const suitChance = (state) => {
    const p = suitParts(state);
    return clamp(0.6 + p.honor + p.wealth + p.poetry + p.rival, 0.15, 0.95);
  };
  /** Plain words for what is helping or hurting a suit, for the planning screen. */
  function suitWords(state) {
    const p = suitParts(state), up = [], down = [];
    (p.honor >= 0.08 ? up : p.honor <= -0.08 ? down : []).push('your Honor');
    (p.wealth >= 0.05 ? up : p.wealth <= -0.05 ? down : []).push('your wealth');
    (p.poetry >= 0.08 ? up : []).push('your way with words');
    return { up, down };
  }

  /** Bring in a concubine: a freewoman of small means, or a woman of the household. Returns { woman, lines }. */
  function newConcubine(state, rng, year) {
    const age = rng.clampedNormal(21, 4, 16, 34);
    const w = P.make(rng, idGen(state), { sex: 'F', birthYear: year - age, role: 'wife', honor: rng.clampedNormal(30, 8, 5, 60), happiness: rng.clampedNormal(60, 10, 30, 85) });
    w.role = 'concubine';
    w.knownTraits = w.traits.filter((t) => T.WIFE[t].visible);
    P.refresh(w, year);
    state.people[w.id] = w;
    const lines = reaction(state, rng, w, 'concubine');
    conc(state).push(w.id);
    return { woman: w, lines };
  }

  IS.Marriage = { concubineCost, canTakeConcubine, needsHeir, reaction, newWife, newConcubine, suitChance, suitParts, suitWords, poetryBonus, conc };
})();
