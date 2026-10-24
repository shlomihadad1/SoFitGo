for (const f of ['src/data/exercises.js','src/data/workouts.js','src/data/nutrition.js', 'src/data/recipes_intl.js', 'src/data/recipes_med.js','src/js/logic.js']) require('../'+f);
const {Logic:L,NUTRI:N}=globalThis;
const T={m1:{k:820,p:50},m2:{k:930,p:62},snack:{k:340,p:25}};
const PG=new Set(['protein']);const out={};
for(const r of N.RECIPES){ if(!T[r.meal]||r.est) continue; const t=T[r.meal];
 const g=r.ing.map(x=>x.g); const m=()=>L.recipeMacros({ing:r.ing.map((x,i)=>({...x,g:g[i]}))});
 let cur=m(); if(cur.p<t.p){const pp=r.ing.reduce((s,x,i)=>s+(PG.has(N.FOODS[x.f].grp)?L.ingMacros({...x,g:g[i]}).p:0),0); const need=t.p-cur.p; const sc=Math.min(1.45,1+need/Math.max(pp,1)); r.ing.forEach((x,i)=>{if(PG.has(N.FOODS[x.f].grp))g[i]*=sc});}
 cur=m(); if(cur.k<t.k-40){ const ck=r.ing.reduce((s,x,i)=>s+(N.FOODS[x.f].grp==='carb'?L.ingMacros({...x,g:g[i]}).k:0),0); const sc=Math.min(1.5,1+(t.k-cur.k)/Math.max(ck,1)); r.ing.forEach((x,i)=>{if(N.FOODS[x.f].grp==='carb')g[i]*=sc});}
 r.ing.forEach((x,i)=>{const f=N.FOODS[x.f]; let v=g[i]; if(x.f==='egg')v=Math.round(v/50)*50; else if(x.f==='egg_white')v=Math.round(v/33)*33; else if(x.f==='atta')v=Math.round(v/17.5)*17.5; else v=Math.round(v/5)*5; g[i]=v;});
 const changed=r.ing.map((x,i)=>x.g!==g[i]?`${x.f}:${x.g}->${g[i]}`:null).filter(Boolean);
 const nm=m(); out[r.id]=g; console.log(r.meal,r.id,changed.join(', '),'=>',nm.k,nm.p);
}
require('fs').writeFileSync('/tmp/claude-0/-home-claude/20717445-9d82-540b-bffa-df41c702eaac/scratchpad/tune.json',JSON.stringify(out));
