/* Audit: (1) every number in recipe steps vs ingredient amounts, (2) dietary tags vs actual ingredients,
   (3) every BASE_ADJ entry: original → adjusted, nutrient effect, whether step text quotes that ingredient's amount. Writes dist/reports/audit.json */
for (const f of ['src/js/figure.js','src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js', 'src/data/recipes_intl.js','src/js/logic.js']) require('../'+f);
const fs=require('fs'); const {NUTRI:N,Logic:L}=globalThis; const F=N.FOODS;
const out={stepNumbers:[],tagIssues:[],adj:[],adjTextConflicts:[]};
const QUOTE={ 'ג׳ אורז':'rice','ג׳ אטה':'atta','ג׳ שמן':'oil','ג׳ דהי':'curd','ג׳ פניר':'paneer','ג׳ חומוס קלוי':'roasted_chana','ג׳ עוף':'chicken_breast','ג׳ סויה':'soya' };
for(const r of N.RECIPES){ const txt=r.steps.join(' | ');
  for(const m of txt.matchAll(/(\d+(?:\.\d+)?)\s*(ג׳ [א-ת]+(?: [א-ת]+)?|ביצים|חלבונים|רוטי|פרוסות|מ״ל|שריקות|דק׳|שעות|יחידות|קציצות)/g)) out.stepNumbers.push({id:r.id,n:+m[1],what:m[2],ctx:txt.slice(Math.max(0,m.index-30),m.index+40)});
  const fs_=r.ing.map(x=>x.f);
  const has=g=>fs_.some(f=>g.includes(f)); const DAIRY=['curd','hung_curd','milk','paneer','ghee'],EGG=['egg','egg_white'],CH=['chicken_breast','chicken_thigh','chicken_mince'];
  if(r.tags.includes('veg')&&(has(EGG)||has(CH))) out.tagIssues.push({id:r.id,tag:'veg',contains:fs_.filter(f=>EGG.includes(f)||CH.includes(f))});
  if(r.tags.includes('vegan')&&(has(EGG)||has(CH)||has(DAIRY))) out.tagIssues.push({id:r.id,tag:'vegan',contains:fs_.filter(f=>[...EGG,...CH,...DAIRY].includes(f))});
  if(r.tags.includes('chicken')&&!has(CH)) out.tagIssues.push({id:r.id,tag:'chicken',contains:[]});
  if(r.tags.includes('egg')&&!has(EGG)) out.tagIssues.push({id:r.id,tag:'egg',contains:[]});
  if(/ללא מוצרי חלב, ביצים ועוף/.test(r.notes)&&(has(EGG)||has(CH)||has(DAIRY))) out.tagIssues.push({id:r.id,tag:'note:ללא',contains:fs_});
}
const slots=['m1','m2','snack'];
N.BASE_ADJ.forEach((a,i)=>{ Object.entries(a).forEach(([s,o])=>Object.entries(o).forEach(([idx,g])=>{ const r=L.recipe(N.MENU[i][slots.indexOf(s)]), x=r.ing[idx];
  const d=L.roundM(L.ingMacros({f:x.f,g:g-x.g}));
  const kind=['chicken_breast','chicken_thigh','chicken_mince','soya','masoor','moong','toor','rajma','chana','kala_chana','besan','hung_curd','roasted_chana','sprouts','paneer'].includes(x.f)?'protein':'energy';
  out.adj.push({day:i+1,slot:s,recipe:r.id,food:x.f,from:x.g,to:g,kind,delta:d});
  const txt=r.steps.join(' '); const he=F[x.f].he.split(' (')[0].split(' ')[0];
  for(const m of txt.matchAll(/(\d+)\s*ג׳\s*([א-ת]+)/g)) if(x.f==='rice'&&m[2]==='אורז'&&+m[1]===x.g) out.adjTextConflicts.push({day:i+1,recipe:r.id,food:x.f,stepSays:+m[1],planned:g});
  if(x.f==='chicken_breast'||x.f==='soya') for(const m of txt.matchAll(/(\d+)\s*ג׳/g)) if(+m[1]===x.g) out.adjTextConflicts.push({day:i+1,recipe:r.id,food:x.f,stepSays:+m[1],planned:g});
}))});
fs.mkdirSync(__dirname+'/../dist/reports',{recursive:true}); fs.writeFileSync(__dirname+'/../dist/reports/audit.json',JSON.stringify(out,null,1));
console.log('step numbers found',out.stepNumbers.length); console.log('tag issues',JSON.stringify(out.tagIssues));
console.log('adjustments',out.adj.length,'protein',out.adj.filter(a=>a.kind==='protein').length,'energy',out.adj.filter(a=>a.kind==='energy').length,'foods',[...new Set(out.adj.map(a=>a.food))].join(','));
console.log('adj text conflicts',JSON.stringify(out.adjTextConflicts));
console.log(out.stepNumbers.filter(s=>/ג׳/.test(s.what)).map(s=>s.id+': '+s.n+' '+s.what).join('\n'));
