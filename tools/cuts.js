for (const f of ['src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js','src/js/logic.js']) require('../'+f);
const {Logic:L,PROGRAM:P}=globalThis;
for(const d of P.DAYS){ if(!L.hasVersions(d)) continue; let best=d.main.length;
 for(let n=d.main.length;n>=4;n--){ const dd={...d,core:n}; if(L.estimateMinutes(dd,'std')<=36){best=n;break;} best=n; }
 const dd={...d,core:best}; console.log(d.day, 'core',best,'/',d.main.length,'std',L.estimateMinutes(dd,'std'),'long',L.estimateMinutes(dd,'long'),'short',L.estimateMinutes(dd,'short'), 'dropped:',d.main.slice(best).map(x=>x.ex).join(','));}
