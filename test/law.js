/* Phase 3: the Alþing, outlawry and exile, and the battle screen.
 * Hostile districts (every neighbor starts bitter) so that cases, burnings and brawls come up often. */
const IS = require('./load.js'); const E = IS.Economy;
const N = +process.argv[2] || 80;
const cnt = {}; let bad = 0; const ends = {};
const add = (k) => { cnt[k] = (cnt[k] || 0) + 1; };
const pref = ['prosecute', 'file', 'answer', 'friends', 'false', 'careful', 'bold', 'backer', 'flaw', 'fight', 'press', 'leader', 'wall', 'mikligardr', 'norway', 'highlands', 'buy', 'abroad', 'hide', 'friend', 'companion', 'pardon', 'steal'];
for (let i = 0; i < N; i++) {
  const s = IS.Game.newGame('law' + i);
  for (const k of Object.keys(s.families || {})) if (s.families[k].head) s.relations[k] = -80;
  for (let t = 0; t < 120 && s.mode !== 'over'; t++) {
    if (IS.Raid.isAway(s) && s.exile) add('exile-season:' + s.exile.where);
    IS.Turn.resolve(s, E.suggest(s));
    let g = 0;
    while (s.mode === 'incident' && g++ < 40) {
      const d = IS.Household.describe(s); if (!d) break;
      const id = d.id;
      const txt = JSON.stringify([d.title, d.body, d.options, d.view]);
      if (/undefined|NaN|\[object/.test(txt)) { bad++; if (bad < 6) console.log('BAD', id, txt.slice(0, 600)); }
      const ok = (d.options || []).filter((o) => !o.disabled).map((o) => o.id);
      if (!ok.length) { console.log('NO OPTIONS', id); bad++; break; }
      let pick;
      if (/^(law_|exile_|outlaw_|battle|feud_kin|feud_burning|snow_)/.test(id)) {
        const r = (t * 7 + i * 3 + g) % 10;
        pick = r < 6 ? pref.find((p) => ok.includes(p)) : ok[r % ok.length];
        if (!pick) pick = ok[0];
        add(id + ':' + pick);
      } else { IS.Household.autoChoose(s, 0.5); continue; }
      const before = s.report.incidents ? s.report.incidents.length : 0;
      IS.Household.choose(s, pick);
      const last = (s.report.incidents || []).slice(before);
      if (/undefined|NaN|\[object/.test(JSON.stringify(last))) { bad++; if (bad < 8) console.log('BAD RESULT', id, pick, JSON.stringify(last).slice(0, 400)); }
      if (id === 'battle') { const lt = JSON.stringify(last); for (const k of ['broke and ran', 'gave it up', 'roof caught', 'peacemakers pushed', 'hunted', 'left', 'pulled your men']) if (lt.includes(k)) add('battle-end:' + k); }
    }
    IS.Turn.proceed(s);
  }
  ends[s.mode] = (ends[s.mode] || 0) + 1;
  if (s.deadHeads.some((d) => /outlaw/.test(d.cause || ''))) add('head ended as outlaw');
  const saga = IS.Saga.write(s);
  if (/undefined|NaN/.test(JSON.stringify(saga))) { bad++; console.log('BAD SAGA'); }
}
console.log(Object.entries(cnt).sort().map(([k, v]) => k + ' ' + v).join('\n'));
console.log('ends', ends, 'bad', bad);
if (bad) process.exit(1);
