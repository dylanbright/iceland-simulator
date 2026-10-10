/* Raiding: the summer voyage. You can sponsor a raid (buy a ship, pick a coast, hand the farm to an adult of
 * your house) or, as an event, be invited on a neighbor's. Survival leans on your Strength. Loot, thralls,
 * Honor and sometimes a foreign king's favor come back with you. Far coasts mean a wintering abroad. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const E = IS.Economy, P = IS.Person;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const r1 = (v) => Math.round(v * 10) / 10;
  const fmt = (x) => Math.round(x).toLocaleString('en-US');

  const SHIP_COST = 420;
  const outfit = (tier) => 90 + 30 * tier;
  const SHARE_FEE = 30;

  /* dist: how far; risk: base chance of dying; loot: plunder (ells) of a fair raid when you sponsor it;
   * winter: you stay abroad until next summer; favor: chance a king takes notice. */
  const DEST = {
    hebrides: { id: 'hebrides', name: 'the Hebrides and Scotland', short: 'the Hebrides', dist: 1, risk: 0.04, loot: 800, winter: false, favor: 0.05, king: 'the Earl of the Isles', prize: 'a farming settlement' },
    ireland: { id: 'ireland', name: 'Ireland', short: 'Ireland', dist: 2, risk: 0.06, loot: 1100, winter: false, favor: 0.08, king: 'the king of Dublin', prize: 'a monastery by the river' },
    england: { id: 'england', name: 'England', short: 'England', dist: 3, risk: 0.08, loot: 1500, winter: false, favor: 0.14, king: 'the king of the English', prize: 'a rich market town' },
    baltic: { id: 'baltic', name: 'the Baltic shores', short: 'the Baltic', dist: 4, risk: 0.09, loot: 1700, winter: true, favor: 0.10, king: 'a chieftain of the Kurs', prize: 'a trading town on the amber coast' },
    frankland: { id: 'frankland', name: 'Frankland and the southern coasts', short: 'Frankland', dist: 5, risk: 0.11, loot: 2000, winter: true, favor: 0.12, king: 'the duke of the Normans', prize: 'a wealthy river town' },
  };
  const ORDER = ['hebrides', 'ireland', 'england', 'baltic', 'frankland'];

  const headOf = (state) => state.people[state.headId];
  const isAway = (state) => !!state.expedition && state.turn < state.expedition.untilTurn;
  const alive = (state, id) => state.people[id] && state.people[id].deathYear == null;

  /** Adults of the house who could run the farm while you are gone. */
  function deputies(state) {
    const hh = state.household, year = E.yearOf(state);
    const out = [];
    for (const id of [...hh.children, ...hh.kin, ...hh.wives]) {
      const p = state.people[id];
      if (!p || p.deathYear != null) continue;
      const age = year - p.birthYear;
      if (age < 16 || age > 65) continue;
      const role = p.role === 'wife' ? 'your wife' : ['mother', 'stepmother', 'brother', 'sister', 'son', 'daughter'].includes(p.role) ? 'your ' + p.role : p.role;
      out.push({ id, name: p.first, role, age, husbandry: Math.round(p.attrs.husbandry) });
    }
    return out.sort((a, b) => b.husbandry - a.husbandry);
  }
  const headFit = (state) => { const a = E.yearOf(state) - headOf(state).birthYear; return a >= 16 && a <= 55; };
  function canRaid(state) {
    return E.seasonOf(state) === 'summer' && !state.expedition && headFit(state) && deputies(state).length > 0;
  }
  function heirless(state) {
    const year = E.yearOf(state);
    const sons = state.household.children.filter((id) => alive(state, id) && state.people[id].sex === 'M');
    const bros = state.household.kin.filter((id) => alive(state, id) && state.people[id].sex === 'M' && state.people[id].role === 'brother');
    void year;
    return !sons.length && !bros.length;
  }
  const cost = (state) => outfit(E.tierOfFarm(state.farm)) + (state.ship ? 0 : SHIP_COST);

  /** How well the person left in charge keeps the farm going (1 = as well as you would). */
  function stewardEff(state) {
    const x = state.expedition && state.people[state.expedition.deputyId];
    if (!x || x.deathYear != null) return 0.75;
    return clamp(0.78 + x.attrs.husbandry / 450 + (x.role === 'wife' && x.traits.includes('capable') ? 0.04 : 0), 0.75, 1);
  }

  /** Strength-based survival, as a chance of dying on a fair voyage, for showing the player. */
  function strengthFactor(state) {
    const h = headOf(state), age = E.yearOf(state) - h.birthYear;
    let sf = clamp(1.6 - h.attrs.strength / 62, 0.45, 1.5);
    sf *= 1 + Math.max(0, age - 40) * 0.02;
    if (h.traits.includes('fearless')) sf *= 1.1;
    if (h.traits.includes('cautious')) sf *= 0.85;
    return sf;
  }
  function deathEstimate(state, destId, sponsor) {
    const d = DEST[destId];
    return clamp(d.risk * strengthFactor(state) * 1.2 * (sponsor ? 0.9 : 1) * (state.favors && state.favors[destId] ? 0.85 : 1), 0.005, 0.5);
  }

  /* ---------- a man of your house asks to go (an event) ---------- */
  const memberFactor = (state, p) => {
    const age = E.yearOf(state) - p.birthYear;
    return clamp(1.6 - p.attrs.strength / 62, 0.45, 1.5) * (1 + Math.max(0, age - 40) * 0.02);
  };
  /** Men of the house (not the head, never women) who might ask to go. */
  function raiders(state) {
    const hh = state.household, year = E.yearOf(state);
    return [...hh.children, ...hh.kin, ...hh.servants].map((id) => state.people[id])
      .filter((p) => p && p.deathYear == null && p.sex === 'M' && p.kind !== 'thrall'
        && ['son', 'brother', 'servant'].includes(p.role) && year - p.birthYear >= 16 && year - p.birthYear <= 45);
  }
  const memberDeathEstimate = (state, p, destId, outfitted) =>
    clamp(DEST[destId].risk * memberFactor(state, p) * 1.2 * (outfitted ? 0.85 : 1.05) * (state.favors && state.favors[destId] ? 0.85 : 1), 0.005, 0.5);

  function runMember(state, rng, spec, honor) {
    const d = DEST[spec.dest], m = state.people[spec.memberId];
    const lines = [];
    const tier = rollTier(rng, d.dist);
    const favored = !!(state.favors && state.favors[d.id]);
    const pDie = clamp(d.risk * memberFactor(state, m) * DEATH_MULT[tier] * (spec.outfitted ? 0.85 : 1.05) * (favored ? 0.85 : 1), 0, 0.6);
    const died = rng.chance(pDie);
    state.raidLog = state.raidLog || {};
    const yr = E.yearOf(state), old = state.raidLog[d.id];
    const prior = old ? old.n * Math.pow(0.8, Math.max(0, yr - old.y)) : 0;
    state.raidLog[d.id] = { n: prior + 1, y: yr };
    const guard = Math.max(0.4, 1 - 0.15 * prior);
    const loot = Math.round(d.loot * 0.3 * guard * (spec.outfitted ? 1.2 : 1) * (favored ? 1.2 : 1) * TIER_MULT[tier] * rng.float(0.8, 1.25));
    const where = d.short, him = m.first;
    lines.push({
      disaster: `${him} sailed for ${where}, and the raid went wrong: the crew was driven off with heavy losses.`,
      poor: `${him} sailed for ${where}, but the coast was on its guard and the crew took little.`,
      fair: `${him} sailed for ${where} and came back with his share of a fair haul.`,
      great: `${him} sailed for ${where} and came back with a rich share of plunder.`,
      legendary: `${him} sailed for ${where} on a famous raid, and came home with more silver than anyone in the district had seen.`,
    }[tier]);
    const hon = { disaster: -0.5, poor: 0, fair: 0.8, great: 1.6, legendary: 3 }[tier];
    if (died) {
      lines.push(`${him} did not come home. He fell in ${where}.`);
      m.deathYear = yr; m.deathAge = yr - m.birthYear; m.deathCause = 'raid'; m.deathText = `fell on a raid in ${where}`;
      IS.Turn.removeFromHousehold(state, m.id);
      const mother = m.motherId && state.people[m.motherId];
      if (mother) { mother.lastLossTurn = state.turn; if (state.household.wives.includes(mother.id)) mother.attrs.happiness = clamp(mother.attrs.happiness - 8, 0, 100); }
      const keep = tier === 'disaster' ? 0 : Math.round(loot * 0.4);
      if (keep > 0) { state.farm.vadmal += keep; lines.push(`His shipmates brought ${fmt(keep)} ells of his share back to the farm.`); }
      if (tier !== 'disaster') honor(0.5, `${him} fell bravely on a raid`);
      return { lines, died: true, tier };
    }
    if (rng.chance(clamp(0.2 * memberFactor(state, m), 0.04, 0.5)) && tier !== 'poor') {
      const w = rng.int(3, 10);
      m.peak.strength = Math.max(8, m.peak.strength - w); m.attrs.strength = Math.max(8, m.attrs.strength - w);
      lines.push(`${him} was wounded and has lost some of his strength.`);
    }
    if (loot > 0) {
      const share = m.role === 'servant' ? 0.5 : 1;
      const got = Math.round(loot * share);
      const silver = Math.floor((got * 0.5) / E.C.EYRIR);
      state.farm.silver += silver; state.farm.vadmal += got - silver * E.C.EYRIR;
      lines.push(`He brought ${fmt(got)} ells in silver and goods to the farm.`);
    }
    if (['fair', 'great', 'legendary'].includes(tier)) {
      const n = rng.int(0, { fair: 1, great: 2, legendary: 3 }[tier]);
      if (n > 0) { addThralls(state, rng, n); lines.push(`${n === 1 ? 'A captive' : n + ' captives'} came back with him.`); }
    }
    if (hon) honor(hon, `${him}'s raid on ${where}`);
    return { lines, died: false, tier };
  }

  const TIERS = ['disaster', 'poor', 'fair', 'great', 'legendary'];
  const TIER_MULT = { disaster: 0, poor: 0.35, fair: 1, great: 1.9, legendary: 3.4 };
  const DEATH_MULT = { disaster: 3, poor: 1.2, fair: 0.8, great: 0.9, legendary: 1.1 };

  function rollTier(rng, dist) {
    const w = { disaster: 5 + 2.5 * dist, poor: 20, great: 22 + 2 * dist, legendary: 3 + 2 * dist };
    w.fair = 100 - w.disaster - w.poor - w.great - w.legendary;
    return rng.weighted(TIERS, (t) => w[t]);
  }

  /** Begin a sponsored raid at the start of the summer: pays for the ship and the outfitting. */
  function begin(state, spec, rep) {
    const valid = spec && DEST[spec.dest] && canRaid(state) && deputies(state).some((d) => d.id === spec.deputyId);
    if (!valid) return null;
    const total = cost(state);
    if (E.cashOf(state.farm) < total) { rep.raid.push(`You could not find ${fmt(total)} ells for the ship and the crew, so no raid sailed.`); return null; }
    E.pay(state.farm, total);
    const d = DEST[spec.dest];
    if (!state.ship) state.ship = { built: E.yearOf(state) };
    state.expedition = { dest: d.id, deputyId: spec.deputyId, sponsor: true, untilTurn: state.turn + (d.winter ? 2 : 1) };
    const dep = state.people[spec.deputyId];
    rep.raid.push(`You fitted out a ship for ${d.name} (${fmt(total)} ells) and left ${dep.first} in charge of the farm${d.winter ? ', and you will winter abroad' : ''}.`);
    return { dest: d.id, sponsor: true, deputyId: spec.deputyId };
  }

  function addThralls(state, rng, n) {
    const year = E.yearOf(state);
    for (let i = 0; i < n; i++) {
      const sex = rng.chance(0.5) ? 'M' : 'F';
      const t = P.make(rng, () => 'n' + (state.idn = (state.idn || 0) + 1), { sex, birthYear: year - rng.int(14, 32), role: 'none', kind: 'thrall' });
      t.role = 'thrall'; t.attrs.resentment = rng.int(48, 70); P.refresh(t, year);
      state.people[t.id] = t; state.household.thralls.push(t.id);
    }
  }

  /** Sail, fight, come home (or do not). honor(d, why) records Honor. Returns { lines, died }. */
  function run(state, rng, spec, honor) {
    const d = DEST[spec.dest], head = headOf(state);
    const sponsor = !!spec.sponsor;
    const lines = [];
    const dist = d.dist;
    const tier = rollTier(rng, dist);
    const favored = !!(state.favors && state.favors[d.id]);
    const sf = strengthFactor(state);
    const pDie = clamp(d.risk * sf * DEATH_MULT[tier] * (sponsor ? 0.9 : 1) * (favored ? 0.85 : 1), 0, 0.6);
    const died = rng.chance(pDie);

    state.raidLog = state.raidLog || {};
    // a coast raided again and again grows watchful; the memory fades by a fifth each year
    const yr = E.yearOf(state), old = state.raidLog[d.id];
    const prior = old ? old.n * Math.pow(0.8, Math.max(0, yr - old.y)) : 0;
    state.raidLog[d.id] = { n: prior + 1, y: yr };
    const guard = Math.max(0.4, 1 - 0.15 * prior);
    const trait = head.traits.includes('fearless') ? 1.1 : head.traits.includes('cautious') ? 0.92 : 1;
    const base = d.loot * (sponsor ? 1 : 0.3) * guard * trait * (favored ? 1.2 : 1);
    const loot = Math.round(base * TIER_MULT[tier] * rng.float(0.8, 1.25));

    const where = d.short;
    const glow = clamp((95 - head.attrs.honor) / 60, 0.3, 1.3);
    const H = { disaster: sponsor ? -4 : -1.5, poor: sponsor ? 0.4 : 0, fair: sponsor ? 2.5 + 0.4 * dist : 1, great: sponsor ? 4 + 0.4 * dist : 2, legendary: sponsor ? 6 + 0.5 * dist : 3.5 };
    const hon = H[tier] * (H[tier] > 0 ? glow : 1);

    const story = {
      disaster: sponsor
        ? `The raid on ${where} was a disaster. You were met by armed men, lost most of your crew in the fighting, and beached the ship in a gale on the way home.`
        : `The voyage to ${where} went badly. The fleet was driven off with losses and you came home with little but your life.`,
      poor: `The coast of ${where} was on its guard. You took a few cattle, some cloth and little else.`,
      fair: `You fell on ${d.prize} in ${where} and came away with a fair haul of silver and goods.`,
      great: `The raid on ${where} went better than anyone hoped: you took ${d.prize} and sailed home low in the water with plunder.`,
      legendary: `Men will tell the story of ${where} for years: you took ${d.prize} almost without a fight, and the plunder was beyond counting.`,
    }[tier];
    lines.push(story);

    // wounds
    if (!died && rng.chance(clamp(0.22 * sf * (1 + 0.1 * dist), 0.04, 0.6)) && tier !== 'poor') {
      const w = rng.int(3, 12);
      head.peak.strength = Math.max(8, head.peak.strength - w); head.attrs.strength = Math.max(8, head.attrs.strength - w);
      lines.push(`You took a bad wound in the fighting and lost some of your strength (−${w}).`);
    }

    // loot
    const keep = died ? (tier === 'disaster' ? 0 : Math.round(loot * 0.5)) : loot;
    if (keep > 0) {
      const silver = Math.floor((keep * 0.5) / E.C.EYRIR);
      state.farm.silver += silver; state.farm.vadmal += keep - silver * E.C.EYRIR;
      lines.push(died ? `The crew brought ${fmt(keep)} ells' worth of the plunder home for your heirs.` : `You brought home ${fmt(keep)} ells' worth of silver and goods.`);
    }
    // thralls
    if (!died && tier !== 'disaster') {
      const n0 = { poor: [0, 1], fair: [0, 2 + Math.ceil(dist / 2)], great: [1, 3 + Math.ceil(dist / 2)], legendary: [2, 5 + Math.ceil(dist / 2)] }[tier];
      let n = rng.int(n0[0], n0[1]);
      if (d.id === 'baltic') n = Math.round(n * 1.5);
      if (!sponsor) n = Math.floor(n * 0.4);
      if (n > 0) { addThralls(state, rng, n); lines.push(`${n === 1 ? 'A captive' : n + ' captives'} came home with you, to be thralls on the farm. They are bitter.`); }
    }
    // the ship
    if (sponsor && tier === 'disaster' && state.ship && rng.chance(0.8)) { state.ship = null; lines.push('The ship was lost.'); }
    // honor and favor
    if (!died) {
      if (hon) honor(hon, `A raid on ${where}`);
      if (!favored && ['fair', 'great', 'legendary'].includes(tier)) {
        const p = d.favor * (sponsor ? 1 : 0.4) * (tier === 'legendary' ? 2.5 : tier === 'great' ? 1.5 : 1);
        if (rng.chance(p)) {
          state.favors = state.favors || {}; state.favors[d.id] = true;
          const gift = 80 + 40 * dist;
          state.farm.vadmal += gift;
          honor(3, `${d.king} took notice of you`);
          state.hooks = state.hooks || [];
          state.hooks.push({ text: `${d.king[0].toUpperCase() + d.king.slice(1)} holds you in favor. Raids on ${where} go better for you.` });
          lines.push(`${d.king[0].toUpperCase() + d.king.slice(1)} heard of you and sent a gift of ${fmt(gift)} ells. You are now in his favor.`);
        }
      }
    } else {
      head.attrs.honor = r1(clamp(head.attrs.honor + 3, 1, 100));
      const year = E.yearOf(state);
      head.deathYear = year; head.deathAge = year - head.birthYear; head.deathCause = 'raid';
      head.deathText = `fell on a raid in ${where}`;
      if (state.expedition) state.expedition = null;
      lines.push(`You did not come home. You fell in ${where}, and your crew carried the news back.`);
    }

    // the farm while you were away
    if (!sponsor && !died && spec.deputyId) {
      const dep = state.people[spec.deputyId];
      const lossFrac = clamp(0.15 - (dep ? dep.attrs.husbandry : 40) / 700, 0.02, 0.15);
      const lost = Math.round(state.farm.hay * lossFrac * 10) / 10;
      state.farm.hay = Math.max(0, Math.round((state.farm.hay - lost) * 10) / 10);
      if (dep) lines.push(`${dep.first} kept the farm while you were gone${lost > 0.4 ? `, but about ${lost} tons of hay were lost in the haymaking` : ''}.`);
    }
    return { lines, died, tier, loot: keep };
  }

  IS.Raid = { DEST, ORDER, SHIP_COST, SHARE_FEE, outfit, isAway, deputies, headFit, canRaid, heirless, cost, stewardEff, deathEstimate, strengthFactor, begin, run, raiders, memberDeathEstimate, runMember };
})();
