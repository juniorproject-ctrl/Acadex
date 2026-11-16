import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';

const base=process.env.TEST_BASE_URL||'http://localhost:3024';
const browser=await chromium.launch({headless:true});
try{
  await fs.mkdir('test-results/student-offers',{recursive:true});
  for(const [width,columns] of [[1440,4],[768,2],[390,1]]){
    const page=await browser.newPage({viewport:{width,height:1000}});
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await expect(page.getByRole('heading',{name:'Your Campus Marketplace'})).toBeVisible();
    const section=page.getByRole('region',{name:'Student Offers & Partners'});
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator('article')).toHaveCount(4);
    await expect(section.getByText('Sponsored Example',{exact:true})).toHaveCount(4);
    const layout=await page.evaluate(()=>{
      const section=document.querySelector('.student-offers')!,footer=document.querySelector('footer')!;
      const main=document.querySelector('main')!;
      const feedback=document.querySelector('.campus-final-feedback')!;
      return {last:main.lastElementChild?.lastElementChild===feedback&&section.nextElementSibling===feedback,ordered:section.getBoundingClientRect().bottom<=feedback.getBoundingClientRect().top&&feedback.getBoundingClientRect().bottom<=footer.getBoundingClientRect().top,columns:getComputedStyle(document.querySelector('.student-offers-grid')!).gridTemplateColumns.split(' ').length,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(layout).toEqual({last:true,ordered:true,columns,overflow:false});
    await page.screenshot({path:`test-results/student-offers/offers-${width}.png`});
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(await section.locator('article').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
    await section.getByRole('link',{name:'Advertise With Us'}).click();
    await expect(page).toHaveURL(base+'/advertise');
    await expect(page.getByRole('heading',{name:'Who can advertise'})).toBeVisible();
    await page.reload();await expect(page.getByRole('heading',{name:'Advertising formats'})).toBeVisible();
    await page.getByRole('link',{name:'Contact Acadex'}).click();
    await expect(page).toHaveURL(base+'/contact');
    await expect(page.getByRole('link',{name:'Sign in to contact us'})).toBeVisible();
    await page.goto(base+'/browse');await expect(page.locator('.student-offers')).toHaveCount(0);
    expect(errors).toEqual([]);
    await page.close();console.log(`PASS: public offers, footer placement, ${columns}-column layout, advertising/contact links and no page errors at ${width}px`);
  }
}finally{await browser.close();}
