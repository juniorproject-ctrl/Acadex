import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {query,pool} from '../db';
import {createAccessToken} from '../auth';
import {config} from '../config';
import {LISTING_PHOTO_HINT,MAX_LISTING_PHOTO_BYTES} from '../../src/lib/listingUploadRules';

async function main(){
 const base=process.env.TEST_BASE_URL||'http://localhost:3005';
 const browser=await chromium.launch({headless:true});
 const users=['student','student','admin'].map(role=>({id:randomUUID(),name:'Mobile QA '+role,email:randomUUID()+'@example.test',role}));
 const listing=randomUUID(),title='Mobile QA textbook '+randomUUID().slice(0,5),errors:string[]=[];
 await fs.mkdir('test-results',{recursive:true});
 try{
  for(const u of users)await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[u.id,u.name,u.email,'disabled-browser-test-account',u.role]);
  await query("INSERT INTO listings (id,owner_id,title,description,price,category,item_condition,location,status) VALUES (?,?,?,'A sample textbook for mobile reporting checks.',50,'Textbooks','Good','Sharjah','ACTIVE')",[listing,users[1].id,title]);
  await query('INSERT INTO listing_images (id,listing_id,image_url,position) VALUES (?,?,?,0)',[randomUUID(),listing,'/assets/acadex-logo.png']);
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await context.addInitScript(({user,token})=>{localStorage.setItem('acadex_session_user',JSON.stringify(user));localStorage.setItem('acadex_access_token',token);},{user:users[0],token:createAccessToken(users[0])});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  for(const [label,route] of [['My Learning','dashboard'],['Account settings','settings'],['Report a problem','report'],['Accessibility','accessibility']]){
   await page.goto(base+'/home');await page.getByRole('button',{name:'Account menu',exact:true}).tap();
   await expect(page.getByRole('menu',{name:'Account',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Account menu',exact:true}).dispatchEvent('focusout',{bubbles:true,relatedTarget:null});
   await expect(page.getByRole('menu',{name:'Account',exact:true})).toBeVisible();
   if(label==='My Learning')await page.screenshot({path:'test-results/mobile-account-menu.png',fullPage:true});
   await page.getByRole('menuitem',{name:label,exact:true}).tap();await expect(page).toHaveURL(base+'/'+route);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  console.log('PASS: touch account navigation and null-relatedTarget blur.');
  for(const viewport of [{width:320,height:568},{width:844,height:390}]){
   await page.setViewportSize(viewport);await page.goto(base+'/home');await page.getByRole('button',{name:'Account menu',exact:true}).tap();
   const box=await page.getByRole('menu',{name:'Account',exact:true}).boundingBox();expect(box).not.toBeNull();expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height);
   await page.getByRole('menuitem',{name:'Accessibility',exact:true}).tap();await expect(page).toHaveURL(base+'/accessibility');
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/past-papers');await page.getByRole('button',{name:'Upload paper',exact:true}).tap();
  const form=page.locator('form.editor-form');
  await form.getByRole('combobox',{name:'University',exact:true}).tap();
  await page.getByRole('option',{name:'University of Sharjah',exact:true}).tap();
  await form.getByRole('combobox',{name:'Major',exact:true}).tap();
  await page.getByRole('option',{name:'Computer Science',exact:true}).tap();
  await form.getByRole('combobox',{name:'Course',exact:true}).tap();
  await page.getByRole('option',{name:'Programming',exact:true}).tap();
  await expect(form.getByRole('combobox',{name:'Course',exact:true})).toHaveAttribute('aria-expanded','false');
  await form.getByLabel('Paper title',{exact:true}).fill('Mobile paper '+users[0].id);
  await form.locator('input[name=file]').setInputFiles({name:'practice.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nMobile sample paper\n%%EOF')});
  await form.getByRole('checkbox').check();await page.screenshot({path:'test-results/mobile-paper-upload.png',fullPage:true});
  await form.getByRole('button',{name:'Upload PDF',exact:true}).tap();
  await expect(page.getByText('Paper uploaded.',{exact:true})).toBeVisible();
  console.log('PASS: touch university/major/course selection and actual PDF upload.');
  await page.goto(base+'/listings/'+listing);await page.getByRole('link',{name:'Report listing',exact:true}).tap();
  await expect(page.getByLabel('Subject',{exact:true})).toHaveValue('Report listing: '+title);
  await page.getByLabel('Details',{exact:true}).fill('This listing description appears misleading. Please review it.');
  await page.getByRole('button',{name:'Send report',exact:true}).tap();
  await expect(page.getByText('Your report has been sent to the administrator.',{exact:true})).toBeVisible();
  const [report]=await query<any[]>('SELECT target_type,target_id FROM reports WHERE reporter_id=?',[users[0].id]);expect(report.target_id).toBe(listing);expect(report.target_type).toBe('listing');
  await page.screenshot({path:'test-results/mobile-listing-report.png',fullPage:true});
  await page.goto(base+'/post');await expect(page.getByText(LISTING_PHOTO_HINT,{exact:true})).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({name:'oversize.png',mimeType:'image/png',buffer:Buffer.alloc(MAX_LISTING_PHOTO_BYTES+1)});
  await expect(page.getByText('oversize.png: this photo exceeds 5 MB. Choose a smaller image.',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/mobile-photo-limit.png',fullPage:true});
  console.log('PASS: contextual listing report and client photo-size validation.');
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'/past-papers');await page.getByRole('button',{name:'Upload paper',exact:true}).click();await page.screenshot({path:'test-results/desktop-paper-upload.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const admin=await browser.newContext({viewport:{width:1440,height:1000}});
  await admin.addInitScript(({user,token})=>{localStorage.setItem('acadex_session_user',JSON.stringify(user));localStorage.setItem('acadex_access_token',token);},{user:users[2],token:createAccessToken(users[2])});
  const adminPage=await admin.newPage();await adminPage.goto(base+'/dashboard');
  await expect(adminPage.getByText('Reported listing: '+listing,{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
  console.log('PASS: admin sees the reported listing reference; desktop/mobile layouts have no horizontal overflow.');
 }finally{
  await browser.close();
  const papers=await query<any[]>('SELECT file_name FROM past_papers WHERE owner_id=?',[users[0].id]);
  await query('DELETE FROM past_papers WHERE owner_id=?',[users[0].id]);
  for(const paper of papers)await fs.unlink(path.join(config.paperDirectory,path.basename(paper.file_name))).catch(()=>{});
  await query('DELETE FROM reports WHERE reporter_id=?',[users[0].id]);
  await query('DELETE FROM listings WHERE id=?',[listing]);
  for(const u of users)await query('DELETE FROM users WHERE id=?',[u.id]);
  await pool.end();
 }
}
main().catch(async error=>{console.error(error);await pool.end().catch(()=>{});process.exitCode=1;});
