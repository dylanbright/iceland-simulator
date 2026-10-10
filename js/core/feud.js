/* Neighbours and feuds, after the pattern of Njáls saga.
 *
 * state.relations[farm]  -100..100, how that house feels about yours (kept by ctx.goodwill).
 * state.feuds[]          { farm, why, turn, stage 1..5, quiet, owedThem }
 *
 * A neighbour who has been wronged enough (relation <= HOSTILE) opens a feud, and a feud climbs a
 * ladder, one rung for each act that goes unanswered or is answered in kind:
 *   1 bad blood      threats, insults at the Thing
 *   2 open hostility  stock driven off, hay burnt
 *   3 blood shed      a thrall or servant killed
 *   4 a killing       a man of the house killed
 *   5 war             the farm attacked and burnt
 * Every rung can be answered at law (your Law score), by arbitration, by paying, or by striking back,
 * and striking back raises the stakes and brings a summons in return. Left alone, a feud cools.
 * The acts are events (data/feud-events.js); this file decides who strikes, when, and how hard.
 */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r1 = (x) => Math.round(x * 10) / 10;
  const E = () => IS.Economy;

  const HOSTILE = -50;            // a house this sour toward you opens a feud
  const STAGES = ['', 'bad blood', 'open hostility', 'blood shed', 'a killing unanswered', 'war'];

  function word(rel) {
    if (rel >= 40) return 'a good friend';
    if (rel >= 15) return 'friendly';
    if (rel > -15) return null;
    if (rel > -35) return 'cool toward you';
    if (rel > -55) return 'resentful';
    if (rel > -75) return 'hostile';
    return 'a bitter enemy';
  }

  const get = (state, farm) => (state.feuds || []).find((f) => f.farm === farm) || null;
  const rel = (state, farm) => (state.relations && state.relations[farm]) || 0;
  const bump = (state, farm, d) => { state.relations[farm] = clamp(rel(state, farm) + d, -100, 100); };

  function ensure(state, farm, why) {
    state.feuds = state.feuds || [];
    let f = get(state, farm);
    if (!f) { f = { farm, why: why || 'bad blood between the houses', turn: state.turn, stage: 1, quiet: 0, owedThem: 0 }; state.feuds.push(f); }
    if (!f.stage) f.stage = 1;
    if (f.quiet == null) f.quiet = 0;
    if (f.owedThem == null) f.owedThem = 0;
    return f;
  }
  const escalate = (state, farm, d) => {
    const f = get(state, farm); if (!f) return;
    f.stage = clamp(f.stage + d, 1, 5); f.quiet = 0;
  };
  const end = (state, farm) => { state.feuds = (state.feuds || []).filter((f) => f.farm !== farm); };

  /** What the old family history says about why a house hates yours. */
  function whyOf(state, farm) {
    const h = (state.hooks || []).find((x) => x.farm === farm && x.type !== 'debt');
    if (!h) return 'bad blood between the houses';
    if (h.type === 'unavenged_killing') return `the killing of ${h.victimName}, never avenged`;
    if (h.type === 'grudging_goði') return 'an old grudge the family never mended';
    if (h.type === 'lawsuit_pending') return `a suit over ${h.subject || 'an old quarrel'} left unsettled`;
    if (h.type === 'blood_money_due') return 'blood-money owed to your house and never paid';
    return 'bad blood between the houses';
  }

  /* ---------- what a house can muster, and what the courts will do ---------- */
  const men = (state) => (IS.Raid ? IS.Raid.raiders(state) : []);
  function fightOdds(state, bonus) {
    const head = state.people[state.headId], away = !!state.expedition;
    let p = 0.34 + (away ? 0 : (head.attrs.strength - 50) / 220) + Math.min(0.2, men(state).length * 0.05) + (bonus || 0);
    if (away) p -= 0.12;
    return clamp(p, 0.12, 0.85);
  }
  function lawChance(state, farm, base) {
    const head = state.people[state.headId], fam = state.families && state.families[farm];
    const tier = E().tierOfFarm(state.farm);
    const gap = fam ? (fam.tier - tier) * 0.03 : 0;
    return clamp((base == null ? 0.3 : base) + head.attrs.law / 220 + head.attrs.honor / 500 - gap, 0.12, 0.85);
  }
  const wergild = (state, kind) => {
    const t = E().tierOfFarm(state.farm);
    return kind === 'thrall' ? IS.Economy.C.PRICE.thrall : kind === 'servant' ? 160 + 40 * t : kind === 'son' ? 290 + 90 * t : 220 + 70 * t;
  };

  /** Odds, in words, for the option text (the player gets words, not numbers). */
  const oddsWord = (p) => (p >= 0.7 ? 'good odds' : p >= 0.5 ? 'fair odds' : p >= 0.35 ? 'poor odds' : 'long odds');

  /* ---------- the seasonal tick ---------- */
  function tick(state, rng, rep, ctx) {
    state.relations = state.relations || {}; state.feuds = state.feuds || [];
    // memory is long but not endless
    for (const k of Object.keys(state.relations)) {
      const v = state.relations[k] * 0.97;
      if (Math.abs(v) < 1) delete state.relations[k]; else state.relations[k] = r1(v);
    }
    // envy and friction: a house that has pulled far ahead is resented, one that lags is easy
    const pool = Object.values(state.families || {}).filter((f) => f.head && f.farm !== state.farm.name);
    if (pool.length && rng.chance(0.3)) {
      const n = rng.pick(pool), gap = E().tierOfFarm(state.farm) - n.tier;
      if (gap >= 2) bump(state, n.farm, -rng.int(1, 4));
      else if (gap <= -1) bump(state, n.farm, rng.int(0, 2));
    }
    // houses sour enough open a feud
    for (const [farm, v] of Object.entries(state.relations)) {
      if (v <= HOSTILE && !get(state, farm) && state.families && state.families[farm]) ensure(state, farm, whyOf(state, farm));
    }
    for (const f of state.feuds) ensure(state, f.farm, f.why);
    // feuds cool when nothing happens
    for (const f of state.feuds.slice()) {
      f.quiet++;
      if (rel(state, f.farm) > HOSTILE && f.quiet >= 6) {
        if (f.stage > 1) { f.stage--; f.quiet = 0; } else if (!f.owedThem) end(state, f.farm);
      } else if (f.stage >= 3 && f.quiet >= 10) { f.stage--; f.quiet = 0; }
    }
    if (!state.feuds.length) return;
    if (state.pending.some((p) => p.kind === 'event' && /^feud_/.test(p.id))) return;

    // the worst enemy is the one who acts; a house with its master away is a ripe target
    const f = state.feuds.slice().sort((a, b) => rel(state, a.farm) - rel(state, b.farm))[0];
    const fam = state.families && state.families[f.farm];
    if (!fam || !fam.head) return;
    const away = state.expedition ? 1.4 : 1;
    const p = clamp(0.1 + (-rel(state, f.farm) - 40) / 220 + (f.stage - 1) * 0.03, 0.06, 0.45) * away;
    if (!rng.chance(p)) return;
    f.quiet = 0;
    const head = fam.head.first;

    // he has a suit to bring against you
    if (f.owedThem > 0 && rng.chance(0.35)) {
      state.pending.push({ id: 'feud_summons', wifeId: null, kind: 'event', params: { farm: f.farm, head, owed: Math.round(f.owedThem) } });
      return;
    }
    let stage = f.stage;
    if (stage > 1 && rng.chance(0.3)) stage--;
    if (stage >= 5 && rel(state, f.farm) > -70) stage = 4;
    const item = ACTS[stage](state, rng, ctx, f, fam, head);
    if (item) state.pending.push(Object.assign({ wifeId: null, kind: 'event' }, item));
  }

  /* ---------- the acts: each builds its params and applies the damage already done ---------- */
  const pickMale = (state, rng, kinds, minAge) => {
    const year = E().yearOf(state);
    const list = [...state.household.children, ...state.household.kin, ...state.household.servants].map((id) => state.people[id])
      .filter((p) => p && p.deathYear == null && p.sex === 'M' && p.kind !== 'thrall' && year - p.birthYear >= minAge && kinds.includes(p.role));
    return list.length ? rng.pick(list) : null;
  };

  /** A confrontation turns deadly: one of your men dies, and the killing becomes its own event
   *  (blood-money, a suit at the Althing, or revenge). Returns a sentence for the result text, or ''. */
  function bloodshed(state, rng, ctx, farm, head, chance) {
    if (!rng.chance(chance)) return '';
    const victim = pickMale(state, rng, ['son', 'brother', 'servant'], 16);
    if (!victim) return '';
    const kind = victim.role === 'servant' ? 'servant' : victim.role === 'son' ? 'son' : 'kin';
    ctx.kill(victim, `was killed in the fight with the men of ${farm}`, 'killed in a feud');
    state.pending.push({ id: 'feud_kin', wifeId: null, kind: 'event', params: { farm, head, victim: victim.first, relation: victim.role, value: wergild(state, kind), how: 'skirmish' } });
    return ` ${victim.first} did not ride home.`;
  }
  /** The other side loses a man to you: they now have a claim, and will bring it. */
  function theyFall(state, rng, farm, chance) {
    if (!rng.chance(chance)) return '';
    const f = get(state, farm);
    if (f) f.owedThem += wergild(state, 'kin');
    bump(state, farm, -12);
    return ' One of their men was killed in it, and his kin will want a price for him.';
  }

  function livestock(state, rng, ctx, f, head) {
    const fm = state.farm, P = IS.Economy.C.PRICE;
    const opts = [];
    if (fm.sheep >= 6) opts.push({ k: 'sheep', w: 3 });
    if (fm.cattle >= 2) opts.push({ k: 'cattle', w: 2 });
    if (fm.horses >= 1) opts.push({ k: 'horses', w: 1.2 });
    if (!opts.length) return { id: 'feud_insult', params: { farm: f.farm, head } };
    const k = rng.weighted(opts, (o) => o.w).k;
    const n = k === 'sheep' ? Math.min(fm.sheep, rng.int(5, 12)) : k === 'cattle' ? Math.min(fm.cattle, rng.int(1, 3)) : Math.min(fm.horses, fm.horses >= 3 ? 2 : 1);
    fm[k] -= n;
    return { id: 'feud_livestock', params: { farm: f.farm, head, kind: k, n, value: n * P[k] } };
  }
  function hay(state, rng, ctx, f, head) {
    const fm = state.farm;
    if (fm.hay < 3) return livestock(state, rng, ctx, f, head);
    const lost = Math.max(1, r1(fm.hay * rng.float(0.15, 0.3)));
    fm.hay = Math.max(0, fm.hay - lost);
    return { id: 'feud_hay', params: { farm: f.farm, head, tons: lost, value: Math.round(lost * IS.Economy.C.PRICE.hay) } };
  }
  function thrall(state, rng, ctx, f, fam, head) {
    const hh = state.household;
    const th = hh.thralls.map((id) => state.people[id]).filter((p) => p && p.deathYear == null);
    let victim = th.length ? rng.pick(th) : pickMale(state, rng, ['servant'], 14);
    if (!victim) return livestock(state, rng, ctx, f, head);
    const kind = victim.kind === 'thrall' ? 'thrall' : 'servant';
    ctx.kill(victim, `was killed by the men of ${f.farm}`, 'killed in a feud');
    return { id: 'feud_thrall', params: { farm: f.farm, head, victim: victim.first, kind, value: wergild(state, kind) } };
  }
  function kin(state, rng, ctx, f, fam, head) {
    const victim = pickMale(state, rng, ['son', 'brother', 'servant'], 16);
    if (!victim) return thrall(state, rng, ctx, f, fam, head);
    const kind = victim.role === 'servant' ? 'servant' : victim.role === 'son' ? 'son' : 'kin';
    ctx.kill(victim, `was killed by the men of ${f.farm}`, 'killed in a feud');
    return { id: 'feud_kin', params: { farm: f.farm, head, victim: victim.first, relation: victim.role, value: wergild(state, kind) } };
  }
  function burning(state, rng, ctx, f, fam, head) {
    return { id: 'feud_burning', params: { farm: f.farm, head, force: rng.int(12, 30) } };
  }
  const insult = (state, rng, ctx, f, fam, head) => ({ id: rng.chance(0.5) ? 'feud_insult' : 'feud_flare', params: { farm: f.farm, head, why: f.why } });

  const ACTS = [null,
    insult,
    (s, r, c, f, fam, h) => (r.chance(0.55) ? livestock(s, r, c, f, h) : hay(s, r, c, f, h)),
    thrall, kin, burning,
  ];

  /* ---------- for the ledger ---------- */
  function summary(state) {
    const out = [];
    const seen = new Set();
    for (const f of state.feuds || []) { out.push({ farm: f.farm, word: word(rel(state, f.farm)) || 'at odds with you', feud: STAGES[f.stage || 1] }); seen.add(f.farm); }
    for (const [farm, v] of Object.entries(state.relations || {})) {
      if (seen.has(farm)) continue;
      const w = word(v);
      if (w && (v <= -25 || v >= 40)) out.push({ farm, word: w, feud: null, good: v > 0 });
    }
    return out.sort((a, b) => (a.good ? 1 : 0) - (b.good ? 1 : 0));
  }

  /** A fresh game: old family quarrels start out as bad blood. */
  function seed(state) {
    const BASE = { grudging_goði: -55, unavenged_killing: -60, lawsuit_pending: -35, blood_money_due: -30, blood_money_owed: -20, debt: -15 };
    state.relations = state.relations || {};
    for (const h of state.hooks || []) {
      if (h.farm && BASE[h.type] != null) state.relations[h.farm] = Math.min(state.relations[h.farm] || 0, BASE[h.type]);
    }
  }

  IS.Feud = { HOSTILE, STAGES, word, get, rel, bump, ensure, escalate, end, whyOf, men, fightOdds, lawChance, wergild, oddsWord, tick, summary, seed, bloodshed, theyFall };
})();
