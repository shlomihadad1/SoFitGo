const path=require('path'),ROOT=process.argv[2];
for (const f of ['src/js/figure.js','src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js','src/data/recipes_intl.js', 'src/data/recipes_med.js','src/data/catalog.js','src/data/programs.js','src/js/logic.js','src/js/planner.js']) require(path.join(ROOT,f));
const {PROGRAMS:PG,Planner:P}=globalThis; const NOW='2026-10-19';
const sets=d=>d.main.reduce((s,x)=>s+x.sets,0); let ramped=0,recovered=0,stillLowAtPhaseEnd=0,examples=[];
for (const t of PG.TEMPLATES.filter(t=>!t.classic&&!(t.needsLibrary||[]).length)) for (const level of ['beginner','intermediate','advanced']) for (const goal of t.goals) for (const spw of [3,5]) {
 const r=P.build(t.id,{start:NOW,days:t.custom?90:t.days,profile:{level,days:[0,1,2,3,4,5,6],spw,maxMin:45,equipment:[]},goal});
 r.days.forEach((d,i)=>{ if(!d.ramped)return; ramped++; const nx=r.days.slice(i+1).filter(x=>x.type===d.type&&!x.deload&&x.phase.idx===d.phase.idx);
  const anyR=nx.find(x=>!x.ramped); if(anyR) recovered++; else { stillLowAtPhaseEnd++; if(examples.length<3) examples.push(`${t.id}/${level}/${goal}/${spw} d${d.n} ${d.phase.k} next same-type in phase: ${nx.length}, all ramped`);} });
}
console.log(JSON.stringify({ramped,recoveredWithinPhase:recovered,neverFullyRecoveredInPhase:stillLowAtPhaseEnd,examples}));
