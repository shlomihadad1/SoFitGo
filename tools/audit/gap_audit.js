/* Read-only audit of RC1 open gaps. Run: node gap_audit.js <root> */
const path=require('path'),ROOT=process.argv[2];
for (const f of ['src/js/figure.js','src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js','src/data/recipes_intl.js','src/data/catalog.js','src/data/programs.js','src/js/logic.js','src/js/planner.js','src/js/plans.js','src/js/mealplanner.js','src/js/store.js','src/js/core.js']) require(path.join(ROOT,f));
const {Store:S,Core:C,MealPlan:MP,Logic:L,NUTRI:N,CATALOG:CT,PROGRAMS:PG,Planner:P}=globalThis; const NOW='2026-10-19'; S.today=()=>NOW;
const out={};
/* 1 ramp */
const vol=d=>d.main.reduce((s,x)=>s+x.sets*(typeof x.reps==='number'?x.reps:typeof x.sec==='number'?x.sec/3:1),0);
let pairs=0,ramped=0,cutSets=0,maxCut=0,circuitJumps=[],exChange=0,exChangeRamped=0,minutesJump=0,repsPerSetJump=0,unrecovered=0,plans=0,sessions=0;
const perLevel={beginner:{s:0,r:0},intermediate:{s:0,r:0},advanced:{s:0,r:0}};
for (const t of PG.TEMPLATES.filter(t=>!t.classic&&!(t.needsLibrary||[]).length)) for (const level of ['beginner','intermediate','advanced']) for (const goal of t.goals) for (const spw of [3,5]) {
  const r=P.build(t.id,{start:NOW,days:t.custom?90:t.days,profile:{level,days:[0,1,2,3,4,5,6],spw,maxMin:45,equipment:[]},goal}); plans++;
  const unr=P.build(t.id,{start:NOW,days:t.custom?90:t.days,profile:{level,days:[0,1,2,3,4,5,6],spw,maxMin:45,equipment:[]},goal});
  const last={},lastD={}; r.days.forEach((d,i)=>{ if(!d.main||!d.main.length||['rest','active','assess'].includes(d.type)||d.deload)return; sessions++; perLevel[level].s++;
    if(d.ramped){ramped++;perLevel[level].r++;cutSets+=d.ramped;maxCut=Math.max(maxCut,d.ramped);}
    const p=lastD[d.type]; if(p){pairs++; const vr=vol(d)/vol(p);
      const same=d.main.map(x=>x.ex).join()===p.main.map(x=>x.ex).join(); if(!same){exChange++; if(d.ramped)exChangeRamped++;}
      if(vr>1.25&&!d.main.some(x=>x.sets>1&&!x.circuit)) circuitJumps.push(`${t.id}/${level}/${goal} d${d.n} ×${vr.toFixed(2)}`);
      if(d.minutes/p.minutes>1.25) minutesJump++;
      const rps=x=>x.main.filter(y=>typeof y.reps==='number').reduce((s,y)=>s+y.reps,0)/Math.max(1,x.main.filter(y=>typeof y.reps==='number').length);
      if(rps(d)/Math.max(1,rps(p))>1.25) repsPerSetJump++; }
    lastD[d.type]=d; });
}
out.ramp={plans,sessions,pairs,ramped,rampedPct:+(100*ramped/sessions).toFixed(1),cutSets,maxCutInOneSession:maxCut,pairsWithDifferentExercises:exChange,rampedWhenExercisesChanged:exChangeRamped,circuitOnlyJumpsOver25:circuitJumps.length,circuitExamples:circuitJumps.slice(0,3),minutesJumpOver25:minutesJump,avgRepsPerSetJumpOver25:repsPerSetJump,perLevel};
/* note truth: do cut sets come back? check a plan: after a ramped session, does the next same-type session in same phase have the planned (un-ramped) sets? */
/* 2 beginner sets by phase */
const b={}; for(const level of ['beginner','intermediate','advanced']){ const r=P.build('general_90',{start:NOW,profile:{level,days:[1,3,5],spw:3,maxMin:45,equipment:[]},goal:'general'}); b[level]={}; r.days.filter(d=>d.main&&!['rest','active','assess'].includes(d.type)).forEach(d=>{const k=d.phase.k+(d.deload?'(deload)':''); (b[level][k]=b[level][k]||new Set()).add(d.main.filter(x=>!x.circuit).map(x=>x.sets).join('')+'|reps'+Math.round(d.main.filter(x=>typeof x.reps==='number').reduce((s,x)=>s+x.reps,0)/Math.max(1,d.main.filter(x=>typeof x.reps==='number').length)));}); for(const k in b[level]) b[level][k]=[...b[level][k]].slice(0,6);}
out.beginnerGeneral90=b;
out.templates=PG.TEMPLATES.map(t=>({id:t.id,days:t.days,needsLibrary:t.needsLibrary||[],equipLock:t.equipLock||null,classic:!!t.classic}));
/* 3 equipment */
const eqCount={}; globalThis.EXERCISES.forEach(e=>CT.exMeta(e.id).eq.forEach(q=>eqCount[q]=(eqCount[q]||0)+1)); out.exercises={total:globalThis.EXERCISES.length,byEquipment:eqCount};
const a=P.build('general_90',{start:NOW,profile:{level:'intermediate',days:[1,3,5],spw:3,maxMin:45,equipment:[]},goal:'general'}), bb=P.build('general_90',{start:NOW,profile:{level:'intermediate',days:[1,3,5],spw:3,maxMin:45,equipment:['dumbbells','bands','pullup_bar','gym']},goal:'general'});
out.equipmentChangesPlan=JSON.stringify(a.days.map(d=>d.main))!==JSON.stringify(bb.days.map(d=>d.main));
out.homeEquipChangesPlan=JSON.stringify(a.days.map(d=>d.main))!==JSON.stringify(P.build('general_90',{start:NOW,profile:{level:'intermediate',days:[1,3,5],spw:3,maxMin:45,equipment:['chair','wall','doorframe','step']},goal:'general'}).days.map(d=>d.main));
/* 4 protein */
const prot=[]; for(const w of [50,70,90,120,150,180]){const t=L.computeTargets({weight:w,height:175,age:35,sex:'m',deficit:0.2,activity:1.55}); prot.push({w,bmi:+(w/1.75/1.75).toFixed(1),kcal:t.kcal,protein:t.protein,proteinKcalPct:Math.round(100*t.protein*4/t.kcal),carbs:t.carbs});}
out.protein=prot;
/* 5 nutrition */
const run=(o,pf,days=90)=>{S.resetAll();const p=S.load('profile');Object.assign(p,o);p.aims={primary:o.goal,secondary:[]};p.prefs=C.normPrefs(pf);S.save('profile');const prm=MP.currentParams(),g=MP.generate(prm,NOW,days,'audit');
 const ks=[],ps=[];let slotsEmpty=0,bfEmpty=0; g.days.forEach(x=>{if(x.totals){ks.push(x.totals.k/prm.kcal);ps.push(x.totals.p);} (x.meals||[]).forEach(m=>{if(!m.recipe&&!m.r&&!m.id)slotsEmpty++;});});
 const avg=a=>a.reduce((s,v)=>s+v,0)/a.length; return {kcal:prm.kcal,protein:prm.protein,avgKcalPct:+(100*avg(ks)).toFixed(1),minKcalPct:+(100*Math.min(...ks)).toFixed(1),avgProtein:+avg(ps).toFixed(1),minProtein:+Math.min(...ps).toFixed(1),days:g.days.length,sampleKeys:Object.keys(g.days[0]||{}),mealKeys:Object.keys(((g.days[0]||{}).meals||[])[0]||{})};};
const P3700={age:22,height:195,weight:105,sex:'m',goal:'muscle'}, V={age:30,height:178,weight:72,sex:'m',goal:'maintain',activity:'sedentary'};
out.nutrition={omni3700:run(P3700,{}),vegan3700:run(P3700,{vegan:true,exclude:['soya','peanuts']}),vegan2500ish:run(V,{vegan:true,exclude:['soya','peanuts']}),veganMaint:run({age:30,height:175,weight:72,sex:'m',goal:'maintain'},{vegan:true,exclude:['soya','peanuts']})};
/* restriction kinds */
out.restrictionKinds=Object.keys(C).filter(k=>/kind|restrict|allerg/i.test(k));
out.recipes=N.RECIPES.length; out.foods=Object.keys(N.FOODS).length;
const tiers={}; Object.values(N.FOODS).forEach(f=>{const k=f.src||f.source||'none';tiers[k]=(tiers[k]||0)+1}); out.foodSourceField=tiers;
console.log(JSON.stringify(out,null,1));
