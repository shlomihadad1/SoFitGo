/* Authoring helper: searches the structural levers (rounds, exercise selection, extras, walk length) per day. */
for (const f of ['src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js','src/js/logic.js']) require('../'+f);
const {Logic:L,PROGRAM:P,EX_BY_ID:E}=globalThis;
const sec=(d,v)=>L.durationBreakdown(d,v).total/60;
const out={};
for(const d0 of P.DAYS){ if(!d0.main.length) continue; const d=JSON.parse(JSON.stringify(d0)); const r={};
 const isWalkOnly=d.type==='recovery'&&!d.short;
 if(isWalkOnly){ d.walkOnly=true; d.walkMin={}; for(const v of ['short','std','long']){ let best=null; for(let m=3;m<=70;m++){ for(const lf of (v==='long'?[false,true]:[false])){ const dd={...d,walkMin:{...d.walkMin,[v]:m},longFlow:lf}; const t=sec(dd,v); const sc=Math.abs(t-L.VERSION_TARGET[v]); if(!best||sc<best.sc-1e-9)best={m,lf,sc,t}; }} d.walkMin[v]=best.m; if(v==='long')d.longFlow=best.lf; r[v]=best; } out[d.day]={walkOnly:true,walkMin:d.walkMin,longFlow:d.longFlow,t:{short:sec(d,'short'),std:sec(d,'std'),long:sec(d,'long')}}; continue; }
 // short
 let bs=null; for(const R of [2,3,4]) for(const rr of [30,45,60]){ const dd={...d,shortRounds:R,shortRoundRest:rr}; const t=sec(dd,'short'); const sc=Math.abs(t-15)+(R!==3?0.6:0)+Math.abs(rr-60)/600; if(!bs||sc<bs.sc)bs={R,rr,t,sc}; }
 d.shortRounds=bs.R; d.shortRoundRest=bs.rr;
 const walkIdx=d.main.findIndex(x=>x.ex==='brisk_walk'); const walkDay=walkIdx>=0;
 // std subset
 const n=d.main.length, coreIdx=d.main.map((x,i)=>E[x.ex].cat==='core'?i:-1).filter(i=>i>=0);
 let bstd=null;
 const walks=walkDay?Array.from({length:31},(_,i)=>i+5):[null];
 for(let mask=1;mask<(1<<n);mask++){ if(!(mask&1))continue; if(walkDay&&!(mask&(1<<walkIdx)))continue; const idx=[...Array(n).keys()].filter(i=>mask&(1<<i)); if(idx.length<Math.min(3,n))continue; if(coreIdx.length&&!idx.some(i=>coreIdx.includes(i)))continue;
  for(const w of walks){ const dd={...d,std:idx,walkMin:walkDay?{...(d.walkMin||{}),std:w}:undefined}; const t=sec(dd,'std'); const sc=Math.abs(t-30)-idx.length*0.05; if(!bstd||sc<bstd.sc)bstd={idx,w,t,sc}; } }
 d.std=bstd.idx; if(walkDay){d.walkMin={...(d.walkMin||{}),std:bstd.w};}
 // long
 let bl=null; const ws=walkDay?Array.from({length:56},(_,i)=>i+10):[null];
 for(let k=0;k<=d.extra.length;k++) for(const lf of [false,true]) for(const w of ws){ const dd={...d,longExtra:k,longFlow:lf,walkMin:walkDay?{...d.walkMin,long:w}:undefined}; const t=sec(dd,'long'); const sc=Math.abs(t-60)-k*0.02; if(!bl||sc<bl.sc)bl={k,lf,w,t,sc}; }
 d.longExtra=bl.k; d.longFlow=bl.lf; if(walkDay)d.walkMin.long=bl.w;
 if(walkDay){ // short for walk days stays the circuit
 }
 out[d.day]={shortRounds:d.shortRounds,shortRoundRest:d.shortRoundRest,std:d.std,longExtra:d.longExtra,longFlow:d.longFlow,walkMin:walkDay?{std:d.walkMin.std,long:d.walkMin.long}:undefined,t:{short:sec(d,'short'),std:sec(d,'std'),long:sec(d,'long')}};
}
for(const k in out){const o=out[k];console.log(k,JSON.stringify({...o,t:undefined}),'=>',Object.values(o.t).map(x=>x.toFixed(1)).join(' / '));}
require('fs').writeFileSync(__dirname+'/fit_out.json',JSON.stringify(out));
