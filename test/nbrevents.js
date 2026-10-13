const IS=require('./load.js');const E=IS.Economy;
const c={};let turns=0;
for(let i=0;i<60;i++){const s=IS.Game.newGame('nz'+i);
 for(let t=0;t<100&&s.mode!=='over';t++){IS.Turn.resolve(s,E.suggest(s));turns++;
  for(const p of s.pending)if(/^nbr_/.test(p.id))c[p.id]=(c[p.id]||0)+1;
  let g=0;while(s.mode==='incident'&&g++<20){const d=IS.Household.describe(s);const id=d&&d.id;if(/^nbr_/.test(id)){if(/undefined|NaN|\[object/.test(JSON.stringify(d))){console.log('BAD',JSON.stringify(d).slice(0,400));process.exit(1);}const o=d.options||[];const pick=o.find(x=>x.id==='ride')||o[0];IS.Household.choose(s,(g%2?'ride':'law'));}else IS.Household.autoChoose(s,0.5);}IS.Turn.proceed(s);}}
console.log(turns,c);
