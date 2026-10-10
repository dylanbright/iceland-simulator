/* Ancestry generator.
 * Builds three prior generations (great-grandfather, grandfather, father), each with wives,
 * children, deeds, misfortunes and a death. The chain of results fixes what the player inherits:
 * land, movable wealth, starting Honor, and legacy hooks (debts, feuds, favours).
 * Deterministic for a given seed. Pure data: no DOM. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const R = IS.Rules, N = IS.Names, T = IS.Traits, P = IS.Person;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round10 = (v) => Math.round(v / 10) * 10;
  const round100 = (v) => Math.round(v / 100) * 100;
  /** A null deathYear means the person is still alive. */
  const aliveAt = (p, y) => p.deathYear == null || p.deathYear > y;

  // Rough family wealth by tier (ells), used for dowries and for matching marriages.
  const TIER_WEALTH = [0, 800, 2000, 4500, 9000, 16000];
  function tierOf(w) { return w < 1200 ? 1 : w < 3000 ? 2 : w < 6500 ? 3 : w < 12000 ? 4 : 5; }

  /* ---------- families (neighbours, in-laws, rivals) ---------- */
  function newFamily(ctx, role, tierHint) {
    const rng = ctx.rng;
    let farm, guard = 0;
    do { farm = N.farmName(rng); } while (ctx.families[farm] && guard++ < 40);
    const tier = tierHint || rng.weighted([{ t: 1, w: 15 }, { t: 2, w: 30 }, { t: 3, w: 30 }, { t: 4, w: 17 }, { t: 5, w: 8 }], (x) => x.w).t;
    const fam = { farm, head: N.male(rng), tier, roles: [role], goði: false };
    ctx.families[farm] = fam;
    return fam;
  }
  const famLabel = (f) => f.head.first + ' of ' + f.farm;

  /* ---------- deeds that move Honor ---------- */
  const REL = ['brother', 'foster-brother', 'uncle', 'father-in-law', 'cousin'];
  const DEEDS = [
    { id: 'avenged_kin', d: [8, 14], boost: { hotheaded: 2, fearless: 1.5, proud: 1.3, peaceable: 0.3, cautious: 0.5 },
      text: (c) => `${c.name} avenged his ${c.rel} by killing a man of ${c.foe}'s household, and then paid the fine without complaint.` },
    { id: 'won_duel', d: [6, 10], boost: { hotheaded: 1.6, fearless: 2, cautious: 0.4 },
      text: (c) => `${c.name} met ${c.foe} on the island and won the duel; the sacrificial bull's blood was talked of for years.` },
    { id: 'withdrew_duel', d: [-8, -4], boost: { fearless: 0.3, cautious: 1.3 },
      text: (c) => `${c.name} stepped off the cloak when ${c.foe} drew blood, and paid his hundred.` },
    { id: 'declined_duel', d: [-12, -8], boost: { cautious: 2, peaceable: 1.3, fearless: 0.2, hotheaded: 0.2 },
      text: (c) => `${c.name} refused ${c.foe}'s challenge to go to the island, and the valley has not forgotten it.` },
    { id: 'won_case', d: [4, 9], boost: { cunning: 1.3, just: 1.3 },
      text: (c) => `${c.name} won a case against ${c.foe} at the Thing.` },
    { id: 'lost_case', d: [-9, -4], boost: { hotheaded: 1.2 },
      text: (c) => `${c.name} lost a lawsuit against ${c.foe} and was fined for his trouble.` },
    { id: 'great_feast', d: [4, 8], boost: { generous: 2.2, greedy: 0.3, proud: 1.3 },
      text: (c) => `${c.name} gave a feast at the end of summer that fed ${c.foe}'s household and half the valley.` },
    { id: 'famous_gift', d: [3, 7], boost: { generous: 1.8, greedy: 0.4 },
      text: (c) => `${c.name} gave ${c.foe} a gift so fine that ${c.foe} could not match it, and people spoke of it.` },
    { id: 'poem', d: [3, 8], boost: {}, poet: true,
      text: (c) => `A verse of ${c.name}'s on the wedding of ${c.foe}'s daughter was repeated at every farm in the valley.` },
    { id: 'broken_oath', d: [-18, -10], boost: { greedy: 1.5, cunning: 1.4, just: 0.1 },
      text: (c) => `${c.name} broke an oath sworn to ${c.foe}, and men remembered it.` },
    { id: 'unpaid_debt', d: [-10, -5], boost: { greedy: 2, generous: 0.4 },
      text: (c) => `${c.name} left a debt to ${c.foe} unpaid for years.` },
    { id: 'turned_away', d: [-9, -5], boost: { greedy: 2, generous: 0.2 },
      text: (c) => `${c.name} turned a traveller from his door in the depth of winter, and word of it spread.` },
    { id: 'settled_feud', d: [6, 12], boost: { peaceable: 2, just: 1.6, hotheaded: 0.3 },
      text: (c) => `${c.name} brought a quarrel with ${c.foe} to a settlement that both sides accepted.` },
    { id: 'concealed_killing', d: [-20, -12], boost: { cunning: 1.5, hotheaded: 1.3, just: 0.1 },
      text: (c) => `A man was found dead on the road beside ${c.foe}'s land. The killing had been hidden, the matter came out, and ${c.name} was blamed.` },
    { id: 'kin_outlawed', d: [-9, -5], boost: {},
      text: (c) => `A kinsman of ${c.name} was outlawed at the Althing, and the shame touched the whole family.` },
    { id: 'voyage', d: [4, 8], boost: { greedy: 1.2, cunning: 1.2 },
      text: (c) => `${c.name} sailed to Norway with a cargo of wool and returned with timber, iron and a good name.` },
  ];

  /* ---------- misfortunes and windfalls that move wealth ---------- */
  const EVENTS = [
    { id: 'fire', w: 1, mM: 0.85, mL: 0.9, text: (c) => `A fire destroyed the hall at ${c.farm}, and rebuilding cost dear.` },
    { id: 'ashfall', w: 0.6, mM: 0.75, mL: 0.9, text: () => `Ash from a fire-mountain fell on the pastures, and many sheep died.` },
    { id: 'hard_winters', w: 1.4, mM: 0.75, mL: 1, text: () => `Two hard winters in a row left the hay short and the cattle thin.` },
    { id: 'whale', w: 0.8, mM: 1.2, mL: 1, coast: true, text: () => `A stranded whale on the shore gave meat, oil and bone to the whole district.` },
    { id: 'trade', w: 1, mM: 1.25, mL: 1, text: () => `A profitable voyage to Norway brought back timber and iron.` },
    { id: 'feud_fine', w: 1.2, mM: 0.8, mL: 1, text: () => `The household paid compensation for a killing done by one of its men.` },
    { id: 'inheritance', w: 0.8, mM: 1.2, mL: 1, text: () => `An inheritance came through the wife's kin.` },
    { id: 'driftwood', w: 0.8, mM: 1.1, mL: 1, coast: true, text: () => `Rich harvests of driftwood on the shore brought good trade.` },
    { id: 'good_years', w: 1.2, mM: 1.15, mL: 1, text: () => `Several good seasons filled the hay-barns and the skyr-casks.` },
    { id: 'land_sold', w: 0.7, mM: 1.1, mL: 0.5, text: () => `Part of the land had to be sold to meet debts and compensation.` },
    { id: 'sheep_plague', w: 0.9, mM: 0.8, mL: 1, text: () => `A sickness among the sheep cost the flock dearly.` },
  ];

  /* ---------- legacy hooks ---------- */
  const SUBJECTS = ['a boundary dispute', 'a stolen horse', 'a disputed inheritance', 'a broken contract', 'a drowned boat'];
  function makeHook(ctx, type, gi, year, extra) {
    const rng = ctx.rng;
    const h = Object.assign({ id: 'h' + (ctx.hooks.length + 1), type, gen: gi, year, status: 'open' }, extra || {});
    if (type !== 'unavenged_killing' && type !== 'kin_outlawed' && !h.farm) {
      const fam = newFamily(ctx, type, h.tierHint);
      if (type === 'grudging_goði') fam.goði = true;
      h.farm = fam.farm; h.label = famLabel(fam);
    }
    switch (type) {
      case 'blood_money_owed': h.amount = round10(rng.int(200, 900)); h.text = `The family still owes ${h.amount} ells in blood-money to ${h.label}.`; break;
      case 'blood_money_due': h.amount = round10(rng.int(200, 900)); h.text = `${h.label} owes the family ${h.amount} ells in blood-money and has not yet paid.`; break;
      case 'debt': h.amount = round10(rng.int(150, 700)); h.text = `The family owes ${h.amount} ells to ${h.label}.`; break;
      case 'lawsuit_pending': h.subject = rng.pick(SUBJECTS); h.text = `A suit against ${h.label} over ${h.subject} was never settled and may be taken up again.`; break;
      case 'grudging_goði': h.text = `${h.label}, a goði of the district, holds an old grudge against the family.`; break;
      case 'kin_outlawed': { const k = N.male(rng); h.kinName = k.first; h.text = `A kinsman, ${k.first}, lives under sentence of outlawry in the highlands.`; break; }
      case 'unavenged_killing': h.text = `${h.victimName} was killed by ${h.killerLabel}, and the killing has not been avenged.`; break;
    }
    ctx.hooks.push(h);
    return h;
  }
  const RANDOM_HOOKS = ['blood_money_owed', 'blood_money_due', 'debt', 'lawsuit_pending', 'grudging_goði', 'kin_outlawed'];

  /* ---------- timeline helpers ---------- */
  function sampleDeath(rng, birth, minAge, minYear, maxYear) {
    for (let i = 0; i < 40; i++) {
      const y = birth + R.rollAgeAtDeath(rng, minAge, 'M');
      if (y >= minYear && y <= maxYear) return y;
    }
    return null;
  }

  function divorceRisk(wife, man) {
    let r = 0.008;
    const add = { jealous: 0.01, proud: 0.006, vindictive: 0.006, malicious: 0.012, wasteful: 0.004, peacemaker: -0.005, meddling: 0.003 };
    for (const t of wife.traits) r += add[t] || 0;
    if (man.traits.includes('hotheaded')) r += 0.004;
    if (man.traits.includes('peaceable')) r -= 0.002;
    return Math.max(0.002, r);
  }

  function makeWife(ctx, startY, manTier) {
    const rng = ctx.rng;
    const tier = clamp(manTier + rng.int(-1, 1), 1, 5);
    const fam = newFamily(ctx, 'wife-kin', tier);
    const ageAtM = rng.clampedNormal(20, 3, 16, 30);
    const wife = P.make(rng, ctx.nextId, {
      sex: 'F', birthYear: startY - ageAtM, father: fam.head, role: 'wife',
      honor: rng.clampedNormal(40 + tier * 3, 10, 8, 90),
    });
    wife.kin = { farm: fam.farm, tier };
    return { wife, fam, ageAtM, tier };
  }

  /* ---------- marriages (serial; each ends by death, divorce or the husband's death) ---------- */
  function buildMarriages(ctx, man, heir, deathYear, manTier) {
    const rng = ctx.rng;
    const marriages = [];
    let startY = man.birthYear + rng.clampedNormal(24, 4, 18, 36);
    if (startY > heir.birthYear) startY = heir.birthYear - rng.int(0, 2);
    if (startY - man.birthYear < 17) return null;
    let coversHeir = false;
    for (let w = 0; w < 3; w++) {
      if (startY >= deathYear) break;
      const { wife, ageAtM, tier } = makeWife(ctx, startY, manTier);
      let endY = deathYear, endReason = 'husband died';
      const wifeDeath = Math.max(startY + 1, wife.birthYear + R.rollAgeAtDeath(rng, ageAtM, 'F'));
      wife.deathYear = wifeDeath;
      if (wifeDeath < endY) { endY = wifeDeath; endReason = 'wife died'; }
      const risk = divorceRisk(wife, man);
      for (let y = startY + 1; y < endY; y++) {
        if (rng.chance(risk)) { endY = y; endReason = 'divorce'; break; }
      }
      const m = { wife, startY, endY, endReason, kinFarm: wife.kin.farm, kinTier: tier,
        dowry: round10(TIER_WEALTH[tier] * rng.float(0.07, 0.14)), children: [], mother: false };
      const hb = heir.birthYear;
      if (hb >= startY && hb <= endY && hb - wife.birthYear >= 16 && hb - wife.birthYear <= 42) { m.mother = true; coversHeir = true; }
      marriages.push(m);
      if (endReason === 'husband died') break;
      if (endY - man.birthYear > 58 && rng.chance(0.6)) break;
      if (!rng.chance(0.75)) break;
      startY = endY + (endReason === 'wife died' ? rng.int(1, 3) : rng.int(0, 2));
    }
    return coversHeir ? marriages : null;
  }

  /* ---------- children ---------- */
  function buildChildren(ctx, man, marriages, heir, deathYear, namesakes) {
    const rng = ctx.rng;
    const kids = [];
    for (const m of marriages) {
      const fertileFrom = m.wife.birthYear + 17;
      const fertileTo = Math.min(m.endY, m.wife.birthYear + 41);
      let lastBirth = -99;
      for (let y = Math.max(m.startY + 1, fertileFrom); y <= fertileTo; y++) {
        if (y === heir.birthYear && m.mother) continue;
        if (y - lastBirth < 2 && !rng.chance(0.1)) continue;
        const p = Math.max(0.1, 0.36 - Math.max(0, y - (m.wife.birthYear + 30)) * 0.02);
        if (!rng.chance(p)) continue;
        lastBirth = y;
        const sex = rng.chance(0.5) ? 'M' : 'F';
        let name = null;
        if (sex === 'M' && rng.chance(0.3)) {
          const pool = namesakes.filter((n) => n.deathYear < y);
          if (pool.length) name = rng.pick(pool).name;
        }
        const c = P.make(rng, ctx.nextId, { sex, birthYear: y, name: name ? { first: name.first, gen: name.gen } : undefined, father: man, role: 'none' });
        c.deathYear = y + R.rollAgeAtDeath(rng, 0, sex);
        c.motherId = m.wife.id;
        m.children.push(c); kids.push(c);
      }
      if (m.mother) {
        heir.motherId = m.wife.id;
        m.children.push(heir); kids.push(heir);
      }
    }
    kids.sort((a, b) => a.birthYear - b.birthYear);
    return kids;
  }

  /* ---------- deeds ---------- */
  function rollDeeds(ctx, man, deathYear) {
    const rng = ctx.rng;
    const count = rng.weighted([{ n: 0, w: 15 }, { n: 1, w: 35 }, { n: 2, w: 35 }, { n: 3, w: 15 }], (x) => x.w).n;
    const used = new Set();
    const deeds = [];
    for (let i = 0; i < count; i++) {
      const pool = DEEDS.filter((d) => !used.has(d.id));
      const dd = rng.weighted(pool, (d) => {
        let w = 1;
        for (const t of man.traits) if (d.boost[t]) w *= d.boost[t];
        if (d.poet) w *= Math.max(0.2, man.attrs.poetry / 35);
        return w;
      });
      used.add(dd.id);
      const foe = newFamily(ctx, 'rival');
      const delta = rng.int(dd.d[0], dd.d[1]);
      const year = rng.int(man.birthYear + 20, Math.max(man.birthYear + 21, Math.min(deathYear, man.birthYear + 60)));
      const text = dd.text({ name: man.first, foe: famLabel(foe), rel: rng.pick(REL) });
      deeds.push({ id: dd.id, delta, year, text });
    }
    deeds.sort((a, b) => a.year - b.year);
    return deeds;
  }

  function rollEvents(ctx, man, y0, y1) {
    const rng = ctx.rng;
    const n = rng.weighted([{ n: 0, w: 30 }, { n: 1, w: 35 }, { n: 2, w: 25 }, { n: 3, w: 10 }], (x) => x.w).n;
    const events = [];
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const pool = EVENTS.filter((e) => !used.has(e.id) && (!e.coast || ctx.region.setting === 'coast'));
      const e = rng.weighted(pool, (x) => x.w);
      used.add(e.id);
      events.push({ id: e.id, year: rng.int(y0, Math.max(y0, y1)), multM: e.mM, multL: e.mL, text: e.text({ farm: ctx.farm }) });
    }
    return events.sort((a, b) => a.year - b.year);
  }

  /* ---------- one generation ---------- */
  function buildGeneration(ctx, gi, man, heir, headStart, L, M, namesakes) {
    const rng = ctx.rng;
    const deathYear = man.deathYear;
    if (headStart >= deathYear) return null;
    const marriages = buildMarriages(ctx, man, heir, deathYear, tierOf(L + M));
    if (!marriages) return null;
    const children = buildChildren(ctx, man, marriages, heir, deathYear, namesakes);

    const dowries = marriages.reduce((s, m) => s + m.dowry, 0);
    const rating = rng.clampedNormal(50, 18, 5, 95); // Industry
    const yrs = Math.max(5, deathYear - headStart);
    const growth = Math.pow(0.7 + (rating / 100) * 0.8, yrs / 25);
    const savings = Math.max(0, rng.normal(30, 20)) * yrs * (rating / 50);
    let Mend = (M + dowries) * growth + savings;
    let Lend = L;
    const events = rollEvents(ctx, man, headStart, deathYear);
    for (const e of events) { Mend *= e.multM; Lend *= e.multL; }

    const deeds = rollDeeds(ctx, man, deathYear);
    const honor = clamp(rng.clampedNormal(45, 12, 10, 85) + deeds.reduce((s, d) => s + d.delta, 0), 3, 97);
    man.attrs.honor = honor;

    // Death
    const deathAge = deathYear - man.birthYear;
    const cause = R.deathCause(rng, deathAge, 'M');
    man.deathCause = cause.id;
    let killer = null, avenged = null;
    if (cause.id === 'killed') {
      const fam = newFamily(ctx, 'killer');
      killer = { label: famLabel(fam), farm: fam.farm };
      avenged = !rng.chance(0.55);
      if (avenged) {
        const comp = round10(rng.int(300, 900));
        Mend += comp;
        killer.compensation = comp;
      } else {
        makeHook(ctx, 'unavenged_killing', gi, deathYear, { victimId: man.id, victimName: man.first, killerLabel: killer.label, farm: killer.farm, label: killer.label });
      }
    }

    // Other legacy hooks
    if (rng.chance(0.33)) {
      const type = rng.pick(RANDOM_HOOKS);
      makeHook(ctx, type, gi, rng.int(headStart, deathYear), type === 'grudging_goði' ? { tierHint: rng.int(4, 5) } : {});
    }

    // Division of the estate at death
    const alive = children.filter((c) => aliveAt(c, deathYear));
    const sons = alive.filter((c) => c.sex === 'M' && c !== heir);
    const daughters = alive.filter((c) => c.sex === 'F');
    const lastM = marriages[marriages.length - 1];
    const widow = lastM.endReason === 'husband died' && aliveAt(lastM.wife, deathYear) ? lastM.wife : null;
    const reserve = widow ? 0.15 : 0;
    Mend = round10(Mend); Lend = round100(Lend);
    const pool = Mend * (1 - reserve);
    const W = 1.5 + sons.length + daughters.length * 0.5;
    let heirM = (pool * 1.5) / W + reserve * Mend * 0.5;
    let heirL = Lend, split = false;
    if (Lend >= 9000 && sons.length > 0 && rng.chance(0.25)) { heirL = round100(Lend * 0.6); split = true; }
    heirM = round10(heirM);

    return {
      gi, man, heir, headStart, marriages, children, deeds, events, rating,
      honor: Math.round(honor), cause, killer, avenged, widowId: widow ? widow.id : null,
      estate: { L, M, Lend, Mend, heirL, heirM, split, heirs: { sons: sons.length, daughters: daughters.length } },
    };
  }

  /* ---------- prologue text ---------- */
  function buildPrologue(ctx, gens, men, startYear, gaps, arrivals) {
    const R_ = ctx.region;
    const full = (p) => N.fullName(p);
    const nth = ['great-grandfather', 'grandfather', 'father'];
    const out = [];
    gens.forEach((g, i) => {
      const man = g.man;
      const lines = [];
      const age = man.deathYear - man.birthYear;
      if (i === 0) {
        if (arrivals.immigrant) {
          lines.push(`${full(man)} was born in ${arrivals.origin.text} around the year ${man.birthYear}. He crossed the sea to Iceland in about ${arrivals.arrival} and took land at ${ctx.farm} in ${R_.valley}, in the ${R_.quarter} Quarter.`);
        } else {
          lines.push(`${full(man)} was born in Iceland in ${man.birthYear}, the son of a land-taker, and held the farm at ${ctx.farm} in ${R_.valley}, in the ${R_.quarter} Quarter.`);
        }
      } else {
        lines.push(`${full(man)} (${man.birthYear}–${man.deathYear}) held ${ctx.farm} after his father.`);
      }
      if (man.traits.length) {
        const fl = man.traits.map((t) => T.flavor('M', t));
        lines.push(`He ${fl.length > 1 ? fl[0] + ', and ' + fl[1] : fl[0]}.`);
      }
      const PARTED = [
        (m) => `They parted in ${m.endY}, and her kin did not forget it.`,
        (m) => `The marriage ended in ${m.endY} with the formula spoken before witnesses, and bitterness on both sides.`,
        (m) => `In ${m.endY} she went home to ${m.kinFarm}, and the settlement of the dowry was a long business.`,
        (m) => `They were divorced in ${m.endY}; her brothers spoke of it at the Thing.`,
      ];
      const chron = [];
      g.marriages.forEach((m) => {
        let s = `He married ${full(m.wife)}, of ${m.kinFarm}, in ${m.startY}.`;
        const fl = m.wife.traits.length && ctx.rng.chance(0.75) ? T.flavor('F', ctx.rng.pick(m.wife.traits)) : null;
        if (fl) s += ` She ${fl}.`;
        chron.push({ y: m.startY, t: s, order: 1 });
        if (m.endReason === 'wife died') {
          const c = R.deathCause(ctx.rng, m.endY - m.wife.birthYear, 'F');
          m.wife.deathCause = c.id;
          chron.push({ y: m.endY, t: `${m.wife.first} ${c.text} in ${m.endY}.`, order: 0 });
        } else if (m.endReason === 'divorce') {
          chron.push({ y: m.endY, t: ctx.rng.pick(PARTED)(m), order: 0 });
        }
      });
      for (const d of g.deeds) chron.push({ y: d.year, t: `In ${d.year}: ${d.text}`, order: 2 });
      for (const e of g.events) chron.push({ y: e.year, t: `In ${e.year}: ${e.text}`, order: 2 });
      chron.sort((a, b) => a.y - b.y || a.order - b.order);
      chron.forEach((c) => lines.push(c.t));
      const lived = g.children.filter((c) => aliveAt(c, man.deathYear) || c.deathYear - c.birthYear >= 16).length;
      lines.push(`Of his ${g.children.length} children, ${lived} lived to be grown. ${g.heir.first} was the son who took the farm.`);
      let death = `He ${g.cause.text} in ${man.deathYear}, aged ${age}.`;
      if (g.cause.id === 'killed' && g.killer) {
        death = `He was killed in ${man.deathYear}, aged ${age}, by ${g.killer.label}.`;
        death += g.avenged ? ` Blood-money of ${g.killer.compensation} ells was paid.` : ` The killing was not avenged.`;
      }
      lines.push(death);
      if (g.widowId) lines.push(`His widow, ${g.marriages[g.marriages.length - 1].wife.first}, outlived him.`);
      out.push({ title: `${nth[i].charAt(0).toUpperCase() + nth[i].slice(1)}: ${full(man)}`, role: nth[i], lines });
    });
    return out;
  }

  /* ---------- main ---------- */
  function tryGenerate(rng, seed, opts) {
    const nextId = P.makeIdGen('p');
    const ctx = { rng, nextId, families: {}, hooks: [], region: null, farm: null };
    const Y = opts.startYear || rng.int(960, 985);
    const playerAge = rng.int(19, 34);
    const gaps = [0, 1, 2].map(() => rng.clampedNormal(28, 5, 19, 40));
    const b = { player: Y - playerAge };
    b.father = b.player - gaps[0];
    b.grandfather = b.father - gaps[1];
    b.great = b.grandfather - gaps[2];
    if (b.great < 835 || b.great > 882) return null;

    ctx.region = N.region(rng);
    ctx.farm = N.farmName(rng);
    ctx.families[ctx.farm] = { farm: ctx.farm, head: null, tier: 3, roles: ['home'], goði: false };

    const d = { father: Y - rng.int(0, 1) };
    d.grandfather = sampleDeath(rng, b.grandfather, gaps[1], b.father + 16, d.father - 1);
    if (d.grandfather == null) return null;
    d.great = sampleDeath(rng, b.great, gaps[2], b.grandfather + 16, d.grandfather - 1);
    if (d.great == null) return null;

    const gg0 = N.male(rng); // great-grandfather's own father, only a name
    const nm = { great: N.male(rng) };
    nm.grandfather = rng.chance(0.35) ? gg0 : N.male(rng);
    nm.father = rng.chance(0.35) && d.great < b.father ? nm.great : N.male(rng);
    nm.player = rng.chance(0.35) && d.grandfather < b.player ? nm.grandfather : N.male(rng);

    const men = {};
    men.great = P.make(rng, nextId, { sex: 'M', birthYear: b.great, name: nm.great, father: gg0, role: 'husband' });
    men.grandfather = P.make(rng, nextId, { sex: 'M', birthYear: b.grandfather, name: nm.grandfather, father: men.great, role: 'husband', parentTraits: men.great.traits });
    men.father = P.make(rng, nextId, { sex: 'M', birthYear: b.father, name: nm.father, father: men.grandfather, role: 'husband', parentTraits: men.grandfather.traits });
    men.player = P.make(rng, nextId, { sex: 'M', birthYear: b.player, name: nm.player, father: men.father, role: 'husband', parentTraits: men.father.traits });
    for (const k of ['great', 'grandfather', 'father', 'player']) P.assignByname(rng, men[k]);
    men.great.deathYear = d.great; men.grandfather.deathYear = d.grandfather; men.father.deathYear = d.father;

    const immigrant = b.great <= 873;
    const arrivals = {
      immigrant,
      origin: N.origin(rng),
      arrival: immigrant ? Math.max(872, b.great + rng.int(20, 36)) : b.great + 20,
    };
    let headStart = arrivals.arrival;
    if (headStart >= d.great) return null;

    const W0 = clamp(round100(rng.lognormal(7000, 0.6)), 2500, 25000);
    let L = round100(W0 * 0.55), M = W0 - L;
    const chain = [['great', 'grandfather'], ['grandfather', 'father'], ['father', 'player']];
    const namesakes = [{ name: gg0, deathYear: 0 }];
    const gens = [];
    for (let gi = 0; gi < 3; gi++) {
      const man = men[chain[gi][0]], heir = men[chain[gi][1]];
      const g = buildGeneration(ctx, gi, man, heir, headStart, L, M, namesakes);
      if (!g) return null;
      gens.push(g);
      L = g.estate.heirL; M = g.estate.heirM; headStart = man.deathYear;
      namesakes.push({ name: man, deathYear: man.deathYear });
    }

    // Hooks fade with time: older ones are less likely to still matter.
    const keep = [0.3, 0.6, 1];
    const hooks = ctx.hooks.filter((h) => rng.chance(keep[h.gen]));

    // Starting Honor: ancestors' standing, mostly the father's, plus the player's own base.
    const inherited = 0.2 * gens[0].honor + 0.3 * gens[1].honor + 0.5 * gens[2].honor;
    const personal = rng.clampedNormal(45, 12, 10, 85);
    const unavenged = hooks.filter((h) => h.type === 'unavenged_killing').length;
    const blend = 0.6 * inherited + 0.4 * personal;
    const startHonor = clamp(Math.round(45 + 1.4 * (blend - 45) - 2 * unavenged), 8, 90);
    men.player.attrs.honor = startHonor;
    P.refresh(men.player, Y);

    const prologue = buildPrologue(ctx, gens, men, Y, gaps, arrivals);

    return {
      version: 1, seed, startYear: Y,
      region: Object.assign({}, ctx.region, { farm: ctx.farm }),
      timeline: { births: b, deaths: d, playerAge },
      arrivals, generations: gens, hooks, families: ctx.families,
      player: men.player, men,
      inheritance: { land: L, movable: M, honor: startHonor, wealth: L + M },
      prologue,
    };
  }

  IS.Ancestry = {
    TIER_WEALTH, tierOf, famLabel, aliveAt, newFamily, makeHook, DEEDS, EVENTS,
    generate(seed, opts) {
      opts = opts || {};
      const root = new IS.RNG(seed);
      for (let attempt = 0; attempt < 300; attempt++) {
        const rng = root.fork('ancestry/' + attempt);
        const res = tryGenerate(rng, String(seed), opts);
        if (res) { res.attempts = attempt + 1; return res; }
      }
      throw new Error('Could not generate an ancestry for seed ' + seed);
    },
  };
})();
