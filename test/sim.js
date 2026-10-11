/* Autoplay simulation: plays many games with the household's usual plan (and with random plans),
 * checks invariants every season, and prints balance figures.
 * Usage: node test/sim.js [seedCount] [turnsPerGame] */
'use strict';
const IS = require('./load.js');
const E = IS.Economy;
const N = +process.argv[2] || 200, T = +process.argv[3] || 100;
const q = (a, p) => { a = a.slice().sort((x, y) => x - y); return a.length ? +a[Math.floor(p * (a.length - 1))].toFixed(1) : null; };

let failures = 0;
const fail = (m, i, t) => { if (failures++ < 10) console.log('FAIL seed', i, 'turn', t, m); };

function check(s, i, t) {
  const f = s.farm;
  for (const k of ['cattle', 'sheep', 'horses', 'vadmal', 'silver', 'hay', 'provisions', 'wool', 'landValue', 'condition', 'wealth'])
    if (!Number.isFinite(f[k]) || f[k] < -1e-6) fail(k + '=' + f[k], i, t);
  if (!Number.isInteger(f.cattle) || !Number.isInteger(f.sheep) || !Number.isInteger(f.silver)) fail('non-integer stock', i, t);
  const hh = s.household, all = [...hh.wives, ...(hh.concubines || []), ...hh.children, ...hh.kin, ...hh.servants, ...hh.thralls];
  if (new Set(all).size !== all.length) fail('duplicate in household', i, t);
  if (s.mode !== 'over') {
    if (all.includes(s.headId) || s.people[s.headId].deathYear != null) fail('bad head', i, t);
    for (const id of all) if (!s.people[id] || s.people[id].deathYear != null) fail('dead or missing member ' + id, i, t);
  }
  if (s.mode !== 'over' && s.mode !== 'incident' && (s.stable || []).length !== f.horses) fail('stable ' + (s.stable || []).length + ' vs horses ' + f.horses, i, t);
  const hon = s.people[s.headId].attrs.honor;
  if (!(hon >= 1 && hon <= 100)) fail('honor ' + hon, i, t);
}

const RAID = process.env.RAID || '';
const rs = { sailed: 0, loot: 0, died: 0, captives: 0, favor: 0, disasters: 0 };
const STRAT = process.env.STRAT || 'mixed';
const inc = { seasons: 0, wifeSeasons: 0, incidents: 0, byId: {}, hap: [], divorces: 0, marriages: 0, mood: {} };
function settle(s, strat) {
  let guard = 0;
  while (s.mode === 'incident' && guard++ < 20) {
    const r = IS.Household.autoChoose(s, strat);
    if (r) { inc.incidents++; inc.byId[r.incident] = (inc.byId[r.incident] || 0) + 1; }
  }
  if (s.mode === 'incident') throw new Error('stuck in incident mode');
}

// 1. invariants under suggested, random and empty plans
for (let i = 0; i < Math.min(N, 150); i++) {
  const s = IS.Game.newGame('inv-' + i), rnd = new IS.RNG('plan-' + i);
  for (let t = 0; t < 120 && s.mode !== 'over'; t++) {
    let plan = E.suggest(s);
    if (t % 3 === 1) plan = E.normalizePlan(s, { labour: { hay: rnd.int(0, 5), fish: rnd.int(0, 3), weave: rnd.int(0, 3), build: rnd.int(0, 2), craft: rnd.int(0, 2) },
      cull: { cattle: rnd.int(0, 4), sheep: rnd.int(0, 20) }, sell: { cattle: rnd.int(0, 4), sheep: rnd.int(0, 20), horses: rnd.int(0, 2) },
      buy: { hay: rnd.int(0, 40), food: rnd.int(0, 20), cattle: rnd.int(0, 3), sheep: rnd.int(0, 10), thralls: rnd.int(0, 2), servants: rnd.int(0, 2), land: rnd.int(0, 1) },
      hospitality: rnd.pick(['plain', 'open', 'lavish']), treatment: rnd.pick(['harsh', 'fair', 'kind']), seekWife: rnd.chance(0.5) });
    if (t % 3 === 2) plan = E.normalizePlan(s, {});
    if (IS.Raid.canRaid(s) && rnd.chance(0.5)) plan.raid = { dest: rnd.pick(IS.Raid.ORDER), deputyId: IS.Raid.deputies(s)[0].id };
    try { IS.Turn.resolve(s, plan); settle(s, t % 4 === 0 ? 'last' : t % 4 === 1 ? 'first' : rnd.float(0, 1)); } catch (e) { fail('throw ' + e.stack.split('\n').slice(0, 3).join(' | '), i, t); break; }
    check(s, i, t);
    IS.Turn.proceed(s);
    if (t % 17 === 0 && JSON.stringify(IS.Game.deserialize(IS.Game.serialize(s))) !== JSON.stringify(s)) fail('save round trip', i, t);
  }
}

