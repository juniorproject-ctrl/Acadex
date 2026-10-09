import fs from 'node:fs/promises';
import { chromium,expect } from '@playwright/test';

// Opt-in verification after db:demo; does not modify the demonstration records.
async function main(){
  const base=process.env.TEST_BASE_URL||'http://localhost:3001';
  const accounts=JSON.parse(await fs.readFile('.demo-accounts.local.json','utf8'));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
    for(const category of ['papers','groups','tutors','events']){
      const response=await context.request.get(base+'/api/'+category);
      expect(response.ok()).toBeTruthy();
      const result=await response.json();
      expect(result.items.length).toBeGreaterThanOrEqual(3);
      if(category==='papers')for(const paper of result.items.filter((p:any)=>p.title.startsWith('[Sample]'))){
        const pdf=await context.request.get(base+'/api/papers/'+paper.id+'/download');
        expect(pdf.ok()).toBeTruthy();expect((await pdf.body()).subarray(0,5).toString()).toBe('%PDF-');
      }
    }
    for(const role of ['student','tutor','leader']){
      const response=await context.request.post(base+'/api/auth/login',{data:{email:accounts[role].email,password:accounts[role].password}});
      expect(response.ok()).toBeTruthy();
      const session=await response.json();expect(session.user.role).toBe(role);
      if(role==='student'){
        await page.goto(base+'/');
        await page.evaluate(session=>{localStorage.setItem('acadex_access_token',session.token);localStorage.setItem('acadex_session_user',JSON.stringify(session.user));},session);
      }
    }
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});
      await page.goto(base+'/community');await page.waitForLoadState('networkidle');
      expect(await page.locator('.community-card').count()).toBe(12);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
      expect(await page.locator('.event-card img').evaluateAll(imgs=>imgs.every(img=>(img as HTMLImageElement).naturalWidth>0))).toBeTruthy();
      await page.screenshot({path:`test-results/sample-community-${width}.png`,fullPage:true});
    }
    console.log('PASS: sample content, three PDF downloads, demo role logins, 12 hub cards, event images and desktop/mobile layout.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
