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

  /* ---------- the neighbours' own natures ---------- */
  const NATURES = {
    jealous: { word: 'jealous', note: 'cannot stand a man who rises above him' },
    quarrelsome: { word: 'quarrelsome', note: 'always ready for a quarrel' },
    peaceable: { word: 'peaceable', note: 'wants a quiet life' },
    fair: { word: 'even-tempered', note: 'takes a man as he finds him' },
  };
  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; };
  /** Fixed for each house (from the game seed and the farm's name), so it needs no saved state. */
  function natureOf(state, farm) {
    const u = hash(String(state.seed) + '|' + farm);
    return u < 0.2 ? 'jealous' : u < 0.4 ? 'quarrelsome' : u < 0.6 ? 'peaceable' : 'fair';
  }
  /** Where a house's feelings settle if nothing else happens: the more honor you have, the more they like you, unless they are jealous. */
  function targetOf(state, farm, honor) {
    const n = natureOf(state, farm);
    if (n === 'jealous') return clamp(-0.9 * (honor - 30), -65, 8);
    const base = (honor - 45) * 0.5;
    return clamp(base + (n === 'peaceable' ? 6 : n === 'quarrelsome' ? -9 : 0), -30, 30);
  }
  const allHouses = (state) => Object.values(state.families || {}).filter((f) => f.head && f.farm !== state.farm.name);
  const DISTRICT = 10;
  /** The houses that make up your district: a fixed handful, plus anyone you have a history with. */
  function houses(state) {
    const all = allHouses(state);
    const core = all.slice().sort((a, b) => hash(state.seed + '|d|' + a.farm) - hash(state.seed + '|d|' + b.farm)).slice(0, DISTRICT);
    const keep = new Set(core.map((f) => f.farm));
    for (const f of all) if (!keep.has(f.farm) && (Math.abs(rel(state, f.farm)) >= 15 || get(state, f.farm))) core.push(f);
    return core;
  }

  /* ---------- how the neighbours feel about each other ---------- */
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  function baseBond(state, a, b) {
    const fa = state.families[a], fb = state.families[b];
    let v = (hash(String(state.seed) + '|bond|' + pairKey(a, b)) - 0.5) * 80;
    for (const [x, y] of [[a, b], [b, a]]) {
      const n = natureOf(state, x), gap = (state.families[y].tier || 3) - (state.families[x].tier || 3);
      if (n === 'quarrelsome') v -= 8;
      else if (n === 'peaceable') v += 7;
      else if (n === 'jealous' && gap > 0) v -= 6 * Math.min(gap, 3);
    }
    void fa; void fb;
    return clamp(v, -80, 80);
  }
  /** How house a feels about house b (the other way round is the same number: a bond is shared). */
  function bond(state, a, b) {
    if (!state.families || !state.families[a] || !state.families[b]) return 0;
    const sh = (state.bondShift && state.bondShift[pairKey(a, b)]) || 0;
    return clamp(Math.round(baseBond(state, a, b) + sh), -100, 100);
  }
  function shiftBond(state, a, b, d) {
    state.bondShift = state.bondShift || {};
    const k = pairKey(a, b);
    state.bondShift[k] = clamp((state.bondShift[k] || 0) + d, -90, 90);
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
  /** The tally of the dead. Each death is the reason for the next: the side that lost a man is owed an answer,
   *  and a house with enough dead on both sides is hard to stop. side = 'you' (a man of yours fell) or 'them'. */
  function slain(state, farm, side, n) {
    const f = ensure(state, farm);
    f.toll = f.toll || { you: 0, them: 0 };
    f.toll[side] += n || 1;
    if (IS.Saga) IS.Saga.stat(state, 'kills', n || 1);
    if (side === 'them') { state.struck = state.struck || {}; state.struck[farm] = true; }
    if (side === 'them') f.answer = (f.answer || 0) + (n || 1);
    f.truce = 0;
    const total = f.toll.you + f.toll.them;
    if (total >= 2) escalate(state, farm, 1);
    bump(state, farm, side === 'them' ? -10 : -6);
    return total;
  }
  const tollOf = (f) => (f && f.toll ? f.toll : { you: 0, them: 0 });
  /** Friends at your back (backers) against kinsmen at theirs (allies): a small edge in the fights of this feud. */
  const edge = (state, farm) => { const f = get(state, farm); return f ? clamp(0.06 * ((f.backers || 0) - (f.allies || 0)), -0.18, 0.18) : 0; };
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

  /* ---------- neighbours against each other ---------- */
  const NQ_STAGE = ['', 'bad blood', 'stock and hay raided', 'a killing'];
  function neighbourQuarrels(state, rng, rep, ctx) {
    state.nq = state.nq || {};
    state.bondShift = state.bondShift || {};
    for (const k of Object.keys(state.bondShift)) { state.bondShift[k] = r1(state.bondShift[k] * 0.97); if (Math.abs(state.bondShift[k]) < 1) delete state.bondShift[k]; }
    const hs = houses(state);
    if (hs.length < 2) return;
    // quarrels cool when nothing happens and the two have mended a little
    for (const k of Object.keys(state.nq)) {
      const q = state.nq[k];
      q.quiet++;
      if (bond(state, q.a, q.b) > -25 && q.quiet >= 6) delete state.nq[k];
      else if (q.quiet >= 14) { q.stage = Math.max(1, q.stage - 1); q.quiet = 0; if (q.stage === 1 && bond(state, q.a, q.b) > -40) delete state.nq[k]; }
    }
    // a new quarrel
    if (Object.keys(state.nq).length < 2 && rng.chance(0.07)) {
      const pairs = [];
      for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
        const b = bond(state, hs[i].farm, hs[j].farm);
        if (b <= -36 && !state.nq[pairKey(hs[i].farm, hs[j].farm)]) pairs.push({ a: hs[i].farm, b: hs[j].farm, w: -b - 25 });
      }
      if (pairs.length) { const p = rng.weighted(pairs, (x) => x.w); state.nq[pairKey(p.a, p.b)] = { a: p.a, b: p.b, stage: 1, quiet: 0, turn: state.turn }; }
    }
    // an act in an existing quarrel
    const live = Object.values(state.nq);
    if (!live.length) return;
    const q = rng.pick(live);
    if (!rng.chance(0.14 + 0.04 * q.stage)) return;
    q.quiet = 0;
    // who struck whom: the more quarrelsome strikes
    const sa = natureOf(state, q.a) === 'quarrelsome' ? 1.6 : 1, sb = natureOf(state, q.b) === 'quarrelsome' ? 1.6 : 1;
    const aggr = rng.chance(sa / (sa + sb)) ? q.a : q.b, vict = aggr === q.a ? q.b : q.a;
    const ha = state.families[aggr].head.first, hv = state.families[vict].head.first;
    if (bond(state, aggr, vict) < -45 && q.stage < 3 && rng.chance(0.25)) q.stage++;
    shiftBond(state, aggr, vict, -8);
    const acts = [null,
      `${ha} of ${aggr} insulted ${hv} of ${vict} before the whole Thing.`,
      `Men of ${aggr} drove off a good part of ${hv}'s stock. ${vict} is very angry.`,
      `A man of ${vict} was killed by ${ha}'s people. ${hv} is calling for his price.`];
    const note = acts[q.stage];
    // do they ask you to take a side? friends do, and enemies of the aggressor are likelier to
    const friendlier = rel(state, vict) >= rel(state, aggr) ? vict : aggr;
    const mine = rel(state, friendlier) >= -5 ? friendlier : null;
    const pending = state.pending.some((p) => p.kind === 'event' && /^(feud_|nbr_)/.test(p.id));
    const callOnYou = mine && !pending && !state.expedition && rng.chance(clamp(0.3 + rel(state, mine) / 150 + (q.stage === 3 ? 0.2 : 0), 0.15, 0.8));
    // sometimes the matter is settled, by the Thing or by neighbours, and the quarrel ends
    if (rng.chance(0.2)) { shiftBond(state, q.a, q.b, 14); delete state.nq[pairKey(q.a, q.b)]; }
    if (callOnYou) {
      const ally = mine, foe = mine === vict ? aggr : vict;
      state.pending.push({ id: q.stage === 3 ? 'nbr_revenge' : 'nbr_help', wifeId: null, kind: 'event',
        params: { ally, allyHead: state.families[ally].head.first, foe, foeHead: state.families[foe].head.first, stage: q.stage, friend: rel(state, ally) >= 15, value: wergild(state, 'servant') } });
    } else if (rep && rep.events) rep.events.push(note);
  }

  /* ---------- the seasonal tick ---------- */
  function tick(state, rng, rep, ctx) {
    state.relations = state.relations || {}; state.feuds = state.feuds || [];
    // memory is long but not endless
    for (const k of Object.keys(state.relations)) {
      const v = state.relations[k] * 0.97;
      if (Math.abs(v) < 1) delete state.relations[k]; else state.relations[k] = r1(v);
    }
    // how the house thinks of your standing: a slow pull toward what your Honor deserves (envy turns it upside down)
    {
      const honor = state.people[state.headId].attrs.honor;
      state.knownNature = state.knownNature || {};
      for (const fam of houses(state)) {
        const cur = rel(state, fam.farm), t = targetOf(state, fam.farm, honor);
        state.relations[fam.farm] = clamp(r1(cur + (t - cur) * 0.07), -100, 100);
        if (Math.abs(state.relations[fam.farm]) >= 20 || get(state, fam.farm)) state.knownNature[fam.farm] = true;
      }
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
      if (f.truce > 0) f.truce--;
      if (rel(state, f.farm) > HOSTILE && f.quiet >= 6) {
        if (f.stage > 1) { f.stage--; f.quiet = 0; } else if (!f.owedThem && !(f.truce > 0)) end(state, f.farm);
      } else if (f.stage >= 3 && f.quiet >= 10) { f.stage--; f.quiet = 0; }
    }
    // the neighbours' own quarrels: they open between houses that dislike each other, climb, and sometimes call on you
    neighbourQuarrels(state, rng, rep, ctx);
    // houses that dislike you pick quarrels even before a feud: border claims and suits
    if (!state.pending.some((p) => p.kind === 'event' && /^(feud_|snow_|boundary|neighbor_suit)/.test(p.id)) && !state.expedition) {
      const sour = houses(state).filter((fam) => rel(state, fam.farm) <= -20 && !get(state, fam.farm));
      if (sour.length) {
        const fam = sour.slice().sort((a, b) => rel(state, a.farm) - rel(state, b.farm))[0];
        const n = natureOf(state, fam.farm);
        const p = clamp((-rel(state, fam.farm) - 15) / 250, 0, 0.3) * (n === 'quarrelsome' || n === 'jealous' ? 1.4 : n === 'peaceable' ? 0.5 : 1);
        if (rng.chance(p)) state.pending.push({ id: rng.chance(0.65) ? 'boundary' : 'neighbor_suit', wifeId: null, kind: 'event', params: { farm: fam.farm, head: fam.head.first, nwife: '' } });
      }
    }
    if (!state.feuds.length) return;
    if (state.pending.some((p) => p.kind === 'event' && /^(feud_|snow_|warn_)/.test(p.id))) return;

    // a blow that was seen coming lands now (unless the house was bound to the peace)
    const due = state.feuds.find((x) => x.warned && x.warned.due <= state.turn);
    if (due) {
      const fam0 = state.families && state.families[due.farm];
      const w = due.warned; due.warned = null;
      if (fam0 && fam0.head) {
        if (w.act === 'kin' && due.guard && rng.chance(0.55)) {
          rep.events.push(`The men of ${due.farm} came down the valley as you were warned, saw your hired men on the wall, and rode home again.`);
          due.guard = 0; return;
        }
        const item = (w.act === 'burning' ? burning : kin)(state, rng, ctx, due, fam0, fam0.head.first);
        if (item) { item.params.warned = true; item.params.guard = !!due.guard; item.params.spare = !!due.spare; state.pending.push(Object.assign({ wifeId: null, kind: 'event' }, item)); }
        due.guard = 0; due.spare = false;
      }
      return;
    }

    // killings beget killings: answers, allies, peace-meetings and broken peace
    if (chain(state, rng, ctx)) return;

    // the worst enemy is the one who acts; a house with its master away is a ripe target
    const f = state.feuds.filter((x) => !(x.truce > 0)).sort((a, b) => rel(state, a.farm) - rel(state, b.farm))[0];
    if (!f) return;
    const fam = state.families && state.families[f.farm];
    if (!fam || !fam.head) return;
    const away = state.expedition ? 1.4 : 1;
    const nat = natureOf(state, f.farm);
    const p = clamp(0.1 + (-rel(state, f.farm) - 40) / 220 + (f.stage - 1) * 0.03 + (f.allies || 0) * 0.04 - (f.backers || 0) * 0.02, 0.06, 0.5) * away * (nat === 'quarrelsome' ? 1.3 : nat === 'peaceable' ? 0.7 : 1);
    if (!rng.chance(p)) return;
    f.quiet = 0;
    const head = fam.head.first;

    // he has a suit to bring against you
    if (f.owedThem > 0 && rng.chance(0.35)) {
      // a dead man is a case for the Alþing, not a summons for damages
      const killing = tollOf(f).them > 0 && IS.Law && !(state.cases || []).some((c) => c.farm === f.farm);
      state.pending.push({ id: killing ? 'law_summons' : 'feud_summons', wifeId: null, kind: 'event', params: { farm: f.farm, head, owed: Math.round(f.owedThem) } });
      return;
    }
    let stage = f.stage;
    if (stage > 1 && rng.chance(0.3)) stage--;
    if (stage >= 5 && rel(state, f.farm) > -70) stage = 4;
    // the heaviest blows are often seen coming: a season's warning, and a chance to prepare
    if (stage >= 4 && !f.warned && rng.chance(WARN_CHANCE)) {
      const act = stage >= 5 ? 'burning' : 'kin';
      f.warned = { act, due: state.turn + 1 };
      const wives = state.household.wives.map((id) => state.people[id]).filter((p) => p && p.deathYear == null);
      const how = act === 'burning' && wives.length && rng.chance(0.5) ? 'dream' : rng.pick(['shepherd', 'kinsman', 'beggar']);
      state.pending.push({ id: 'warn_coming', wifeId: null, kind: 'event', params: { farm: f.farm, head, act, how, dreamer: how === 'dream' ? wives[0].first : '' } });
      return;
    }
    const item = ACTS[stage](state, rng, ctx, f, fam, head);
    if (item) state.pending.push(Object.assign({ wifeId: null, kind: 'event' }, item));
  }
  const WARN_CHANCE = 0.6;

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
    slain(state, farm, 'you');
    state.pending.push({ id: 'feud_kin', wifeId: null, kind: 'event', params: { farm, head, victim: victim.first, relation: victim.role, value: wergild(state, kind), how: 'skirmish' } });
    return ` ${victim.first} did not ride home.`;
  }
  /** The other side loses a man to you: they now have a claim, and will bring it. */
  function theyFall(state, rng, farm, chance) {
    if (!rng.chance(chance)) return '';
    const f = get(state, farm);
    if (f) f.owedThem += wergild(state, 'kin');
    bump(state, farm, -12);
    slain(state, farm, 'them');
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
    if (kind === 'servant') slain(state, f.farm, 'you');
    return { id: 'feud_thrall', params: { farm: f.farm, head, victim: victim.first, kind, value: wergild(state, kind) } };
  }
  function kin(state, rng, ctx, f, fam, head) {
    const victim = pickMale(state, rng, ['son', 'brother', 'servant'], 16);
    if (!victim) return thrall(state, rng, ctx, f, fam, head);
    const kind = victim.role === 'servant' ? 'servant' : victim.role === 'son' ? 'son' : 'kin';
    ctx.kill(victim, `was killed by the men of ${f.farm}`, 'killed in a feud');
    slain(state, f.farm, 'you');
    return { id: 'feud_kin', params: { farm: f.farm, head, victim: victim.first, relation: victim.role, value: wergild(state, kind) } };
  }
  function burning(state, rng, ctx, f, fam, head) {
    return { id: 'feud_burning', params: { farm: f.farm, head, force: rng.int(12, 30) + 4 * (f.allies || 0) } };
  }
  const insult = (state, rng, ctx, f, fam, head) => ({ id: rng.chance(0.5) ? 'feud_insult' : 'feud_flare', params: { farm: f.farm, head, why: f.why } });


  /** The chain itself. One step per season at most; returns true if it pushed an event. */
  function chain(state, rng, ctx) {
    const year = E().yearOf(state);
    for (const f of state.feuds.slice()) {
      const fam = state.families && state.families[f.farm];
      if (!fam || !fam.head) continue;
      const head = fam.head.first, t = tollOf(f), total = t.you + t.them;
      const nat = natureOf(state, f.farm), away = state.expedition ? 1.3 : 1;
      const hot = (nat === 'quarrelsome' ? 1.3 : nat === 'peaceable' ? 0.7 : 1);
      // 1. a truce, and the hothead who breaks it
      if (f.truce > 0) {
        if (rng.chance(0.16 * (f.hotblood || 1))) {
          const side = rng.chance(0.5) ? 'you' : 'them';
          const mine = pickMale(state, rng, ['son', 'brother', 'servant'], 16);
          if (side === 'you' && !mine) continue;
          let victim = null;
          if (side === 'them') {
            victim = pickMale(state, rng, ['son', 'brother', 'servant'], 16);
            if (!victim) continue;
            ctx.kill(victim, `was killed when the peace with ${f.farm} was broken`, 'killed in a feud');
            slain(state, f.farm, 'you');
          } else { slain(state, f.farm, 'them'); }
          f.truce = 0;
          const person = side === 'you' ? mine : victim;
          state.pending.push({ id: 'snow_broken', wifeId: null, kind: 'event', params: { farm: f.farm, head, side, hotId: side === 'you' ? mine.id : null, hotName: side === 'you' ? mine.first : '', victimName: victim ? victim.first : '', relation: person.role, value: wergild(state, 'kin'), toll: total + 1 } });
          return true;
        }
        continue;
      }
      // 2. a man of theirs fell: his kin answer
      if (f.answer > 0 && rng.chance(0.55 * hot * away)) {
        const victim = pickMale(state, rng, ['son', 'brother', 'servant'], 16);
        f.answer = Math.max(0, f.answer - 1);
        if (!victim) { escalate(state, f.farm, 1); continue; }
        const kind = victim.role === 'servant' ? 'servant' : victim.role === 'son' ? 'son' : 'kin';
        ctx.kill(victim, `was killed by the men of ${f.farm}, who were answering for their dead`, 'killed in a feud');
        slain(state, f.farm, 'you');
        state.pending.push({ id: 'snow_answer', wifeId: null, kind: 'event', params: { farm: f.farm, head, victimName: victim.first, relation: victim.role, value: wergild(state, kind), toll: tollOf(f).you + tollOf(f).them } });
        return true;
      }
      // 3. friends and kinsmen choose sides
      if (total >= 3 && (f.allies || 0) < 2 && total >= (f.allyAt || 0) + 3 && rng.chance(0.4)) {
        const mine = state.families && houses(state).filter((x) => x.farm !== f.farm && Math.abs(rel(state, x.farm)) < 55 && !get(state, x.farm));
        const cands = (mine || []).map((x) => ({ x, b: bond(state, f.farm, x.farm) })).filter((o) => o.b >= 15).sort((a, b) => b.b - a.b);
        if (cands.length) {
          const a = cands[0].x; f.allyAt = total;
          const friends = houses(state).filter((x) => x.farm !== f.farm && x.farm !== a.farm && rel(state, x.farm) >= 5).sort((p, q) => rel(state, q.farm) - rel(state, p.farm));
          const fr = friends[0] || null;
          state.pending.push({ id: 'snow_allies', wifeId: null, kind: 'event', params: { farm: f.farm, head, ally: a.farm, allyHead: a.head.first, friend: fr ? fr.farm : '', friendHead: fr ? fr.head.first : '', toll: total } });
          return true;
        }
      }
      // 4. a respected man tries to count the dead and make a peace
      if (t.you >= 1 && t.them >= 1 && total >= 2 && f.stage >= 3 && total >= (f.peaceAt || 0) + 2 && rng.chance(0.3)) {
        const mediators = houses(state).filter((x) => x.farm !== f.farm && !get(state, x.farm) && rel(state, x.farm) > -20 && (x.goði || x.tier >= 2)).sort((a, b) => b.tier - a.tier);
        if (mediators.length) {
          f.peaceAt = total;
          const m = mediators[0];
          state.pending.push({ id: 'snow_peace', wifeId: null, kind: 'event', params: { farm: f.farm, head, mediator: m.head.first, mediatorFarm: m.farm, mine: t.you, theirs: t.them, value: wergild(state, 'kin') } });
          return true;
        }
      }
    }
    return false;
  }

  const ACTS = [null,
    insult,
    (s, r, c, f, fam, h) => (r.chance(0.55) ? livestock(s, r, c, f, h) : hay(s, r, c, f, h)),
    thrall, kin, burning,
  ];

  /** Every neighbouring house, for the neighbours screen. A house's nature shows once you have seen how it feels about you. */
  function directory(state) {
    const honor = state.people[state.headId].attrs.honor;
    const known = state.knownNature || {};
    return houses(state).map((fam) => {
      const r = rel(state, fam.farm), fd = get(state, fam.farm), n = natureOf(state, fam.farm);
      const shown = !!known[fam.farm];
      let why = null;
      if (shown && n === 'jealous' && honor > 40) why = 'Your standing eats at him.';
      else if (shown && n !== 'jealous' && honor >= 65 && r > 0) why = 'He thinks well of a man of your standing.';
      else if (shown && n !== 'jealous' && honor < 30 && r < 0) why = 'He has little respect for a man of your name.';
      const hs = houses(state).filter((x) => x.farm !== fam.farm);
      const ties = hs.map((x) => ({ farm: x.farm, head: x.head.first, b: bond(state, fam.farm, x.farm) }));
      const likes = ties.filter((t) => t.b >= 25).sort((a, b) => b.b - a.b).slice(0, 2).map((t) => t.head);
      const dislikes = ties.filter((t) => t.b <= -25).sort((a, b) => a.b - b.b).slice(0, 2).map((t) => t.head + (state.nq && state.nq[pairKey(fam.farm, t.farm)] ? ' (in a quarrel)' : ''));
      return { likes, dislikes, farm: fam.farm, head: fam.head.first, tier: fam.tier, goði: !!fam.goði, rel: Math.round(r), word: word(r) || 'on neutral terms',
        feud: fd ? STAGES[fd.stage || 1] : null, owed: fd ? Math.round(fd.owedThem || 0) : 0, toll: fd && fd.toll && (fd.toll.you + fd.toll.them) ? { you: fd.toll.you, them: fd.toll.them } : null, truce: !!(fd && fd.truce > 0), nature: shown ? NATURES[n].word : null, natureNote: shown ? NATURES[n].note : null, why };
    }).sort((a, b) => a.rel - b.rel);
  }

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

  IS.Feud = { HOSTILE, STAGES, word, get, rel, bump, ensure, escalate, end, whyOf, men, fightOdds, lawChance, wergild, oddsWord, tick, summary, seed, bloodshed, theyFall, slain, tollOf, edge, natureOf, directory, NATURES, bond, shiftBond, NQ_STAGE };
})();
