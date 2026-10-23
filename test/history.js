/* Phase 2: dated history and household drama. Plays many lines; the Greenland test always sails. */
const IS = require('./load.js'); const E = IS.Economy;
const N = +process.argv[2] || 80;
const cnt = {}; let bad = 0, green = 0, greenAlive = 0, greenTurns = 0;
const PICK = { hist_greenland: (s, i) => (i % 2 ? 'sail' : 'stay'), son_hothead: (s, i, t) => ['back', 'pay', 'restrain', 'abroad'][t % 4], wives_quarrel: (s, i, t) => (t % 3 ? null : 'restrain') };
for (let i = 0; i < N; i++) {
  const s = IS.Game.newGame('hi' + i);
  let sailed = false;
  for (let t = 0; t < 120 && s.mode !== 'over'; t++) {
    IS.Turn.resolve(s, E.suggest(s));
    let g = 0;
    while (s.mode === 'incident' && g++ < 25) {
      const d = IS.Household.describe(s), id = d && d.id;
      if (/^(hist_|son_|wives_|inherit_|green_|ivory_)/.test(id)) {
        if (/undefined|NaN|\[object|null/.test(JSON.stringify(d.title) + JSON.stringify(d.body) + JSON.stringify(d.options))) { bad++; if (bad < 5) console.log('BAD', id, JSON.stringify(d).slice(0, 500)); }
        const ok = (d.options || []).filter((o) => !o.disabled).map((o) => o.id);
        let pick = PICK[id] ? PICK[id](s, i, t) : null;
        if (!pick || !ok.includes(pick)) pick = ok[(t + i) % ok.length];
        cnt[id + ':' + pick] = (cnt[id + ':' + pick] || 0) + 1;
        if (id === 'hist_greenland' && pick === 'sail') { sailed = true; green++; }
        IS.Household.choose(s, pick);
        if (/undefined|NaN/.test(JSON.stringify(s.report.incidents.slice(-1)))) { bad++; console.log('BAD RESULT', id, JSON.stringify(s.report.incidents.slice(-1))); }
      } else IS.Household.autoChoose(s, 0.5);
    }
    IS.Turn.proceed(s);
    if (sailed && s.mode !== 'over') greenTurns++;
  }
  if (sailed && s.mode !== 'over') greenAlive++;
  if (s.greenland) {
    if (!s.families['Brattahlíð'] || s.feuds.some((f) => !s.families[f.farm])) { bad++; console.log('BAD greenland families'); }
  }
  const saga = IS.Saga.write(s);
  if (/undefined|NaN|null/.test(JSON.stringify(saga))) { bad++; console.log('BAD SAGA', JSON.stringify(saga).slice(0, 300)); }
}
console.log(Object.entries(cnt).sort().map(([k, v]) => k + ' ' + v).join('\n'));
console.log('sailed', green, 'lines still going at the end', greenAlive, 'bad', bad);
if (bad) process.exit(1);
