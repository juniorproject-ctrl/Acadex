import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import {pool,query} from '../db';
import {createAccessToken} from '../auth';

const base=process.env.TEST_BASE_URL||'http://localhost:3022';
const users=['tutor','student','student'].map((role,i)=>({id:randomUUID(),name:'Booking QA '+i,email:randomUUID()+'@example.test',role}));
const slots=Array.from({length:4},()=>randomUUID()),bookings:string[]=[],prefix='Booking QA '+randomUUID().slice(0,6);
const api=async(index:number|null,path:string,body?:unknown,method=body?'POST':'GET')=>{
 const r=await fetch(base+'/api'+path,{method,headers:{...(index===null?{}:{Authorization:'Bearer '+createAccessToken(users[index])}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return {status:r.status,data:await r.json()};
};
const browser=await chromium.launch({headless:true});
try{
 await fs.mkdir('test-results/bookings',{recursive:true});
 for(const u of users)await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[u.id,u.name,u.email,'disabled-booking-qa',u.role]);
 const [university]=await query<any[]>('SELECT id FROM universities LIMIT 1');
 await query('INSERT INTO tutor_profiles (user_id,university_id,subjects,bio,hourly_rate) VALUES (?,?,?,?,50)',[users[0].id,university.id,'Operating Systems','A temporary tutor profile used for private booking workflow checks.']);
 for(const [i,id] of slots.entries())await query('INSERT INTO tutor_slots (id,tutor_id,starts_at,ends_at,price) VALUES (?,?,?,?,50)',[id,users[0].id,new Date(Date.now()+(12+i*2)*3600000),new Date(Date.now()+(13+i*2)*3600000)]);
 for(const [i,slot] of slots.entries()){
  const result=await api(i===2?2:1,'/tutors/slots/'+slot+'/book',{note:prefix+' note '+i});expect(result.status).toBe(201);bookings.push(result.data.id);
  const links=await query<any[]>('SELECT href FROM notifications WHERE href=?',['/bookings/'+result.data.id]);expect(links.length).toBe(2);
 }
 const primary=bookings[0];
 for(const index of [0,1])expect((await api(index,'/account/bookings/'+primary)).status).toBe(200);
 expect((await api(null,'/account/bookings/'+primary)).status).toBe(401);
 expect((await api(2,'/account/bookings/'+primary)).status).toBe(404);
 expect((await api(1,'/account/bookings/'+randomUUID())).status).toBe(404);
 expect((await api(1,'/tutors/bookings/'+primary,{status:'accepted',meetingUrl:'https://teams.microsoft.com/qa'},'PATCH')).status).toBe(403);
 expect((await api(0,'/tutors/bookings/'+bookings[1],{status:'declined'},'PATCH')).status).toBe(200);
 expect((await api(0,'/tutors/slots/'+slots[2],undefined,'DELETE')).status).toBe(200);
 expect((await api(1,'/tutors/bookings/'+bookings[3],{status:'cancelled'},'PATCH')).status).toBe(200);
 expect((await api(2,'/account/bookings/'+bookings[2])).data.booking.status).toBe('cancelled');
 for(const id of bookings){const updates=await query<any[]>("SELECT href FROM notifications WHERE href=?",['/bookings/'+id]);expect(updates.length).toBeGreaterThanOrEqual(2);}
 const contextFor=async(index:number,width:number)=>{
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600});
  await context.addInitScript(({user,token})=>{localStorage.setItem('acadex_session_user',JSON.stringify(user));localStorage.setItem('acadex_access_token',token);},{user:users[index],token:createAccessToken(users[index])});
  const page=await context.newPage();return {context,page};
 };
 for(const width of [1440,390]){
  await query("UPDATE tutor_bookings SET status='pending',meeting_url=NULL WHERE id=?",[primary]);
  const student=await contextFor(1,width),tutor=await contextFor(0,width),errors:string[]=[];
  student.page.on('pageerror',e=>errors.push(e.message));tutor.page.on('pageerror',e=>errors.push(e.message));
  await student.page.goto(base+'/notifications');await student.page.locator(`.notification-row[href="/bookings/${primary}"]`).filter({hasText:'Booking requested.'}).click();
  await expect(student.page).toHaveURL(base+'/bookings/'+primary);await expect(student.page.getByRole('heading',{name:'Booking details',exact:true})).toBeVisible();
  await expect(student.page.getByText('Waiting for the tutor to respond.',{exact:false})).toBeVisible();await expect(student.page.getByText(prefix+' note 0',{exact:true})).toBeVisible();
  await expect(student.page.getByText(prefix+' note 1',{exact:true})).toHaveCount(0);await expect(student.page.locator('.booking-row')).toHaveCount(1);
  await student.page.screenshot({path:`test-results/bookings/student-pending-${width}.png`,fullPage:true});
  await tutor.page.goto(base+'/notifications');await tutor.page.locator(`.notification-row[href="/bookings/${primary}"]`).filter({hasText:'New tutoring booking request.'}).click();
  await expect(tutor.page).toHaveURL(base+'/bookings/'+primary);await tutor.page.getByRole('textbox',{name:'Teams / meeting link',exact:true}).fill('https://teams.microsoft.com/l/meetup-join/'+primary);
  await tutor.page.getByRole('button',{name:'Accept',exact:true}).click();await expect(tutor.page.locator('.status-badge')).toHaveText('accepted');
  await expect(tutor.page.getByRole('link',{name:'Open meeting',exact:true})).toBeVisible();await tutor.page.screenshot({path:`test-results/bookings/tutor-accepted-${width}.png`,fullPage:true});
  await student.page.reload();await expect(student.page.locator('.status-badge')).toHaveText('accepted');await expect(student.page.getByRole('link',{name:'Pay for session',exact:true})).toBeVisible();await expect(student.page.getByRole('link',{name:'Open meeting',exact:true})).toHaveCount(0);
  expect((await api(1,'/account/bookings/'+primary)).data.booking.meetingUrl).toBeNull();expect((await api(0,'/account/bookings/'+primary)).data.booking.meetingUrl).toContain(primary);
  const reminders=(await api(1,'/account/notifications')).data.items.filter(n=>n.title.includes('within 24 hours'));expect(reminders.some(n=>n.href==='/bookings/'+primary)).toBe(true);
  await student.page.goto(base+'/bookings/'+bookings[1]);await expect(student.page.locator('.status-badge')).toHaveText('declined');
  expect(await student.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);await student.context.close();await tutor.context.close();
  console.log('PASS: booking notification opens one booking; tutor accepts it; student payment gate and privacy hold at '+width+'px');
 }
 const c=await pool.getConnection();
 try{
  await c.query('CREATE TEMPORARY TABLE notifications (id VARCHAR(36),user_id VARCHAR(36),href VARCHAR(200),dedupe_key VARCHAR(180))');
  await c.query('CREATE TEMPORARY TABLE tutor_bookings (id VARCHAR(36),slot_id VARCHAR(36),student_id VARCHAR(36))');
  await c.query('CREATE TEMPORARY TABLE tutor_slots (id VARCHAR(36),tutor_id VARCHAR(36))');
  await c.query("INSERT INTO tutor_slots VALUES ('slot','tutor')");await c.query("INSERT INTO tutor_bookings VALUES ('booking','slot','student')");
  await c.query("INSERT INTO notifications VALUES ('owned','student','/dashboard','booking:booking'),('foreign','outsider','/dashboard','booking:booking'),('generic','student','/dashboard',NULL)");
  const sql=await fs.readFile('server/migrations/013_booking_notification_links.sql','utf8');await c.query(sql);await c.query(sql);
  const [rows]=await c.query<any[]>('SELECT id,href FROM notifications ORDER BY id');expect(rows.map(r=>[r.id,r.href])).toEqual([['foreign','/dashboard'],['generic','/dashboard'],['owned','/bookings/booking']]);
 }finally{for(const name of ['notifications','tutor_bookings','tutor_slots'])await c.query('DROP TEMPORARY TABLE IF EXISTS '+name);c.release();}
 console.log('PASS: legacy reminder migration is repeatable and never guesses generic or unrelated notification targets');
}finally{
 await browser.close();for(const u of users)await query('DELETE FROM notifications WHERE user_id=?',[u.id]);
 for(const id of bookings)await query('DELETE FROM tutor_bookings WHERE id=?',[id]);for(const id of slots)await query('DELETE FROM tutor_slots WHERE id=?',[id]);
 await query('DELETE FROM tutor_profiles WHERE user_id=?',[users[0].id]);for(const u of users)await query('DELETE FROM users WHERE id=?',[u.id]);await pool.end();
}
