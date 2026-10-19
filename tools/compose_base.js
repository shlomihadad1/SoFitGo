/* Authoring helper: per-day portion adjustments for the base menu (no optional add-on).
   Raises lean protein sources (chicken, soya, legumes, besan, hung curd, roasted chana, sprouts, paneer) until the day reaches
   the protein target, then raises simple carbs (rice, oats, poha, potato, fruit) if calories are under 2200, never above 2450.
   Items whose counts appear in recipe steps (eggs, egg whites, roti/atta, bread) are never adjusted. Writes BASE_ADJ into nutrition.js. */
for (const f of ['src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js', 'src/data/recipes_intl.js','src/js/logic.js']) require('../'+f);
const fs=require('fs'); const {Logic:L,NUTRI:N}=globalThis; const F=N.FOODS;
const PT=155, KMIN=2200, KMAX=2450;
const PRO={chicken_breast:[10,1.35,320],chicken_thigh:[10,1.35,320],chicken_mince:[10,1.35,320],soya:[5,1.5,75],masoor:[5,1.4,115],moong:[5,1.4,115],toor:[5,1.4,115],rajma:[5,1.4,115],chana:[5,1.4,115],kala_chana:[5,1.4,115],besan:[5,1.3,110],hung_curd:[25,1.4,300],roasted_chana:[5,1.4,70],sprouts:[20,1.5,260],paneer:[10,1.25,180]};
const CARB={rice:[5,1.4,150],oats:[5,1.4,95],poha:[5,1.4,110],potato:[20,1.5,320],banana:[20,1.8,200],apple:[25,1.7,250],orange:[30,1.6,220],guava:[25,1.6,220],sweet_potato:[20,1.5,270],noodles:[5,1.4,140],peas:[10,1.5,130]};
const out=[], rep=[];
N.MENU.forEach((m,day)=>{ const slots=['m1','m2','snack']; const adj={m1:{},m2:{},snack:{}};
  const g=(s,i)=>adj[s][i]!=null?adj[s][i]:L.recipe(m[slots.indexOf(s)]).ing[i].g;
  const tot=()=>L.roundM(L.sumMacros(slots.flatMap((s,j)=>L.recipe(m[j]).ing.map((x,i)=>L.ingMacros({f:x.f,g:g(s,i)})))));
  const opts=(T)=>slots.flatMap((s,j)=>L.recipe(m[j]).ing.map((x,i)=>({s,i,f:x.f,orig:x.g})).filter(o=>T[o.f]));
  let guard=0;
  while(tot().p<PT&&guard++<300){ const c=opts(PRO).filter(o=>{const [st,mul,cap]=PRO[o.f];return g(o.s,o.i)+st<=Math.min(cap,Math.round(o.orig*mul))&&tot().k+L.ingMacros({f:o.f,g:st}).k<=KMAX;})
      .sort((a,b)=>(F[b.f].p/F[b.f].k)-(F[a.f].p/F[a.f].k)||(a.orig-g(a.s,a.i))-(b.orig-g(b.s,b.i)));
    if(!c.length)break; const o=c[0]; adj[o.s][o.i]=g(o.s,o.i)+PRO[o.f][0]; }
  guard=0;
  while(tot().k<KMIN&&guard++<300){ const c=opts(CARB).filter(o=>{const [st,mul,cap]=CARB[o.f];return g(o.s,o.i)+st<=Math.min(cap,Math.round(o.orig*mul));}).sort((a,b)=>(g(a.s,a.i)/a.orig)-(g(b.s,b.i)/b.orig));
    if(!c.length)break; const o=c[0]; adj[o.s][o.i]=g(o.s,o.i)+CARB[o.f][0]; }
  const t=tot(); const clean={}; slots.forEach(s=>{const e=Object.entries(adj[s]).filter(([i,v])=>v!==L.recipe(m[slots.indexOf(s)]).ing[i].g); if(e.length)clean[s]=Object.fromEntries(e.map(([i,v])=>[i,v]));});
  out.push(clean); rep.push(`${day+1}: ${t.k} kcal ${t.p} P  `+Object.entries(clean).map(([s,o])=>s+'{'+Object.entries(o).map(([i,v])=>L.recipe(m[slots.indexOf(s)]).ing[i].f+' '+L.recipe(m[slots.indexOf(s)]).ing[i].g+'→'+v).join(', ')+'}').join(' '));
});
let src=fs.readFileSync(__dirname+'/../src/data/nutrition.js','utf8');
const txt='/* Base-menu portion adjustments per day (ingredient index → grams), chosen so the 3 base meals reach the protein target without the optional add-on. */\nconst BASE_ADJ = '+JSON.stringify(out).replace(/"(\w+)":/g,'$1: ').replace(/\},\{/g,'},\n  {')+';';
if(/const BASE_ADJ = /.test(src)) src=src.replace(/\/\* Base-menu portion adjustments[\s\S]*?const BASE_ADJ = [\s\S]*?\];/,txt); else src=src.replace('const FLEX_DAYS =',txt+'\nconst FLEX_DAYS =');
src=src.replace(/root\.NUTRI = \{ FOODS: F, SWAP, RECIPES: R, FLEX, MENU, FLEX_DAYS, EXTRA_DAY(, BASE_ADJ)? \};/,'root.NUTRI = { FOODS: F, SWAP, RECIPES: R, FLEX, MENU, FLEX_DAYS, EXTRA_DAY, BASE_ADJ };');
fs.writeFileSync(__dirname+'/../src/data/nutrition.js',src); console.log(rep.join('\n'));
