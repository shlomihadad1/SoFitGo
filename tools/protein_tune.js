/* Authoring helper: raises lean protein sources in each base recipe until it reaches the slot minimum,
   then trims carbs/oil if the slot calorie cap is exceeded. Writes new grams into src/data/nutrition.js and prints a change log. */
for (const f of ['src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js', 'src/data/recipes_intl.js','src/js/logic.js']) require('../'+f);
const fs=require('fs'); const {Logic:L,NUTRI:N}=globalThis; const F=N.FOODS;
const MIN={m1:58,m2:70,snack:27}, CAP={m1:880,m2:1000,snack:420};
const LEAN={chicken_breast:[10,320],chicken_thigh:[10,320],chicken_mince:[10,320],egg_white:[33,264],soya:[5,100],masoor:[5,120],moong:[5,120],toor:[5,120],rajma:[5,120],chana:[5,120],kala_chana:[5,120],besan:[5,110],hung_curd:[25,300],roasted_chana:[5,70],sprouts:[20,250]};
const CARB=['rice','atta','noodles','poha','oats','potato','bread','maida','sweet_potato'];
const step=f=>f==='atta'?35:f==='egg'?50:f==='egg_white'?33:(LEAN[f]||[5])[0];
let src=fs.readFileSync(__dirname+'/../src/data/nutrition.js','utf8'); const log=[];
for(const r of N.RECIPES){ if(r.est||!MIN[r.meal]) continue;
  const ing=r.ing.map(x=>({...x})); const orig=r.ing.map(x=>x.g); const added=[];
  const mac=()=>L.roundM(L.sumMacros(ing.map(L.ingMacros)));
  let guard=0;
  while(mac().p<MIN[r.meal]&&guard++<200){
    const cands=ing.map((x,i)=>({x,i})).filter(o=>LEAN[o.x.f]&&o.x.g+step(o.x.f)<=Math.min(LEAN[o.x.f][1],Math.max(orig[o.i]*1.8,orig[o.i]+step(o.x.f))));
    if(cands.length){ cands.sort((a,b)=>(F[b.x.f].p/F[b.x.f].k)-(F[a.x.f].p/F[a.x.f].k)); const c=cands[0]; c.x.g+=step(c.x.f); continue; }
    // no lean room left → add a side
    const hasEgg=ing.some(x=>x.f==='egg'); const sideF=hasEgg&&!ing.some(x=>x.f==='egg_white')?'egg_white':(!ing.some(x=>x.f==='roasted_chana')?'roasted_chana':null);
    if(!sideF) break; ing.push({f:sideF,g:sideF==='egg_white'?33:20,role:F[sideF].grp,side:true}); added.push(sideF); orig.push(sideF==='egg_white'?33:20);
  }
  guard=0;
  while(mac().k>CAP[r.meal]&&guard++<200){
    const c=ing.map((x,i)=>({x,i})).filter(o=>CARB.includes(o.x.f)&&o.x.g-step(o.x.f)>=orig[o.i]*0.6).sort((a,b)=>L.ingMacros(b.x).k-L.ingMacros(a.x).k)[0];
    if(c){ c.x.g-=step(c.x.f); continue; }
    const o=ing.find((x,i)=>x.f==='oil'&&x.g-1>=orig[i]*0.6); if(o){o.g-=1;continue;} break;
  }
  ing.forEach(x=>{ if(x.f!=='atta'&&x.f!=='egg'&&x.f!=='egg_white'&&x.f!=='oil') x.g=Math.round(x.g/5)*5; });
  const m=mac(); const changes=ing.map((x,i)=>i<r.ing.length&&x.g!==r.ing[i].g?`${x.f} ${r.ing[i].g}→${x.g}`:null).filter(Boolean).concat(added.map(a=>'+'+a+' '+ing.find(x=>x.f===a).g));
  if(!changes.length) continue;
  // write back
  const a=src.indexOf("{ id: '"+r.id+"'"); let b=src.indexOf("\n{ id:",a+5); if(b<0)b=src.indexOf("\n];",a); const n2=src.indexOf("\n/*",a); if(n2>0&&n2<b)b=n2;
  let blk=src.slice(a,b);
  ing.slice(0,r.ing.length).forEach((x,i)=>{ if(x.g!==r.ing[i].g) blk=blk.replace(new RegExp("i\\('"+x.f+"', "+r.ing[i].g+"(?=[,)])"),"i('"+x.f+"', "+x.g); });
  if(added.length){ const extra=added.map(f=>`, i('${f}', ${ing.find(x=>x.f===f).g}, null, true)`).join(''); blk=blk.replace(/ing: \[([\s\S]*?)\](,\s*steps)/, (m0,inner,rest)=>'ing: ['+inner+extra+']'+rest);
    const stepTxt=added.map(f=>f==='egg_white'?`בצד: ${ing.find(x=>x.f===f).g/33} חלבוני ביצה קשים או מוקפצים.`:`בצד: ${ing.find(x=>x.f===f).g} ג׳ חומוס קלוי.`).join(' ');
    blk=blk.replace(/steps: \[([\s\S]*?)\](,\s*subs)/,(m0,inner,rest)=>'steps: ['+inner+", '"+stepTxt+"']"+rest); }
  src=src.slice(0,a)+blk+src.slice(b);
  log.push(`${r.meal} ${r.id}: ${changes.join(', ')} → ${m.k} kcal / ${m.p} P`);
}
fs.writeFileSync(__dirname+'/../src/data/nutrition.js',src); console.log(log.join('\n'));
