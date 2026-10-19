const { chromium, devices } = require('playwright');
const OUT='/tmp/claude-0/-home-claude/20717445-9d82-540b-bffa-df41c702eaac/scratchpad/v_';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13']});const p=await ctx.newPage();
await p.goto('http://localhost:8091/');await p.waitForTimeout(600);
await p.evaluate(()=>{localStorage.clear();});await p.reload();await p.waitForTimeout(500);
await p.evaluate(()=>{const pr=Store.load('profile');pr.startDate=Store.addDays(Store.today(),-9);pr.onboarded=true;Store.save('profile');
 const t=Store.today();Core.eatSlot(t,'m1',1);Core.eatSlot(t,'snack',1);Core.setDaily(t,{water:1500,steps:6400,sleep:7});
 for(let i=1;i<=9;i++){const d=Store.addDays(t,-i);Core.setDaily(d,{steps:7000+i*400,sleep:6.5+(i%3)*0.5});Core.eatSlot(d,'m1',1);Core.eatSlot(d,'m2',1);}
 const tr=Store.load('tracking');[0,3,6,9].forEach((k,i)=>tr.measures.push({id:'m'+i,date:Store.addDays(t,-k),weight:85-i*0.3+(i%2)*0.2,waist:92-i*0.4}));Store.save('tracking');
 const w=Store.load('workouts');[1,2,3,4,6,8].forEach(n=>w.days[n]={status:n===6?'partial':'done',version:'std',date:Core.dateOfDay(n),durationSec:2100,rpe:6,sets:[{done:true,sec:'main',ex:'squat',set:1,reps:12+n}],tests:n===1?{pushup:18,squat60:34,plank:75,burpee60:14}:{}});Store.save('workouts');});
const shots=process.argv.slice(2);
for(const s of shots){const [h,y]=s.split('@');await p.evaluate(x=>location.hash=x,h);await p.waitForTimeout(600);if(y)await p.evaluate(v=>scrollTo(0,+v),y);await p.waitForTimeout(200);await p.screenshot({path:OUT+s.replace(/[#\/@]/g,'_')+'.png'});}
if(process.env.RUN){await p.evaluate(x=>location.hash=x,'#/day/10');await p.waitForTimeout(400);await p.locator('[data-act=start]').click();await p.waitForTimeout(500);await p.screenshot({path:OUT+'run1.png'});
 for(let i=0;i<7;i++){await p.locator('.run [data-a=done]').click();await p.waitForTimeout(120);if(await p.locator('.run [data-a=skipRest]').count())break;}
 await p.waitForTimeout(300);await p.screenshot({path:OUT+'run2.png'});}
await b.close();})();
