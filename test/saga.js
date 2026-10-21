/* The story layer: chronicle, ambitions, warnings and the saga at the end. Prints one saga in full. */
const IS = require('./load.js'); const E = IS.Economy;
const N = +process.argv[2] || 60;
const cnt = {}, ratings = {}, amb = { done: 0, games: 0 }; let bad = 0, shown = false, scores = [];
for (let i = 0; i < N; i++) {
  const s = IS.Game.newGame('sg' + i); amb.games++;
  if (!s.ambition) { console.log('no ambition at start'); process.exit(1); }
  cnt['start:' + s.ambition.id] = (cnt['start:' + s.ambition.id] || 0) + 1;
  for (let t = 0; t < 140 && s.mode !== 'over'; t++) {
    IS.Turn.resolve(s, E.suggest(s));
    let g = 0;
    while (s.mode === 'incident' && g++ < 25) {
      const d = IS.Household.describe(s), id = d && d.id;
      if (/^(warn_|ambition_)/.test(id)) {
        cnt[id] = (cnt[id] || 0) + 1;
        if (/undefined|NaN|\[object/.test(JSON.stringify(d))) { bad++; console.log('BAD', JSON.stringify(d).slice(0, 400)); }
        const ok = (d.options || []).filter((o) => !o.disabled).map((o) => o.id);
        IS.Household.choose(s, ok[t % Math.max(1, ok.length - 1)] || ok[0]);
      } else IS.Household.autoChoose(s, 0.5);
    }
    IS.Turn.proceed(s);
  }
  amb.done += (s.sagaStats && s.sagaStats.ambitions) || 0;
  const saga = IS.Saga.write(s);
  ratings[saga.rating] = (ratings[saga.rating] || 0) + 1; scores.push(saga.score);
  const txt = JSON.stringify(saga);
  if (/undefined|NaN|\[object|null/.test(txt)) { bad++; console.log('BAD SAGA', txt.slice(0, 600)); }
  if (!shown && saga.chapters.length >= 2) {
    shown = true;
    console.log('\n' + saga.title + ' — ' + saga.rating + ' (' + saga.score + ')\n');
    for (const ch of saga.chapters) console.log(ch.lines.join(' ') + '\n');
  }
}
scores.sort((a, b) => a - b);
console.log(cnt, '\nambitions fulfilled per game', (amb.done / amb.games).toFixed(2), '\nratings', ratings, 'score p10/p50/p90', scores[Math.floor(N * 0.1)], scores[Math.floor(N / 2)], scores[Math.floor(N * 0.9)], 'bad', bad);
if (bad) process.exit(1);
