/* Market test: crowded markets pay less, thralls can be sold, horses can be bought, pressure carries over. */
'use strict';
const IS = require('./load.js');
const E = IS.Economy;
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
const s = IS.Game.newGame('market-1');
s.farm.sheep = 60; s.farm.vadmal = 3000; s.farm.horses = 1;
const one = E.lot('sheep', 1, false, 1).total, ten = E.lot('sheep', 10, false, 1).total, forty = E.lot('sheep', 40, false, 1).total;
ok(ten < one * 10 && forty < ten * 4, 'selling more must average less');
ok(E.lot('horses', 4, true, 1).total > E.lot('horses', 1, true, 1).total * 4, 'buying more must cost more each');
console.log('1 sheep', one, '10', ten, '40', forty);
const h0 = s.farm.horses, th0 = s.household.thralls.length, sh0 = s.farm.sheep;
const res = E.season(s, { sell: { sheep: 30, thralls: 1 }, buy: { horses: 2 } }, { season: 'summer', weather: 1, fishLuck: 1, sev: 'normal', prices: s.env.prices, mods: {} });
ok(res.rep.sold.sheep === 30 && res.rep.bought.horses === 2, 'trade happened');
ok(res.rep.sold.thralls === Math.min(1, th0), 'thrall sale counted');
ok(res.rep.pressure.sheep === -30 && res.rep.pressure.horses === 2, 'pressure recorded');
console.log('thralls', th0, 'sold', res.rep.sold.thralls, 'pressure', JSON.stringify(res.rep.pressure));
// full turn: market memory
const s2 = IS.Game.newGame('market-2'); s2.farm.sheep = 50;
const before = s2.env.prices.sheep;
IS.Turn.resolve(s2, { sell: { sheep: 30 } });
console.log('sheep price multiplier before', before, 'next season', s2.env.prices.sheep, 'market', JSON.stringify(s2.market));
ok(s2.market && s2.market.sheep < 0, 'market remembers the glut');
console.log(bad ? 'FAILED' : 'market ok'); process.exit(bad ? 1 : 0);
