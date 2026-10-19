const path=require('path'),ROOT=process.argv[2];
for (const f of ['src/js/figure.js','src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js','src/data/recipes_intl.js','src/data/catalog.js','src/data/programs.js','src/js/logic.js','src/js/planner.js']) require(path.join(ROOT,f));
const {PROGRAMS:PG,Planner:P}=globalThis; const crypto=require('crypto'); const h=crypto.createHash('sha256');
for (const t of PG.TEMPLATES.filter(t=>!t.classic&&!(t.needsLibrary||[]).length)) for (const level of ['beginner','intermediate','advanced']) for (const goal of t.goals) for (const spw of [3,5]) h.update(JSON.stringify(P.build(t.id,{start:'2026-10-19',days:t.custom?90:t.days,profile:{level,days:[0,1,2,3,4,5,6],spw,maxMin:45,equipment:[]},goal}).days));
console.log(h.digest('hex'));
