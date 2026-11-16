import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base=process.env.TEST_BASE_URL||'http://localhost:3002';
for(const [file,hash] of [['src/components/BrandLogo.tsx','b930b9950c5643a4ca32a4e9b978864021d9f5dc1d36f91359ad920175d1a899'],['public/assets/acadex-logo.png','43ce91c547b7756f2076e9e3907a9cf37ce64a584f5a9d6bec151d462a41a64b']])expect(createHash('sha256').update(await fs.readFile(file)).digest('hex')).toBe(hash);
const browser=await chromium.launch({headless:true});
try{
  await fs.mkdir('test-results/campus-fresh',{recursive:true});
  for(const width of [1440,768,390,320]){
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await expect(page.getByRole('heading',{name:'Your Campus Marketplace'})).toBeVisible();
    await expect(page.locator('.campus-listing-grid')).toHaveAttribute('aria-busy','false');
    await expect(page.locator('.campus-hero img')).toHaveCount(0);
    expect(await page.locator('.campus-hero').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
    await expect(page.locator('.campus-category svg')).toHaveCount(7);
    await expect(page.locator('.student-offer svg,.campus-prompt>svg')).toHaveCount(0);
    expect(await page.locator('nav img[alt="Acadex"]').evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const categoryBox=await page.locator('.campus-categories').boundingBox();expect(categoryBox!.y).toBeLessThan(900);
    await page.screenshot({path:`test-results/campus-fresh/home-${width}.png`,fullPage:true});
    const sizes=await page.locator('.campus-listing-image').evaluateAll(els=>els.map(el=>({w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height)})));
    if(sizes.length)for(const size of sizes)expect(size).toEqual(sizes[0]);
    await page.getByRole('searchbox',{name:'Search Acadex'}).fill('textbooks');
    await page.getByRole('button',{name:'Search',exact:true}).click();
    await expect(page).toHaveURL(/\/browse/);
    await page.goto(base);await page.getByRole('link',{name:'Study Groups',exact:true}).first().click();await expect(page).toHaveURL(/\/study-groups/);
    await page.goto(base);await page.getByRole('link',{name:'Start Selling',exact:true}).click();await expect(page).toHaveURL(/\/login\?returnTo=/);
    for(const route of ['/login','/signup','/forgot-password','/verify','/community','/past-papers','/tutors','/events']){
      await page.goto(base+route);await expect(page.locator('h1,h2').first()).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflows').toBe(true);
      if(route==='/login'||route==='/signup'){
        await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.auth-container')!).opacity)>.99);
        await page.screenshot({path:`test-results/campus-fresh/${route.slice(1)}-${width}.png`,fullPage:true});
      }
    }
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base);
    expect(await page.locator('.campus-accent').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
    await page.getByRole('link',{name:'Advertise With Us'}).click();await expect(page).toHaveURL(base+'/advertise');
    expect(errors).toEqual([]);
    console.log(`PASS ${width}px: homepage, image, equal listing images, search, categories, login guard, community/auth layouts, reduced motion and advertising link`);
    await page.close();
  }
}finally{await browser.close();}
