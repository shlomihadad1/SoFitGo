/* Authoring helper v2: chooses structural levers per day so each version lands on its target.
   Levers: short = rounds (2-4) & rest between rounds; std = which main exercises (keeps the first one and ≥1 core item) & walk length;
   long = how many extension exercises, their set count (2-3), extra mobility block, walk length. Content (exercises, reps, per-set rests) is not changed. */
for (const f of ['src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js','src/js/logic.js']) require('../'+f);
const {Logic:L,PROGRAM:P,EX_BY_ID:E}=globalThis; const fs=require('fs');
const m=(d,v)=>L.durationBreakdown(d,v).total/60;
const res={};
for(const d0 of P.DAYS){ if(!d0.main.length) continue; const d=JSON.parse(JSON.stringify(d0)); const o={};
 if(d.walkOnly){ o.walkOnly=true; o.walkMin={}; o.longFlow=false;
   for(const v of ['short','std','long']){let best=null;for(let w=1;w<=80;w++)for(const lf of (v==='long'?[false,true]:[false])){const dd={...d,walkMin:{...o.walkMin,[v]:w},longFlow:lf};const g=Math.abs(m(dd,v)-L.VERSION_TARGET[v]);if(!best||g<best.g)best={w,lf,g};} o.walkMin[v]=best.w; if(v==='long')o.longFlow=best.lf;}
   res[d.day]=o; continue; }
 const walkIdx=d.main.findIndex(x=>x.ex==='brisk_walk'), walkDay=walkIdx>=0;
 // short
 let bs=null; for(const R of [2,3,4]) for(const rr of [30,45,60,75,90]){ const dd={...d,shortRounds:R,shortRoundRest:rr}; const g=Math.abs(m(dd,'short')-15)+(R===3?0:0.15); if(!bs||g<bs.g)bs={R,rr,g}; }
 o.shortRounds=bs.R; o.shortRoundRest=bs.rr;
 // std
 const n=d.main.length, core=d.main.map((x,i)=>E[x.ex].cat==='core'?i:-1).filter(i=>i>=0); let bstd=null;
 const walks=walkDay?Array.from({length:40},(_,i)=>i+3):[null];
 for(let mask=1;mask<(1<<n);mask++){ if(!(mask&1))continue; if(walkDay&&!(mask&(1<<walkIdx)))continue; const idx=[...Array(n).keys()].filter(i=>mask&(1<<i)); if(idx.length<Math.min(3,n))continue; if(core.length&&!idx.some(i=>core.includes(i)))continue;
   const variants=[null]; idx.forEach(i=>{ const it=d.main[i]; if(it.ex!=='brisk_walk'&&it.sets>=3) variants.push({[i]:it.sets-1}); });
   for(const ss of variants) for(const w of walks){ const dd={...d,std:idx,stdSets:ss||undefined,walkMin:walkDay?{std:w}:undefined}; const g=Math.abs(m(dd,'std')-30)-idx.length*0.03+(ss?0.1:0); if(!bstd||g<bstd.g)bstd={idx,ss,w,g}; } }
 o.std=bstd.idx; if(bstd.ss)o.stdSets=bstd.ss; if(walkDay)o.walkMin={std:bstd.w};
 // long
 let bl=null; const lw=walkDay?Array.from({length:70},(_,i)=>i+5):[null];
 const exWalk=!walkDay&&d.extra.some(x=>x.ex==='brisk_walk'); const ew=exWalk?Array.from({length:30},(_,i)=>i+3):[null];
 for(let k=0;k<=d.extra.length;k++) for(const es of [0,2,3,4]) for(const lf of [false,true]) for(const w of lw) for(const x of ew){ const dd={...d,longExtra:k,longExtraSets:es||undefined,longFlow:lf,longWalkMin:x||undefined,walkMin:walkDay?{std:o.walkMin.std,long:w}:undefined}; const g=Math.abs(m(dd,'long')-60)-k*0.02+(es?0.05:0); if(!bl||g<bl.g)bl={k,es,lf,w,x,g}; }
 o.longExtra=bl.k; if(bl.es)o.longExtraSets=bl.es; o.longFlow=bl.lf; if(walkDay)o.walkMin.long=bl.w; if(bl.x&&d.extra.slice(0,bl.k).some(i=>i.ex==='brisk_walk'))o.longWalkMin=bl.x;
 res[d.day]=o;
}
// write fields into day headers
let s=fs.readFileSync(__dirname+'/../src/data/workouts.js','utf8');
for(const day in res){ const o=res[day]; const re=new RegExp("\\{ day: "+day+",[^\\n]*?week: "); const f=['day: '+day];
  for(const k of ['walkOnly','std','stdSets','shortRounds','shortRoundRest','longExtra','longExtraSets','longFlow','longWalkMin','walkMin']) if(o[k]!==undefined) f.push(k+': '+JSON.stringify(o[k]).replace(/"(\w+)":/g,'$1: ').replace(/,/g,', ').replace(/\{/g,'{ ').replace(/\}/g,' }'));
  const testDay=(s.match(re)||[''])[0].includes('testDay: true')?', testDay: true':'';
  s=s.replace(re,'{ '+f.join(', ')+testDay+', week: '); }
fs.writeFileSync(__dirname+'/../src/data/workouts.js',s);
console.log(JSON.stringify(res));