// 2. balance with the usual plan
const o = { over: 0, ends: [], w20: [], h20: [], w40: [], h40: [], hungry: 0, turns: 0, gens: [] };
for (let i = 0; i < N; i++) {
  const s = IS.Game.newGame('sim-' + i);
  for (let t = 0; t < T && s.mode !== 'over'; t++) {
    const wivesBefore = s.household.wives.length;
    const plan0 = E.suggest(s);
    if (RAID && IS.Raid.canRaid(s) && E.cashOf(s.farm) >= IS.Raid.cost(s) + 150) plan0.raid = { dest: RAID, deputyId: IS.Raid.deputies(s)[0].id };
    const rep = IS.Turn.resolve(s, plan0);
    for (const l of rep.raid || []) {
      if (/fitted out/.test(l)) rs.sailed++;
      const m = /brought home ([\d,]+) ells/.exec(l); if (m) rs.loot += +m[1].replace(/,/g, '');
      if (/You fell in/.test(l)) rs.died++;
      if (/captive/.test(l)) rs.captives++;
      if (/in his favor/.test(l)) rs.favor++;
      if (/disaster/.test(l)) rs.disasters++;
    }
    o.turns++;
    inc.wifeSeasons += rep.honorParts ? s.household.wives.length : 0;
    for (const id of s.household.wives) { const h = s.people[id].attrs.happiness; inc.hap.push(h); const m = IS.Household.mood(h); inc.mood[m] = (inc.mood[m] || 0) + 1; }
    settle(s, STRAT === 'mixed' ? (i % 3 === 0 ? 'first' : i % 3 === 1 ? 'last' : 0.5) : STRAT === 'mid' ? 0.5 : STRAT);
    void wivesBefore;
    if (rep.honorParts.some((p) => /hungry/.test(p.why))) o.hungry++;
    if (t === 39) { o.w20.push(rep.after.wealth); o.h20.push(rep.after.honor); }
    if (t === 79) { o.w40.push(rep.after.wealth); o.h40.push(rep.after.honor); }
    check(s, i, t);
    IS.Turn.proceed(s);
  }
  if (s.mode === 'over') { o.over++; o.ends.push(Math.floor(s.turn / 2)); }
  for (const m of s.marriages) { inc.marriages++; if (m.status === 'divorced') inc.divorces++; }
  o.gens.push((s.deadHeads || []).length + 1);
}
console.log(`games ${N}, ended within ${T / 2} years: ${o.over} (year of ending p10/p50/p90 ${q(o.ends, 0.1)}/${q(o.ends, 0.5)}/${q(o.ends, 0.9)})`);
console.log(`seasons with hunger: ${(100 * o.hungry / o.turns).toFixed(1)}%`);
console.log(`wealth after 20y p10/p50/p90 ${q(o.w20, 0.1)}/${q(o.w20, 0.5)}/${q(o.w20, 0.9)}; 40y ${q(o.w40, 0.1)}/${q(o.w40, 0.5)}/${q(o.w40, 0.9)}`);
console.log(`honor after 20y p10/p50/p90 ${q(o.h20, 0.1)}/${q(o.h20, 0.5)}/${q(o.h20, 0.9)}; 40y ${q(o.h40, 0.1)}/${q(o.h40, 0.5)}/${q(o.h40, 0.9)}`);
const tot = Object.values(inc.mood).reduce((a, b) => a + b, 0) || 1;
console.log(`wife-seasons ${inc.hap.length}; incidents ${inc.incidents} (${(inc.incidents / Math.max(1, inc.hap.length)).toFixed(2)} per wife-season, about ${(inc.incidents / o.turns).toFixed(2)} per season overall)`);
console.log(`happiness p10/p50/p90 ${q(inc.hap, 0.1)}/${q(inc.hap, 0.5)}/${q(inc.hap, 0.9)}; moods ` + Object.entries(inc.mood).map(([k, v]) => k + ' ' + Math.round(100 * v / tot) + '%').join(', '));
console.log('incidents by kind: ' + Object.entries(inc.byId).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '));
console.log(`strategy ${STRAT}; marriages ${inc.marriages}, divorced ${inc.divorces}`);
if (RAID) console.log(`raids to ${RAID}: sailed ${rs.sailed}, died ${rs.died} (${(100 * rs.died / Math.max(1, rs.sailed)).toFixed(1)}%), disasters ${rs.disasters}, avg loot ${Math.round(rs.loot / Math.max(1, rs.sailed))}, captive hauls ${rs.captives}, favors ${rs.favor}`);
console.log(`generations p10/p50/p90 ${q(o.gens, 0.1)}/${q(o.gens, 0.5)}/${q(o.gens, 0.9)}`);
console.log(failures ? `${failures} FAILURES` : 'All checks passed');
process.exit(failures ? 1 : 0);
