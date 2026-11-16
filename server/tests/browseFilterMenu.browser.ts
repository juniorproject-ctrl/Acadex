import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';

const base=process.env.TEST_BASE_URL||'http://localhost:3002';
const categories=['Sports & Fitness','Art & Design','Musical Instruments','Clothing & Accessories','Home Essentials'];
const browser=await chromium.launch({headless:true});
try{
  await fs.mkdir('test-results/browse-filter-menu',{recursive:true});
  for(const width of [1440,768,390,320]){
    const page=await browser.newPage({viewport:{width,height:1000}});
    await page.goto(base+'/browse');
    const trigger=page.getByRole('button',{name:/^Refine your search/});
    await expect(trigger).toHaveAttribute('aria-expanded','false');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await trigger.click();const panel=page.getByRole('dialog',{name:'Refine listing filters'});
    await expect(panel).toBeVisible();await expect(page.getByLabel('Category',{exact:true})).toBeFocused();
    for(const name of categories)await expect(panel.getByRole('option',{name,exact:true})).toHaveCount(1);
    await page.getByLabel('Category',{exact:true}).selectOption('Home Essentials');
    await page.getByLabel('Condition',{exact:true}).selectOption('Like New');
    await expect(trigger).toContainText('2');await expect(page).toHaveURL(/category=Home\+Essentials/);
    const rect=await panel.boundingBox();expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(width);
    await page.screenshot({path:`test-results/browse-filter-menu/open-${width}.png`});
    await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(trigger).toBeFocused();
    await trigger.click();await page.getByRole('heading',{name:'Browse Listings',exact:true}).click();await expect(panel).toHaveCount(0);
    await trigger.click();await page.getByRole('button',{name:'Reset filters',exact:true}).click();await page.getByRole('button',{name:'Show results',exact:true}).click();await expect(panel).toHaveCount(0);
    await expect(page.locator('.browse-active-filters')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/browse-filter-menu/closed-${width}.png`});
    await page.goto(base+'/');for(const name of categories)await expect(page.getByLabel('Search category').getByRole('option',{name,exact:true})).toHaveCount(1);
    await page.close();console.log(`PASS ${width}px: collapsed filters, category choices, active count, focus, Escape/outside close, reset and home search options`);
  }
}finally{await browser.close();}
