const { chromium, devices } = require('playwright');
const OUT='/tmp/claude-0/-home-claude/20717445-9d82-540b-bffa-df41c702eaac/scratchpad/w_';
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({...devices['iPhone 13']})).newPage();
await p.goto('http://localhost:8091/');await p.waitForTimeout(600);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(500);
await p.evaluate(()=>{const pr=Store.load('profile');pr.onboarded=true;pr.prefs=Core.normPrefs({dairy:false});Store.save('profile');Core.applyPrefs(pr.prefs);});
for(const s of process.argv.slice(2)){const [h,y]=s.split('@');await p.evaluate(x=>location.hash=x,h);await p.waitForTimeout(500);if(y)await p.evaluate(v=>scrollTo(0,+v),y);await p.waitForTimeout(150);await p.screenshot({path:OUT+s.replace(/[#\/@]/g,'_')+'.png'});}
await b.close();})();
