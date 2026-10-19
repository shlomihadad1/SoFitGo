/* Artifact build (single page, no service worker) + migration of data saved by version 1. */
const { chromium, devices } = require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8091/');
await p.evaluate(()=>{localStorage.clear();localStorage.setItem('fit30.workouts',JSON.stringify({v:1,days:{1:{status:'done',version:'std',date:'2026-10-17',tests:{pushup:18,plank:70}}},levels:{},swaps:{},feedback:{}}));});
await p.reload();await p.waitForTimeout(600);
const mig=await p.evaluate(()=>{const w=Store.load('workouts');return {t:w.tests[1]&&w.tests[1].results,day:!!w.days[1]&&!w.days[1].tests};});
console.log('v1 migration', JSON.stringify(mig), mig.t&&mig.t.pushup===18&&mig.day?'PASS':'FAIL');
const p2=await ctx.newPage();await p2.goto('file://'+process.argv[2]);await p2.waitForTimeout(800);
for(const h of ['#/','#/day/1','#/nutrition','#/recipes','#/progress','#/settings','#/install']){await p2.evaluate(x=>location.hash=x,h);await p2.waitForTimeout(250);}
console.log('artifact env', await p2.evaluate(()=>window.FIT30_ENV), 'sw', await p2.evaluate(()=>App.swState), 'errors', JSON.stringify(errs), errs.length?'FAIL':'PASS');await b.close();})();
