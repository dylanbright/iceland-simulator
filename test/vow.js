/* Raid vengeance: a head killed on a raid may leave a vow for his successor. */
'use strict';
const IS = require('./load.js');
const E = IS.Economy;
let offered = 0, died = 0, sworn = 0, avenged = 0, games = 0, bad = 0;
for (let i = 0; i < 400; i++) {
  const s = IS.Game.newGame('vow-' + i); games++;
  s.farm.vadmal = 5000; s.farm.silver = 100;
  for (let t = 0; t < 80 && s.mode !== 'over'; t++) {
    const plan = E.suggest(s);
    if (IS.Raid.canRaid(s) && s.vow && s.vow.status === 'sworn') plan.raid = { dest: s.vow.dest, deputyId: IS.Raid.deputies(s)[0].id };
    else if (IS.Raid.canRaid(s) && !s.vow && i % 2 === 0) plan.raid = { dest: 'ireland', deputyId: IS.Raid.deputies(s)[0].id };
    const hv = s.vow && s.vow.status;
    const rep = IS.Turn.resolve(s, plan);
    if ((rep.raid || []).some((l) => /fell in/.test(l))) died++;
    if ((rep.raid || []).some((l) => /is avenged/.test(l))) avenged++;
    let guard = 0;
    while (s.mode === 'incident' && guard++ < 20) {
      const d = IS.Household.describe(s);
      if (d && d.id === 'raid_vow') { offered++; if (/undefined|NaN|\[object/.test(JSON.stringify(d))) { bad++; console.log('BAD TEXT', JSON.stringify(d).slice(0, 300)); } const r = IS.Household.choose(s, 'raid_vow' === d.id ? (i % 3 === 0 ? 'letlie' : 'swear') : 'x'); if (i % 3 !== 0) sworn++; if (!r) bad++; }
      else IS.Household.autoChoose(s, 0.5);
    }
    IS.Turn.proceed(s);
  }
}
console.log({ games, died, offered, sworn, avenged, bad });

// a son or brother killed on a raid also leaves a vow to the (living) head
{
  let fell = 0, vows = 0, evs = 0;
  for (let i = 0; i < 600; i++) {
    const s = IS.Game.newGame('mv-' + i);
    const pool = IS.Raid.raiders(s).filter((p) => ['son', 'brother'].includes(p.role));
    if (!pool.length) continue;
    const rng = IS.Turn.rngOf(s);
    const r = IS.Raid.runMember(s, rng, { dest: 'ireland', memberId: pool[0].id, outfitted: true }, () => {});
    if (r.died) { fell++; if (s.vow) vows++; const v = IS.Raid.offerVow(s); if (v) { evs++; s.pending.push(v); const d = IS.Household.describe(s); if (/undefined|NaN/.test(JSON.stringify(d))) { console.log('BAD', JSON.stringify(d)); process.exit(1); } } }
  }
  console.log({ memberDeaths: fell, vows, offered: evs });
}
process.exit(bad ? 1 : 0);
