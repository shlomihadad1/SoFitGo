for (const f of ['src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js','src/js/logic.js']) require('../'+f);
const {Logic:L,PROGRAM:P,NUTRI:N,EX_BY_ID:E}=globalThis;
const T=L.computeTargets({weight:85,height:187,age:32});console.log('targets',T);
let bad=0;
for(const d of P.DAYS){for(const k of ['warm','main','short','extra','cool'])(d[k]||[]).forEach(it=>{if(!E[it.ex]){console.log('missing ex',d.day,it.ex);bad++}});
 const v=d.main.length?['short','std','long'].filter(x=>x==='std'||L.hasVersions(d)).map(x=>x+':'+L.estimateMinutes(d,x)).join(' '):'rest';
 console.log(d.day,d.type,d.title,'|',v);}
console.log('---menus');
for(const r of N.RECIPES)for(const g of r.ing)if(!N.FOODS[g.f]){console.log('missing food',r.id,g.f);bad++}
N.MENU.forEach((m0,i)=>{const m=m0.concat([N.EXTRA_DAY[i]]);const ms=m.map(id=>{const r=L.recipe(id);if(!r){console.log('missing recipe',id);bad++;return{k:0,p:0,c:0,f:0,fb:0}}return L.recipeMacros(r)});const t=L.roundM(L.sumMacros(ms));
 console.log(i+1, m.map((id,j)=>id+'('+ms[j].k+'/'+ms[j].p+')').join(' + '),'=>',t.k,'kcal P',t.p,'C',t.c,'F',t.f,'fb',t.fb, (t.k<2150||t.k>2450||t.p<140)?'  <<<':'')});
console.log('recipes',N.RECIPES.length,'bad',bad);
