import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';

const base=process.env.TEST_BASE_URL||'http://localhost:3002';
const browser=await chromium.launch({headless:true});
try{
  await fs.mkdir('test-results/browse-fresh',{recursive:true});
  for(const width of [1440,768,390,320]){
    const page=await browser.newPage({viewport:{width,height:1000}});
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/browse');
    await expect(page.locator('.browse-result-count')).not.toHaveText('Finding campus essentials...');
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`test-results/browse-fresh/grid-${width}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const dimensions=await page.locator('.browse-card-image').evaluateAll(els=>els.map(el=>({w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height)})));
    for(const size of dimensions)expect(size).toEqual(dimensions[0]);
    await page.getByRole('button',{name:'List view',exact:true}).click();
    await expect(page.getByRole('button',{name:'List view',exact:true})).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/browse-fresh/list-${width}.png`,fullPage:true});
    await page.close();expect(errors).toEqual([]);
    console.log(`PASS ${width}px: real listings, equal images, grid/list layouts, no horizontal overflow or browser errors`);
  }

  // Exercise the query and pagination UI without creating or changing database records.
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const image='/assets/campus-fresh.png';
  const items=Array.from({length:128},(_,i)=>({id:'browse-qa-'+(i+1),ownerId:'browse-owner',title:'Campus item '+(i+1),subtitle:'A useful campus essential',description:'Test fixture',category:i%2?'Electronics':'Textbooks',condition:i%2?'Like New':'Good',price:(i+1)*25,location:'Sharjah',seller:'Campus seller',image,images:[image,image],pickupAvailable:true,sellerDelivery:true,status:'active'}));
  let fail=false;
  await page.route('**/api/listings?*',route=>{
    if(fail)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Browse test error'})});
    const q=new URL(route.request().url()).searchParams;
    let found=items.filter(item=>(!q.get('search')||item.title.toLowerCase().includes(q.get('search')!.toLowerCase()))&&(!q.get('category')||item.category===q.get('category'))&&(!q.get('condition')||item.condition===q.get('condition'))&&(!q.get('minPrice')||item.price>=Number(q.get('minPrice')))&&(!q.get('maxPrice')||item.price<=Number(q.get('maxPrice'))));
    if(q.get('sort')==='price_asc')found=found.sort((a,b)=>a.price-b.price);
    if(q.get('sort')==='price_desc')found=found.sort((a,b)=>b.price-a.price);
    const total=found.length,p=Number(q.get('page')||1);
    return route.fulfill({contentType:'application/json',body:JSON.stringify({listings:found.slice((p-1)*16,p*16),total,page:p,limit:16})});
  });
  await page.goto(base+'/browse');await expect(page.locator('.browse-listing-card')).toHaveCount(16);
  await page.getByRole('button',{name:'Page 8',exact:true}).click();await expect(page.getByRole('button',{name:'Page 8',exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('button',{name:'Page 6',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Next page',exact:true})).toBeDisabled();
  await page.goBack();await expect(page.getByRole('button',{name:'Page 1',exact:true})).toHaveAttribute('aria-current','page');
  await page.getByRole('button',{name:'Electronics',exact:true}).click();await expect(page).toHaveURL(/category=Electronics/);
  await expect(page.locator('.browse-card-category').first()).toHaveText('Electronics');
  await page.getByRole('button',{name:/^Refine your search/}).click();
  await page.getByLabel('Condition',{exact:true}).selectOption('Like New');
  await page.getByLabel('Price range',{exact:true}).selectOption('0 - 100 AED');
  await expect(page.locator('.browse-listing-card')).toHaveCount(2);
  await page.getByRole('button',{name:'Show results',exact:true}).click();
  await page.getByRole('button',{name:'Remove filter: 0 - 100 AED',exact:true}).click();
  await page.getByRole('button',{name:/^Refine your search/}).click();
  await page.getByRole('button',{name:'Reset filters',exact:true}).click();
  await page.getByRole('button',{name:'Show results',exact:true}).click();
  await expect(page.locator('.browse-active-filters')).toHaveCount(0);
  await page.getByLabel('Sort by',{exact:true}).selectOption('Price: High to Low');await expect(page.locator('.browse-card-price').first()).toHaveText('AED 3200');
  await page.getByLabel('Sort by',{exact:true}).selectOption('Price: Low to High');await expect(page.locator('.browse-card-price').first()).toHaveText('AED 25');
  await expect(page.locator('.browse-image-count').first()).toHaveAttribute('aria-label','2 photos');
  const imageBox=await page.locator('.browse-card-image').first().boundingBox();
  await page.mouse.click(imageBox!.x+imageBox!.width/2,imageBox!.y+imageBox!.height/2);await expect(page).toHaveURL(base+'/listings/browse-qa-1');
  await page.goto(base+'/browse');await page.getByRole('button',{name:'Chat with seller',exact:true}).first().click();await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.goto(base+'/browse');await page.getByRole('link',{name:'Buy item',exact:true}).first().click();await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.goto(base+'/browse');await page.getByRole('link',{name:'Report listing',exact:true}).first().click();await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.goto(base+'/browse');await page.getByRole('searchbox',{name:'Search listings'}).fill('no-matches-qa');await expect(page.getByRole('heading',{name:'No campus finds just yet'})).toBeVisible();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.locator('.browse-listing-card')).toHaveCount(16);
  fail=true;await page.reload();await expect(page.getByRole('alert')).toHaveText('Browse test error');await expect(page.locator('.browse-listing-card')).toHaveCount(0);
  await page.close();console.log('PASS: filters, removable tags, reset, both price sorts, pagination beyond page five, browser back, image-card click, protected actions, empty and error states');
}finally{await browser.close();}
