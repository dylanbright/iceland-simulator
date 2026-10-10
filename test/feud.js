/* Feud stress test: every neighbour starts out hating the house. Plays games and reports how feuds unfold.
 * Usage: node test/feud.js [games] [turns] [strategy: first|last|mixed]  (REL=-85 sets the starting relation) */
'use strict';
const IS = require('./load.js');
const E = IS.Economy;
const N = +process.argv[2] || 60, T = +process.argv[3] || 60, STRAT = process.argv[4] || 'mixed';
const REL = +(process.env.REL || -85);
const seen = {}, opt = {}, out = { games: 0, over: 0, headDeaths: 0, kinDeaths: 0, ended: 0, maxStage: [0, 0, 0, 0, 0, 0] };
let fails = 0;
for (let i = 0; i < N; i++) {
  const s = IS.Game.newGame('feud-' + i); out.games++;
  const rnd = new IS.RNG('fp-' + i);
  for (const f of Object.values(s.families)) if (f.head && f.farm !== s.farm.name) s.relations[f.farm] = REL;
  let peak = 0, startHead = s.headId;
  for (let t = 0; t < T && s.mode !== 'over'; t++) {
    try {
      IS.Turn.resolve(s, E.suggest(s));
      let g = 0;
      while (s.mode === 'incident' && g++ < 20) {
        const d = IS.Household.describe(s); if (!d) break;
        const strat = STRAT === 'mixed' ? rnd.float(0, 1) : STRAT;
        const r = IS.Household.autoChoose(s, strat);
        if (r) { seen[r.incident] = (seen[r.incident] || 0) + 1; const k = r.incident + ':' + r.option; opt[k] = (opt[k] || 0) + 1; }
      }
      if (s.mode === 'incident') throw new Error('stuck');
      for (const f of s.feuds) peak = Math.max(peak, f.stage);
      for (const f of s.feuds) if (!(f.stage >= 1 && f.stage <= 5) || !Number.isFinite(f.owedThem)) { fails++; console.log('bad feud', JSON.stringify(f)); }
      for (const k of ['cattle', 'sheep', 'horses', 'hay', 'provisions', 'wool', 'condition', 'vadmal']) if (!(s.farm[k] >= -1e-6)) { fails++; console.log('bad', k, s.farm[k]); }
      if (s.mode !== 'over') IS.Turn.proceed(s);
    } catch (e) { fails++; console.log('THROW', e.stack.split('\n').slice(0, 4).join(' | ')); break; }
  }
  out.maxStage[peak]++;
  if (s.mode === 'over') out.over++;
  if (s.headId !== startHead || s.mode === 'over') out.headDeaths++;
  out.ended += s.feuds.length === 0 ? 1 : 0;
}
console.log(out);
console.log('events:', Object.entries(seen).filter(([k]) => /^feud_/.test(k)).map(([k, v]) => k + ' ' + v).join(', '));
console.log('answers:', Object.entries(opt).filter(([k]) => /^feud_/.test(k)).sort().map(([k, v]) => k.replace('feud_', '') + ' ' + v).join(', '));
console.log(fails ? 'FAILURES ' + fails : 'ok');
