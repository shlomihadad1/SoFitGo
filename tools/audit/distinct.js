const path=require('path'),ROOT=process.argv[2];
for (const f of ['src/js/figure.js','src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js','src/data/recipes_intl.js','src/data/catalog.js','src/data/programs.js','src/js/logic.js','src/js/planner.js']) require(path.join(ROOT,f));
const {PROGRAMS:PG,Planner:P}=globalThis; let plans=0,diff=0,maxd=0,ex=[];
for (const t of PG.TEMPLATES.filter(t=>!t.classic&&!(t.needsLibrary||[]).length)) for (const level of ['beginner','intermediate','advanced']) for (const goal of t.goals) for (const spw of [3,5]) {
 const r=P.build(t.id,{start:'2026-10-19',days:t.custom?90:t.days,profile:{level,days:[0,1,2,3,4,5,6],spw,maxMin:45,equipment:[]},goal}); plans++;
 const sig=new Set(r.days.filter(d=>d.main&&d.type!=='active'&&d.type!=='rest').map(d=>d.type+':'+d.main.map(x=>x.ex+(x.reps||x.sec)+'x'+x.sets).join(',')));
 if(sig.size!==r.summary.distinctSessions){diff++;maxd=Math.max(maxd,Math.abs(sig.size-r.summary.distinctSessions)); if(ex.length<2)ex.push(`${t.id}/${level}/${goal}/${spw}: shown ${r.summary.distinctSessions}, actual ${sig.size}`);}
}
console.log(JSON.stringify({plans,summaryMismatch:diff,maxDiff:maxd,ex}));
