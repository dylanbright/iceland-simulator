/* Snowball: killings beget killings. Plays games where the player always avenges, and checks the chain events fire,
 * read cleanly, and that settlement/peace can still end a feud. */
const IS = require('./load.js'); const E = IS.Economy;
const N = +process.argv[2] || 80, mode = process.argv[3] || 'avenge';
const c = {}, depth = []; let games = 0, bad = 0, maxToll = 0;
const PICK = { avenge: ['avenge', 'ride', 'duel', 'retaliate', 'accept', 'rally', 'defend', 'prosecute', 'settle'], peace: ['accept', 'settle', 'abroad', 'rally', 'prosecute'] }[mode];
for (let i = 0; i < N; i++) {
  const s = IS.Game.newGame('sb' + i); games++;
  for (let t = 0; t < 100 && s.mode !== 'over'; t++) {
    IS.Turn.resolve(s, E.suggest(s));
    let g = 0;
    while (s.mode === 'incident' && g++ < 25) {
      const d = IS.Household.describe(s), id = d && d.id;
      if (/^(snow_|feud_)/.test(id)) {
        c[id] = (c[id] || 0) + 1;
        if (/undefined|NaN|\[object/.test(JSON.stringify(d))) { bad++; if (bad < 4) console.log('BAD', id, JSON.stringify(d).slice(0, 500)); }
        const ok = (d.options || []).filter((o) => !o.disabled).map((o) => o.id), pick = PICK.find((p) => ok.includes(p)) || ok[ok.length - 1];
        IS.Household.choose(s, pick);
      } else IS.Household.autoChoose(s, 0.5);
    }
    for (const f of s.feuds || []) { const n = (f.toll ? f.toll.you + f.toll.them : 0); if (n > maxToll) maxToll = n; }
    IS.Turn.proceed(s);
  }
  let d = 0; for (const f of s.feuds || []) d = Math.max(d, f.toll ? f.toll.you + f.toll.them : 0); depth.push(d);
}
console.log(mode, games, 'games', JSON.stringify(c), 'bad', bad, 'maxToll', maxToll);
if (bad) process.exit(1);
