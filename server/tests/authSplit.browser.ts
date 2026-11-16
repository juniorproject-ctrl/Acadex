import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';

const base=process.env.TEST_BASE_URL||'http://localhost:3002';
const browser=await chromium.launch({headless:true});
try{
  await fs.mkdir('test-results/auth-split',{recursive:true});
  for(const width of [1440,768,390,320]){
    const page=await browser.newPage({viewport:{width,height:1000}});
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/login?returnTo=%2Fpost');
    await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
    const left=await page.locator('.auth-split-content').boundingBox();
    await expect(page.locator('.auth-split-page img[alt="Acadex"]')).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'ACADEX',exact:true,level:1})).toBeVisible();
    const accountLink=await page.getByRole('link',{name:'Create Account',exact:true}).boundingBox();
    const browseLink=await page.getByRole('link',{name:'Continue browsing',exact:true}).boundingBox();
    expect(browseLink!.y).toBeGreaterThan(accountLink!.y+accountLink!.height);
    const shell=await page.locator('.auth-split-shell').boundingBox();
    expect(shell!.x).toBe(0);expect(shell!.width).toBe(width);expect(shell!.height).toBeGreaterThanOrEqual(1000);
    await page.locator('.auth-split-shell').evaluate(el=>el.setAttribute('data-persist-check','yes'));
    await page.screenshot({path:`test-results/auth-split/login-${width}.png`,fullPage:true});
    await page.getByRole('link',{name:'Create Account',exact:true}).click();
    await expect(page).toHaveURL(base+'/signup');
    await expect(page.locator('[data-persist-check="yes"]')).toHaveCount(1);
    if(width>700){
      await page.waitForTimeout(100);
      const midway=await page.locator('.auth-split-content').boundingBox();
      expect(midway!.x).toBe(left!.x);
      await expect(page.locator('.auth-form-window')).toHaveAttribute('aria-busy','true');
      await expect(page.locator('.auth-form-view form')).toHaveCount(1);
      await expect(page.locator('#signup-name')).toHaveCount(0);
      await page.waitForTimeout(300);
      const moving=await page.locator('.auth-split-art').boundingBox();
      expect(moving!.x).toBeGreaterThan(0);expect(moving!.x).toBeLessThan(width/2);
      expect(await page.locator('.auth-split-art').evaluate(el=>getComputedStyle(el).zIndex)).toBe('3');
      await page.screenshot({path:`test-results/auth-split/transition-${width}.png`});
    }
    await expect(page.locator('.auth-form-window')).toHaveAttribute('aria-busy','false');
    const right=await page.locator('.auth-split-content').boundingBox();
    if(width>700)expect(right!.x).toBeGreaterThan(left!.x+200);else expect(right!.x).toBe(left!.x);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await page.evaluate(()=>sessionStorage.getItem('acadex_return_to'))).toBe('/post');
    await page.screenshot({path:`test-results/auth-split/signup-${width}.png`,fullPage:true});
    await page.getByRole('link',{name:'Log in',exact:true}).click();await expect(page.locator('.auth-form-window')).toHaveAttribute('aria-busy','true');await expect(page.locator('.auth-form-window')).toHaveAttribute('aria-busy','false');
    expect((await page.locator('.auth-split-content').boundingBox())!.x).toBe(left!.x);
    await page.route('**/api/auth/login',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Invalid email or password.'})}));
    await page.getByLabel('Email',{exact:true}).fill('test@university.ac.ae');await page.getByLabel('Password',{exact:true}).fill('incorrect-password');
    await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page.getByText('Invalid email or password.',{exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Forgot password?',exact:true}).click();await expect(page).toHaveURL(base+'/forgot-password');
    await page.goBack();await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'/login');
    expect(await page.locator('.auth-split-content').evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
    await page.getByRole('link',{name:'Create Account',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Sign Up',exact:true})).toBeVisible();
    expect(errors).toEqual([]);await page.close();
    console.log(`PASS ${width}px: persistent sliding layout, form positions, responsive fit, return destination, login errors, recovery link and reduced motion`);
  }
}finally{await browser.close();}
