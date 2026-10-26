import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import {query,pool} from '../db';
import {createAccessToken} from '../auth';

async function main(){
 const base=process.env.TEST_BASE_URL||'http://localhost:3006';
 const browser=await chromium.launch({headless:true});
 const users=['student','student','admin'].map(role=>({id:randomUUID(),name:'Card QA '+role,email:randomUUID()+'@example.test',role}));
 const id=randomUUID(),title='Card click QA '+randomUUID().slice(0,6),password='TemporaryAdminPassword!123',errors:string[]=[];
 const contextFor=async(index:number,width:number)=>{
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:true,isMobile:width<600});
  await context.addInitScript(({user,token})=>{localStorage.setItem('acadex_access_token',token);localStorage.setItem('acadex_session_user',JSON.stringify(user));},{user:users[index],token:createAccessToken(users[index])});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));return {context,page};
 };
 try{
  for(const user of users)await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[user.id,user.name,user.email,await bcrypt.hash(password,12),user.role]);
  await query("INSERT INTO listings (id,owner_id,title,description,price,category,item_condition,location,status) VALUES (?,?,?,'A fictional listing for navigation testing.',123.45,'Textbooks','Good','Sharjah','ACTIVE')",[id,users[1].id,title]);
  await query('INSERT INTO listing_images (id,listing_id,image_url,position) VALUES (?,?,?,0)',[randomUUID(),id,'/assets/acadex-logo.png']);
  const browse=base+'/browse?'+new URLSearchParams({search:title});
  for(const width of [1440,390]){
   const {context,page}=await contextFor(0,width);
   const tap=async(box:{x:number;y:number;width:number;height:number})=>{
    const x=box.x+box.width/2,y=box.y+box.height/2;
    if(width<600)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
   };
   for(const area of ['image','price','padding']){
    await page.goto(browse);
    const card=page.locator('.listing-card').filter({has:page.getByRole('link',{name:title,exact:true})});await expect(card).toBeVisible();await card.scrollIntoViewIfNeeded();
    const box=area==='image'?await card.locator('img').boundingBox():area==='price'?await card.getByText('AED 123.45',{exact:true}).boundingBox():await card.boundingBox();
    expect(box).not.toBeNull();await tap(area==='padding'?{x:box!.x+3,y:box!.y+box!.height-7,width:2,height:2}:box!);
    await expect(page).toHaveURL(base+'/listings/'+id);
   }
   await page.goto(browse);await page.getByRole('link',{name:'Buy item',exact:true}).click();await expect(page).toHaveURL(new RegExp('/checkout\\?kind=listing&reference='+id));
   await page.goto(browse);await page.getByRole('link',{name:'Report listing',exact:true}).click();await expect(page).toHaveURL(/\/report\?/);
   await page.goto(browse);await page.getByRole('button',{name:'Chat with seller',exact:true}).click();await expect(page).toHaveURL(/\/messages\/[a-f0-9-]+$/);
   await page.goto(base+'/home');const featured=page.locator('.listing-card').filter({has:page.getByRole('link',{name:title,exact:true})});await featured.scrollIntoViewIfNeeded();await tap((await featured.locator('img').boundingBox())!);await expect(page).toHaveURL(base+'/listings/'+id);
   await context.close();
   const owner=await contextFor(1,width);await owner.page.goto(browse);await owner.page.getByRole('link',{name:'Edit',exact:true}).click();await expect(owner.page).toHaveURL(base+'/post?edit='+id);await expect(owner.page.getByRole('heading',{name:'Edit Listing'})).toBeVisible();
   await owner.page.goto(browse);owner.page.once('dialog',dialog=>dialog.dismiss());await owner.page.getByRole('button',{name:'Delete',exact:true}).click();await expect(owner.page).toHaveURL(browse);
   await owner.page.goto(base+'/my-listings');const ownCard=owner.page.locator('.listing-card').filter({has:owner.page.getByRole('link',{name:title,exact:true})});await ownCard.scrollIntoViewIfNeeded();const priceBox=await ownCard.getByText('AED 123.45',{exact:true}).boundingBox();if(width<600)await owner.page.touchscreen.tap(priceBox!.x+5,priceBox!.y+5);else await owner.page.mouse.click(priceBox!.x+5,priceBox!.y+5);await expect(owner.page).toHaveURL(base+'/listings/'+id);await owner.context.close();
   console.log('PASS: listing image, price, padding, featured cards and independent actions at '+width+'px.');
  }
  const admin=await contextFor(2,1440);await admin.page.goto(base+'/admin');await admin.page.getByRole('tab',{name:'Test accounts',exact:true}).click();
  await admin.page.getByLabel('Private demo-account JSON file').setInputFiles('.demo-accounts.local.json');await admin.page.getByLabel('Your real administrator password').fill(password);await admin.page.getByRole('checkbox').check();await admin.page.getByRole('button',{name:'Synchronize test accounts',exact:true}).click();
  await expect(admin.page.getByText('Test accounts synchronized. Sign in using the emails and passwords in your private file.',{exact:true})).toBeVisible();
  await admin.page.screenshot({path:'test-results/private-test-account-setup.png',fullPage:true});await admin.context.close();
  expect(errors).toEqual([]);console.log('PASS: private administrator credential-file import and no browser errors.');
 }finally{
  await browser.close();
  await query('DELETE FROM listing_conversations WHERE listing_id=?',[id]);
  await query('DELETE FROM listings WHERE id=?',[id]);
  await query('DELETE FROM admin_audit WHERE actor_id=?',[users[2].id]);
  for(const user of users)await query('DELETE FROM users WHERE id=?',[user.id]);
  await pool.end();
 }
}
main().catch(async error=>{console.error(error);await pool.end().catch(()=>{});process.exitCode=1;});
