import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pool,query} from '../db';
import {config} from '../config';
import {createAccessToken} from '../auth';

const base=process.env.TEST_BASE_URL||'http://localhost:3023',prefix='Guest QA '+randomUUID().slice(0,6),password='TemporaryGuestTest!123';
const users=['student','tutor'].map((role,i)=>({id:randomUUID(),name:'Guest QA user '+i,email:randomUUID()+'@university.ac.ae',role}));
const listing=randomUUID(),draft=randomUUID(),hidden=randomUUID(),group=randomUUID(),session=randomUUID(),paper=randomUUID(),event=randomUUID(),slot=randomUUID(),booking=randomUUID();
const secrets='PRIVATE GROUP CONTENT '+randomUUID();
const request=async(route:string,method='GET',body?:unknown,token?:string)=>{
 const response=await fetch(base+'/api'+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,data:await response.json()};
};
const browser=await chromium.launch({headless:true});
try{
 await fs.mkdir('test-results/guests',{recursive:true});await fs.mkdir(config.paperDirectory,{recursive:true});
 for(const u of users)await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[u.id,u.name,u.email,await bcrypt.hash(password,12),u.role]);
 const [course]=await query<any[]>('SELECT id,university_id FROM courses LIMIT 1');
 for(const [id,status,isHidden] of [[listing,'ACTIVE',false],[draft,'DRAFT',false],[hidden,'ACTIVE',true]])await query('INSERT INTO listings (id,owner_id,title,description,price,category,item_condition,location,status,is_hidden) VALUES (?,?,?,?,50,?,?,?,?,?)',[id,users[1].id,prefix+' '+id,'A listing for public browsing boundary tests.','Textbooks','Good','Sharjah',status,isHidden]);
 await query('INSERT INTO listing_images (id,listing_id,image_url,position) VALUES (?,?,?,0)',[randomUUID(),listing,'/assets/acadex-logo.png']);
 await query('INSERT INTO study_groups (id,owner_id,university_id,course_id,title,description) VALUES (?,?,?,?,?,?)',[group,users[1].id,course.university_id,course.id,prefix+' group','A public group description for guest browsing tests.']);
 await query('INSERT INTO group_members (group_id,user_id) VALUES (?,?)',[group,users[1].id]);
 await query('INSERT INTO group_sessions (id,group_id,title,starts_at,ends_at,meeting_url) VALUES (?,?,?,?,?,?)',[session,group,secrets,new Date(Date.now()+86400000),new Date(Date.now()+90000000),'https://teams.microsoft.com/private-group-qa']);
 await query('INSERT INTO group_messages (group_id,user_id,body) VALUES (?,?,?)',[group,users[1].id,secrets]);
 await query('INSERT INTO tutor_profiles (user_id,university_id,subjects,bio,hourly_rate) VALUES (?,?,?,?,0)',[users[1].id,course.university_id,prefix+' tutoring','A tutor profile that visitors can browse before signing in.']);
 await query('INSERT INTO tutor_slots (id,tutor_id,starts_at,ends_at,price) VALUES (?,?,?,?,0)',[slot,users[1].id,new Date(Date.now()+90000000),new Date(Date.now()+93600000)]);
 await query('INSERT INTO tutor_bookings (id,slot_id,student_id,note,status) VALUES (?,?,?,?,?)',[booking,slot,users[0].id,secrets,'cancelled']);
 await query('INSERT INTO past_papers (id,owner_id,course_id,title,academic_year,exam_type,file_name) VALUES (?,?,?,?,2026,?,?)',[paper,users[1].id,course.id,prefix+' paper','Practice',paper+'.pdf']);
 await fs.writeFile(path.join(config.paperDirectory,paper+'.pdf'),'%PDF-1.4\nGuest QA fixture\n%%EOF');
 await query('INSERT INTO campus_events (id,owner_id,university_id,title,description,location,starts_at,ends_at) VALUES (?,?,?,?,?,?,?,?)',[event,users[1].id,course.university_id,prefix+' event','A campus event that visitors can read without signing in.','Campus hall',new Date(Date.now()+86400000),new Date(Date.now()+90000000)]);
 for(const route of ['/catalog','/listings','/listings/'+listing,'/papers','/groups','/groups/'+group,'/tutors','/tutors/'+users[1].id,'/events','/events/'+event]){
  const r=await request(route);expect(r.status,route).toBe(200);expect(JSON.stringify(r.data)).not.toContain(secrets);
 }
 for(const id of [draft,hidden])expect((await request('/listings/'+id)).status).toBe(404);
 for(const route of ['/listings/mine','/papers/'+paper+'/download','/groups/'+group+'/room','/groups/'+group+'/messages','/groups/'+group+'/members','/account/dashboard','/account/notifications','/account/bookings/'+booking,'/messages','/admin/users'])expect((await request(route)).status,route).toBe(401);
 for(const [route,method] of [['/listings','POST'],['/listings/'+listing,'PATCH'],['/listings/'+listing,'DELETE'],['/papers','POST'],['/groups','POST'],['/groups/'+group+'/join','POST'],['/tutors/slots/'+slot+'/book','POST'],['/events','POST'],['/messages','POST'],['/reports','POST'],['/feedback','POST'],['/support','POST']])expect((await request(route,method,{})).status,route).toBe(401);
 console.log('PASS: guest public reads succeed; private reads, all submissions, drafts and hidden listings remain protected');
 const login=async(page:any)=>{await page.getByLabel('Email',{exact:true}).fill(users[0].email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign In',exact:true}).click();};
 const expectLogin=async(page:any,returnTo:string)=>{await expect(page).toHaveURL(/\/login\?returnTo=/);expect(new URL(page.url()).searchParams.get('returnTo')).toBe(returnTo);};
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600}),page=await context.newPage(),errors:string[]=[],privateRequests:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/api\/(account|messages|admin)/.test(r.url()))privateRequests.push(r.url());});
  await page.goto(base+'/');await expect(page.getByRole('heading',{name:'Your Campus Marketplace',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
  await page.screenshot({path:`test-results/guests/home-${width}.png`,fullPage:true});
  for(const route of ['/browse?search='+encodeURIComponent(prefix),'/listings/'+listing,'/community','/past-papers?q='+encodeURIComponent(prefix),'/study-groups/'+group,'/tutors/'+users[1].id,'/events/'+event]){
   await page.goto(base+route);await expect(page).toHaveURL(base+route);await expect(page.getByRole('alert')).toHaveCount(0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  expect(privateRequests).toEqual([]);
  await page.goto(base+'/listings/'+listing);await page.getByRole('button',{name:'Chat with seller',exact:true}).click();await expectLogin(page,'/listings/'+listing);
  await page.goto(base+'/listings/'+listing);await page.getByRole('link',{name:'Buy item',exact:true}).click();await expectLogin(page,'/checkout?kind=listing&reference='+listing);
  for(const route of ['/past-papers?q='+encodeURIComponent(prefix),'/community','/search?q='+encodeURIComponent(prefix)]){
   await page.goto(base+route);await page.getByRole('button',{name:'Download '+prefix+' paper',exact:true}).click();await expectLogin(page,route);
  }
  await page.goto(base+'/past-papers');await page.getByRole('link',{name:'Upload paper',exact:true}).click();await expectLogin(page,'/past-papers?upload=1');
  await page.goto(base+'/study-groups');await page.getByRole('button',{name:'Create group',exact:true}).click();await expectLogin(page,'/study-groups?create=1');
  await page.goto(base+'/tutors/'+users[1].id);await page.locator('.slot-option').first().click();await expectLogin(page,'/tutors/'+users[1].id+'?slot='+slot);await login(page);
  await expect(page).toHaveURL(base+'/tutors/'+users[1].id+'?slot='+slot);await expect(page.getByRole('button',{name:'Request booking',exact:true})).toBeVisible();
  await context.close();
  const second=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600}),p=await second.newPage();
  await p.goto(base+'/post');await expectLogin(p,'/post');await login(p);await expect(p).toHaveURL(base+'/post');await expect(p.getByRole('heading',{name:'Create New Listing',exact:true})).toBeVisible();
  await p.evaluate(()=>localStorage.clear());await p.goto(base+'/study-groups/'+group);await p.getByRole('link',{name:'Join group',exact:true}).click();await expectLogin(p,'/study-groups/'+group);await login(p);
  await expect(p).toHaveURL(base+'/study-groups/'+group);await p.getByRole('button',{name:'Join group',exact:true}).click();await expect(p.getByRole('button',{name:'Leave group',exact:true})).toBeVisible();
  await query('DELETE FROM group_members WHERE group_id=? AND user_id=?',[group,users[0].id]);await second.close();
  const third=await browser.newContext({viewport:{width,height:900}}),privatePage=await third.newPage();
  for(const route of ['/dashboard','/messages','/notifications','/settings','/my-listings','/my-reports','/admin','/bookings/'+booking]){await privatePage.goto(base+route);await expectLogin(privatePage,route);}
  await privatePage.goto(base+'/feedback');await expect(privatePage.getByRole('link',{name:'Sign in to share feedback',exact:true})).toBeVisible();await expect(privatePage.locator('textarea')).toHaveCount(0);
  await privatePage.goto(base+'/contact');await expect(privatePage.getByRole('link',{name:'Sign in to contact us',exact:true})).toBeVisible();await third.close();expect(errors).toEqual([]);
  console.log('PASS: public browsing, action redirects, login return-to posting/booking/group pages, and private-page guards at '+width+'px');
 }
 const token=createAccessToken(users[0]);expect((await request('/groups/'+group+'/join','POST',undefined,token)).status).toBe(200);expect((await request('/groups/'+group+'/room','GET',undefined,token)).status).toBe(200);
}finally{
 await browser.close();await query('DELETE FROM tutor_bookings WHERE id=?',[booking]);await query('DELETE FROM tutor_slots WHERE id=?',[slot]);await query('DELETE FROM tutor_profiles WHERE user_id=?',[users[1].id]);
 await query('DELETE FROM group_messages WHERE group_id=?',[group]);await query('DELETE FROM group_sessions WHERE group_id=?',[group]);await query('DELETE FROM group_members WHERE group_id=?',[group]);await query('DELETE FROM study_groups WHERE id=?',[group]);
 await query('DELETE FROM past_papers WHERE id=?',[paper]);await fs.unlink(path.join(config.paperDirectory,paper+'.pdf')).catch(()=>{});await query('DELETE FROM campus_events WHERE id=?',[event]);await query('DELETE FROM listing_images WHERE listing_id=?',[listing]);
 for(const id of [listing,draft,hidden])await query('DELETE FROM listings WHERE id=?',[id]);for(const u of users){await query('DELETE FROM notifications WHERE user_id=?',[u.id]);await query('DELETE FROM users WHERE id=?',[u.id]);}await pool.end();
}
