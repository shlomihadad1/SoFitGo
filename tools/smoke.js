const { chromium, devices } = require('playwright');
const OUT='/tmp/claude-0/-home-claude/20717445-9d82-540b-bffa-df41c702eaac/scratchpad/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13'], locale:'he-IL'});const p=await ctx.newPage();
const errs=[];p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text())});p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('http://localhost:8091/');await p.waitForTimeout(800);
const routes=process.argv.slice(2);
for(const r of routes){await p.evaluate(h=>location.hash=h,r);await p.waitForTimeout(500);
 const ov=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 await p.screenshot({path:OUT+'s_'+r.replace(/[#\/]/g,'_')+'.png',fullPage:true});console.log(r,'overflowX',ov);}
console.log('ERRORS',JSON.stringify(errs,null,1));await b.close();})();
