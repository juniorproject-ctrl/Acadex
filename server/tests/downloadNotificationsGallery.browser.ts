import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pool,query} from '../db';
import {config} from '../config';
import {createAccessToken} from '../auth';

const base=process.env.TEST_BASE_URL||'http://localhost:3021';
const users=[0,1].map(()=>({id:randomUUID(),name:'Workflow QA',email:randomUUID()+'@example.test',role:'student'}));
const paper=randomUUID(),listing=randomUUID(),unread=randomUUID(),read=randomUUID(),foreign=randomUUID(),prefix='Workflow QA '+randomUUID().slice(0,6);
const headers={Authorization:'Bearer '+createAccessToken(users[0])};
const stream='BT /F1 12 Tf 40 250 Td (Acadex QA PDF) Tj ET';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
let pdf='%PDF-1.4\n';const offsets=[0];
objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf);
pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const pdfBytes=Buffer.from(pdf),images=['#cf4444','#248547','#346bd0','#d4a326'].map((color,i)=>({name:`qa-${listing}-${i}.svg`,color}));
const browser=await chromium.launch({headless:true,downloadsPath:path.resolve('test-results/workflows')});
const probe=await browser.newContext({acceptDownloads:true}),probePage=await probe.newPage();
await probePage.setContent('<a download="probe.txt" href="data:text/plain,hello">Download</a>');
const probeEvent=probePage.waitForEvent('download');await probePage.locator('a').click();const nativeDownloadFailure=await(await probeEvent).failure();await probe.close();
if(nativeDownloadFailure)console.log('Environment restriction: standalone browser file saving is '+nativeDownloadFailure+'; verifying generated download bytes separately.');
try{
 await fs.mkdir('test-results/workflows',{recursive:true});await fs.mkdir(config.paperDirectory,{recursive:true});await fs.mkdir(config.uploadDirectory,{recursive:true});
 for(const u of users)await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[u.id,u.name,u.email,'disabled-workflow-qa',u.role]);
 const [course]=await query<any[]>('SELECT id FROM courses LIMIT 1');expect(course).toBeTruthy();
 await fs.writeFile(path.join(config.paperDirectory,paper+'.pdf'),pdfBytes);
 await query('INSERT INTO past_papers (id,owner_id,course_id,title,academic_year,exam_type,file_name) VALUES (?,?,?,?,2026,?,?)',[paper,users[1].id,course.id,prefix+' paper','Practice',paper+'.pdf']);
 await query("INSERT INTO listings (id,owner_id,title,description,price,category,item_condition,location,status) VALUES (?,?,?,'A four-photo gallery test listing.',50,'Textbooks','Good','Sharjah','ACTIVE')",[listing,users[1].id,prefix+' listing']);
 for(const [i,image] of images.entries()){
  await fs.writeFile(path.join(config.uploadDirectory,image.name),`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="${image.color}"/><text x="270" y="250" font-size="80" fill="white">${i+1}</text></svg>`);
  await query('INSERT INTO listing_images (id,listing_id,image_url,position) VALUES (?,?,?,?)',[randomUUID(),listing,'/uploads/'+image.name,i]);
 }
 for(const [id,userId,title,isRead,href] of [[unread,users[0].id,prefix+' unread',false,'/home'],[read,users[0].id,prefix+' read',true,'/browse'],[foreign,users[1].id,prefix+' foreign',false,'/home']])await query('INSERT INTO notifications (id,user_id,title,href,is_read) VALUES (?,?,?,?,?)',[id,userId,title,href,isRead]);
 for(const url of ['/','/api/health','/api/papers/'+paper+'/download','/uploads/'+images[0].name]){
  const r=await fetch(base+url);expect(r.headers.get('x-content-type-options')).toBe('nosniff');expect(r.headers.get('x-frame-options')).toBe('DENY');expect(r.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');expect(r.headers.get('strict-transport-security')).toContain('max-age=31536000');
 }
 expect((await fetch(base+'/api/papers/'+paper+'/download')).status).toBe(401);
 const original=await fetch(base+'/api/papers/'+paper+'/download',{headers});expect(original.status).toBe(200);expect(original.headers.get('cache-control')).toContain('no-store');expect(Buffer.from(await original.arrayBuffer())).toEqual(pdfBytes);
 expect((await fetch(base+'/api/account/notifications/'+foreign+'/read',{method:'PATCH',headers})).status).toBe(404);
 expect((await fetch(base+'/api/account/notifications/'+unread+'/read',{method:'PATCH'})).status).toBe(401);
 for(const width of [1440,390]){
  await query('UPDATE notifications SET is_read=FALSE WHERE id=?',[unread]);
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600,acceptDownloads:true});
  await context.addInitScript(({user,token})=>{localStorage.setItem('acadex_session_user',JSON.stringify(user));localStorage.setItem('acadex_access_token',token);},{user:users[0],token:createAccessToken(users[0])});
  await context.addInitScript(()=>{const create=URL.createObjectURL.bind(URL);URL.createObjectURL=(blob:Blob)=>{(window as any).__qaDownloadBlob=blob;return create(blob);};});
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const entry of ['/past-papers?q='+encodeURIComponent(prefix),'/community','/search?q='+encodeURIComponent(prefix)]){
  await page.goto(base+entry);
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download '+prefix+' paper',exact:true}).click();const download=await downloadEvent;
  const saved=`test-results/workflows/download-${width}.pdf`;expect(download.url().startsWith('blob:')).toBe(true);expect(download.suggestedFilename()).toBe(prefix+' paper.pdf');
  const generated=Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await(window as any).__qaDownloadBlob.arrayBuffer()))));expect(generated).toEqual(pdfBytes);
  if(nativeDownloadFailure)await fs.writeFile(saved,generated);else{await download.saveAs(saved);expect(await fs.readFile(saved)).toEqual(pdfBytes);}
  expect(await page.locator('a[href*="/api/papers/"]').count()).toBe(0);
  console.log('PASS: authenticated PDF download payload from '+entry.split('?')[0]+' at '+width+'px');
  }
  await page.goto(base+'/notifications');const row=page.locator('.notification-row').filter({hasText:prefix+' unread'});
  await expect(row).toHaveClass(/unread/);await expect(page.locator('.notification-row').filter({hasText:prefix+' read'})).toHaveClass(/read/);
  await page.screenshot({path:`test-results/workflows/notifications-${width}.png`,fullPage:true});await row.click();await expect(page).toHaveURL(base+'/home');
  await page.goto(base+'/notifications');await expect(page.locator('.notification-row').filter({hasText:prefix+' unread'})).toHaveClass(/notification-row read$/);
  await page.reload();await expect(page.locator('.notification-row').filter({hasText:prefix+' unread'})).toHaveClass(/notification-row read$/);
  await query('UPDATE notifications SET is_read=FALSE WHERE id=?',[unread]);await page.reload();await page.getByRole('button',{name:'Mark all read',exact:true}).click();await expect(page.locator('.notification-row.unread')).toHaveCount(0);await expect(page.getByRole('link',{name:'Notifications, 0 unread',exact:true})).toBeVisible();
  await page.goto(base+'/listings/'+listing);const gallery=page.getByRole('region',{name:'Listing photos'});
  for(let i=0;i<4;i++){await gallery.getByRole('button',{name:'View photo '+(i+1),exact:true}).click();await expect(gallery.getByRole('status')).toHaveText(`Photo ${i+1} of 4`);expect(await gallery.locator('.listing-gallery-main>img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);}
  await gallery.getByRole('button',{name:'Next photo',exact:true}).click();await expect(gallery.getByRole('status')).toHaveText('Photo 1 of 4');
  await gallery.focus();await page.keyboard.press('ArrowRight');await expect(gallery.getByRole('status')).toHaveText('Photo 2 of 4');
  if(width<600){await gallery.locator('.listing-gallery-main').dispatchEvent('touchstart',{touches:[{identifier:1,clientX:260,clientY:200}]});await gallery.locator('.listing-gallery-main').dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:100,clientY:205}]});await expect(gallery.getByRole('status')).toHaveText('Photo 3 of 4');}
  await page.screenshot({path:`test-results/workflows/gallery-${width}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.goto(base+'/past-papers?q='+encodeURIComponent(prefix));let failedDownloads=0;page.on('download',()=>failedDownloads++);
  await page.route('**/api/papers/'+paper+'/download',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Authentication required for test.'})}));
  await page.getByRole('button',{name:'Download '+prefix+' paper',exact:true}).click();await expect(page).toHaveURL(/\/login\?returnTo=/);expect(failedDownloads).toBe(0);
  await page.evaluate(token=>localStorage.setItem('acadex_access_token',token),createAccessToken(users[0]));await page.goto(base+'/past-papers?q='+encodeURIComponent(prefix));
  await page.unroute('**/api/papers/'+paper+'/download');await page.route('**/api/papers/'+paper+'/download',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.getByRole('button',{name:'Download '+prefix+' paper',exact:true}).click();await expect(page.getByRole('alert')).toContainText('The server did not return a PDF.');expect(failedDownloads).toBe(0);
  expect(errors).toEqual([]);await context.close();console.log('PASS: PDF download payload, failed-download protection, read-state persistence and four-photo gallery at '+width+'px');
 }
 expect((await query<any[]>('SELECT is_read FROM notifications WHERE id=?',[foreign]))[0].is_read).toBe(0);
 console.log('PASS: production security headers and notification ownership protection');
}finally{
 await browser.close();await query('DELETE FROM notifications WHERE user_id IN (?,?)',users.map(u=>u.id));await query('DELETE FROM past_papers WHERE id=?',[paper]);await query('DELETE FROM listing_images WHERE listing_id=?',[listing]);await query('DELETE FROM listings WHERE id=?',[listing]);
 for(const u of users)await query('DELETE FROM users WHERE id=?',[u.id]);await fs.unlink(path.join(config.paperDirectory,paper+'.pdf')).catch(()=>{});for(const image of images)await fs.unlink(path.join(config.uploadDirectory,image.name)).catch(()=>{});await pool.end();
}
