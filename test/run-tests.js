/* Headless tests + balance report for the ancestry/start generator.
 * Usage: node test/run-tests.js [count]     (default 1000 seeds) */
'use strict';
const IS = require('./load.js');
const N = +process.argv[2] || 1000;
let failures = 0;
const fail = (seed, msg) => { failures++; if (failures <= 15) console.log('FAIL', seed, msg); };

function pct(arr, p) { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; }
function summary(label, arr) {
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  console.log(label.padEnd(26), 'min', pct(arr, 0), ' p10', pct(arr, 0.1), ' p50', pct(arr, 0.5), ' p90', pct(arr, 0.9), ' max', pct(arr, 0.9999), ' mean', mean.toFixed(1));
}
function count(label, items) {
  const m = {}; items.forEach((i) => { m[i] = (m[i] || 0) + 1; });
  console.log(label.padEnd(26), Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${(100 * v / items.length).toFixed(0)}%`).join('  '));
}

// ---- unit checks on rules
(function rules() {
  const R = IS.Rules;
  const eq = (a, b, m) => { if (a !== b) fail('rules', `${m}: got ${a}, want ${b}`); };
  eq(R.strengthLoss(40), 0, 'no loss at 40');
  eq(R.strengthLoss(41) > 0, true, 'loss begins after 40');
  eq(R.naturalDeathHazard(54), 0, 'no natural death before 55');
  eq(R.naturalDeathHazard(56) > R.naturalDeathHazard(55), true, 'hazard rises after 55');
  eq(R.naturalDeathHazard(80) > R.naturalDeathHazard(65), true, 'hazard keeps rising');
  eq(R.effectiveLaw(40, [60, 30]), 50, 'counsel averages when wife is better');
  eq(R.effectiveLaw(70, [60]), 70, 'counsel never lowers Law');
  eq(R.effectiveLaw(40, []), 40, 'no counsel');
  eq(R.beautyAtAge(80, 25), 80, 'beauty holds to 30');
  eq(R.beautyAtAge(80, 60) < 80, true, 'beauty fades');
})();

const stats = { wealth: [], honor: [], startYear: [], headAge: [], attempts: [], wives: [], marriagesAnc: [], servants: [], thralls: [], children: [], cattle: [], siblings: [] };
const tiers = [], hookTypes = [], wifeTraits = [], headTraits = [], tenures = [], married = [];
const t0 = Date.now();

for (let i = 0; i < N; i++) {
  const seed = 'test-' + i;
  let s;
  try { s = IS.Game.newGame(seed); } catch (e) { fail(seed, 'threw: ' + e.message); continue; }
  const s2 = IS.Game.newGame(seed);
  if (JSON.stringify(s) !== JSON.stringify(s2)) fail(seed, 'not deterministic');
  try { JSON.parse(JSON.stringify(s)); } catch (e) { fail(seed, 'not serialisable'); }

  const a = s.ancestry, Y = s.startYear, head = IS.Game.head(s);
  if (Y < 960 || Y > 985) fail(seed, 'start year ' + Y);
  const g = a.generations;
  if (!(g[0].birthYear < g[1].birthYear && g[1].birthYear < g[2].birthYear && g[2].birthYear < head.birthYear)) fail(seed, 'births not ascending');
  if (!(g[0].deathYear < g[1].deathYear && g[1].deathYear < g[2].deathYear && g[2].deathYear <= Y)) fail(seed, 'deaths not ascending');
  if (g[0].birthYear < 835) fail(seed, 'great-grandfather born before 835');
  for (const p of Object.values(s.people)) {
    for (const [k, v] of Object.entries(p.attrs)) if (!Number.isFinite(v) || v < 1 || v > 100) fail(seed, `attr ${k}=${v} on ${p.first}`);
    if (p.birthYear > Y) fail(seed, 'person born in the future');
  }
  if (!(head.attrs.honor >= 8 && head.attrs.honor <= 90)) fail(seed, 'honor ' + head.attrs.honor);
  if (!Number.isFinite(s.farm.wealth) || s.farm.wealth <= 0) fail(seed, 'wealth ' + s.farm.wealth);
  if (s.household.wives.length && s.household.thralls.length > (1 + s.household.wives.length + s.household.servants.length + s.household.kin.length) * 1.2 + 1) fail(seed, 'too many thralls');
  const headAge = Y - head.birthYear;
  if (headAge < 19 || headAge > 34) fail(seed, 'head age ' + headAge);

  stats.wealth.push(s.farm.wealth); stats.honor.push(head.attrs.honor); stats.startYear.push(Y); stats.headAge.push(headAge);
  stats.wives.push(s.household.wives.length); stats.servants.push(s.household.servants.length); stats.thralls.push(s.household.thralls.length);
  stats.children.push(s.household.children.length); stats.cattle.push(s.farm.cattle);
  stats.siblings.push(s.household.kin.length);
  tiers.push(s.farm.tier); tenures.push(s.farm.tenure); married.push(s.married ? 'married' : 'unmarried');
  s.hooks.forEach((h) => hookTypes.push(h.type));
  s.household.wives.forEach((id) => s.people[id].traits.forEach((t) => wifeTraits.push(t)));
  head.traits.forEach((t) => headTraits.push(t));
  stats.marriagesAnc.push(g.reduce((n, x) => n + x.marriages.length, 0));
}

console.log(`\nGenerated ${N} starts in ${Date.now() - t0} ms\n`);
summary('start wealth (ells)', stats.wealth);
summary('start Honor', stats.honor);
summary('start year', stats.startYear);
summary('head age', stats.headAge);
summary('cattle', stats.cattle);
summary('servants', stats.servants);
summary('thralls', stats.thralls);
summary('living children', stats.children);
summary('kin in household', stats.siblings);
summary('ancestral marriages (3 gens)', stats.marriagesAnc);
count('farm tier', tiers);
count('tenure', tenures);
count('marital status', married);
count('legacy hook types', hookTypes);
count('wife traits', wifeTraits);
count('head traits', headTraits);
console.log(`\n${failures ? failures + ' FAILURES' : 'All checks passed'}`);
process.exit(failures ? 1 : 0);
