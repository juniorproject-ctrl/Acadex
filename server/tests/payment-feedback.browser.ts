import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base=process.env.UI_TEST_URL||'http://127.0.0.1:3037';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results:string[]=[];
const user={id:'ui-test-student',name:'UI Test Student',email:'ui-test@acadex.example',role:'student'};
await mkdir('test-results/stripe-feedback',{recursive:true});
try {
  for(const width of [320,390,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:900}});
    const page=await context.newPage();
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    let feedbackPosts=0,checkoutBody:unknown,configured=false;
    // UI fixtures only: no production login, database changes or Stripe request.
    await page.route('**/api/**',async route=>{
      const req=route.request(),path=new URL(req.url()).pathname;
      let data:unknown={items:[],unread:0};
      if(path==='/api/auth/me')data={user};
      if(path==='/api/payments/config')data={configured,mode:'test',methods:['Visa','Mastercard']};
      if(path==='/api/payments/offer')data={title:'UI TEST textbook',amount:25,currency:'AED',pickupAvailable:true,sellerDelivery:true};
      if(path==='/api/payments/checkout') {
        checkoutBody=req.postDataJSON();
        return route.fulfill({status:503,json:{error:'UI fixture: no Stripe request was made.'}});
      }
      if(path==='/api/feedback'&&req.method()==='POST'){feedbackPosts++;data={ok:true};}
      await route.fulfill({json:data});
    });
    const fit=async(name:string)=>{
      await page.evaluate(()=>document.fonts.ready);
      const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().right>window.innerWidth+1).slice(0,8).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.slice(0,60),right:el.getBoundingClientRect().right})));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${name} overflow at ${width}: ${JSON.stringify(overflow)}`);
      await page.screenshot({path:`test-results/stripe-feedback/${name}-${width}.png`,fullPage:true});
      results.push(`${name} fits ${width}px`);
    };
    await page.goto(base+'/feedback');
    await expect(page.getByRole('heading',{name:'Share your feedback',exact:true})).toBeVisible();
    await expect(page.locator('textarea')).toHaveCount(0);
    const signIn=page.getByRole('link',{name:'Sign in to share feedback'});
    await expect(signIn).toBeVisible();
    const first=await signIn.boundingBox(),second=await page.getByRole('link',{name:'Continue browsing'}).boundingBox();
    assert.ok(first&&second&&first.y+first.height<=second.y,'Guest links overlap');
    await fit('guest-feedback');
    await signIn.click();
    await expect(page).toHaveURL(/\/login\?returnTo=%2Ffeedback/);
    results.push(`Guest feedback redirects to login at ${width}px`);

    await page.evaluate(user=>{
      localStorage.setItem('acadex_access_token','ui-test-token');
      localStorage.setItem('acadex_session_user',JSON.stringify(user));
    },user);
    await page.goto(base+'/feedback');
    await page.getByRole('textbox',{name:'Your comments'}).fill('UI fixture feedback for a local layout test only.');
    await page.getByRole('button',{name:'Send feedback'}).click();
    await expect(page.getByRole('status')).toContainText('Your feedback has been sent');
    assert.equal(feedbackPosts,1);
    await fit('signed-in-feedback');

    await page.goto(base+'/accessibility');
    await expect(page.locator('.page-heading-icon .lucide-paintbrush')).toBeVisible();
    await page.getByRole('button',{name:'Account menu',exact:true}).click();
    await expect(page.getByRole('menuitem',{name:'Accessibility',exact:true}).locator('.lucide-paintbrush')).toBeVisible();
    await page.getByRole('button',{name:'Account menu',exact:true}).click();
    await page.getByRole('checkbox',{name:'Larger text'}).check();
    await expect(page.locator('html')).toHaveClass(/large-text/);
    await fit('accessibility');
    await page.getByRole('checkbox',{name:'Larger text'}).uncheck();

    await page.goto(base+'/checkout?kind=listing&reference=ui-fixture');
    await expect(page.getByText('4242 4242 4242 4242')).toBeVisible();
    await expect(page.getByRole('button',{name:'Continue to test checkout'})).toBeDisabled();
    configured=true;
    await page.reload();
    await expect(page.getByRole('button',{name:'Continue to test checkout'})).toBeDisabled();
    await page.getByRole('radio',{name:'Buyer pickup'}).check();
    await expect(page.getByRole('button',{name:'Continue to test checkout'})).toBeEnabled();
    await fit('test-checkout');
    await page.getByRole('button',{name:'Continue to test checkout'}).click();
    await expect(page.getByRole('alert')).toContainText('no Stripe request was made');
    assert.deepEqual(checkoutBody,{kind:'listing',reference:'ui-fixture',handover:'pickup'});
    assert.deepEqual(errors,[]);
    results.push(`Paintbrush, feedback submission and checkout controls passed at ${width}px (mock API)`);
    await context.close();
  }
  console.log(results.join('\n'));
  console.log(`PASS: ${results.length} local UI checks. Stripe-hosted payment and signed webhooks were not exercised.`);
} finally {await browser.close();}
