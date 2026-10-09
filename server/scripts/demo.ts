import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash,randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { chromium } from '@playwright/test';
import { pool,query } from '../db';
import { config } from '../config';

// Explicit local seed only: never run this from startup or deployment.
if(config.nodeEnv==='production')throw new Error('Demo seeding is disabled in production.');
const id=(key:string)=>{const h=createHash('sha256').update('acadex-demo-v1:'+key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
const credentialsPath=path.resolve('.demo-accounts.local.json');
type Account={email:string;password:string;role:string;name:string};
const accounts:Record<string,Account>={};
try {Object.assign(accounts,JSON.parse(await fs.readFile(credentialsPath,'utf8')));} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const definitions=[['admin','admin','Sample Administrator'],['student','student','Sample Student'],['leader','leader','Sample Group Leader'],['tutor','tutor','Sample Algorithms Tutor'],['math-tutor','tutor','Sample Calculus Tutor'],['english-tutor','tutor','Sample English Tutor']];
for(const [key,role,name] of definitions)accounts[key]??={email:`${key}@acadex.example`,password:randomBytes(18).toString('base64url'),role,name};
const courses=[
  {code:'1501371',title:'Algorithms',group:'Algorithm Masters',questions:['Explain the difference between O(n) and O(log n).','Trace binary search for 11 in [2, 5, 8, 11, 17, 23].','Write pseudocode for insertion sort. State its worst-case time complexity.']},
  {code:'1440131',title:'Calculus I',group:'Calculus Circle',questions:['Differentiate f(x) = 3x^3 - 2x + 7.','Evaluate the integral of 2x from 0 to 3.','Find the slope of the tangent to y = x^2 at x = 2.']},
  {code:'0202112',title:'Academic English',group:'Academic Writing Circle',questions:['Write a topic sentence for a paragraph about collaborative learning.','Explain the difference between a quotation and a paraphrase.','Write a 100-word summary of a course topic, using your own words.']},
];
async function seed() {
  const records=await query<any[]>('SELECT id,university_id,code FROM courses WHERE code IN (?,?,?)',courses.map(c=>c.code));
  if(records.length!==3)throw new Error('Run db:migrate and db:catalog first.');
  const university=records[0].university_id;
  await fs.writeFile(credentialsPath,JSON.stringify(accounts,null,2)+'\n',{mode:0o600});
    for(const [key] of definitions){
      const a=accounts[key];
      await query('INSERT IGNORE INTO users (id,name,email,password_hash,role,is_verified,verified_at) VALUES (?,?,?,?,?,TRUE,UTC_TIMESTAMP())',[id(key),a.name,a.email,await bcrypt.hash(a.password,12),a.role]);
    }
  if(process.argv.includes('--accounts-only')){console.log('Local demo accounts ready. Credentials are in .demo-accounts.local.json.');return;}
  await fs.mkdir(config.paperDirectory,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const connection=await pool.getConnection();
  try {
    const page=await browser.newPage({viewport:{width:794,height:1123}});
    for(const course of courses){
      const html=`<html><head><style>body{font:16px Arial;color:#172b40;padding:44px;line-height:1.6}h1{font-size:28px}li{margin:28px 0 65px}.sample{color:#76590b;font-weight:bold}footer{border-top:1px solid #ccc;padding-top:16px;font-size:12px}</style></head><body><p class="sample">ACADEX SAMPLE / PRACTICE ONLY</p><h1>${course.title}</h1><p>Course ${course.code} &nbsp; | &nbsp; Practice questions</p><p>Original demonstration material. This is not an official university exam.</p><ol>${course.questions.map(q=>`<li>${q}</li>`).join('')}</ol><footer>Prepared for testing the Acadex PDF download feature.</footer></body></html>`;
      await page.setContent(html);
      await page.pdf({path:path.join(config.paperDirectory,id('paper-'+course.code)+'.pdf'),format:'A4',printBackground:true});
      await fs.mkdir('test-results',{recursive:true});
      await page.screenshot({path:`test-results/sample-paper-${course.code}.png`,fullPage:true});
    }
    await connection.beginTransaction();
    const future=(days:number,hours=0)=>new Date(Date.now()+days*86400000+hours*3600000);
    for(const [index,course] of courses.entries()){
      const courseId=records.find(c=>c.code===course.code)!.id,group=id('group-'+course.code),tutor=id(['tutor','math-tutor','english-tutor'][index]);
      await connection.execute('INSERT IGNORE INTO past_papers (id,owner_id,course_id,title,academic_year,exam_type,file_name) VALUES (?,?,?,?,?,?,?)',[id('paper-'+course.code),id('leader'),courseId,`[Sample] ${course.title} Practice`,new Date().getFullYear(),'Practice',id('paper-'+course.code)+'.pdf']);
      await connection.execute('INSERT IGNORE INTO study_groups (id,owner_id,university_id,course_id,title,description) VALUES (?,?,?,?,?,?)',[group,id('leader'),university,courseId,`[Sample] ${course.group}`,'A sample study group for trying membership, chat, session notifications and recording links. The meeting and recording links are placeholders, not real sessions.']);
      for(const member of ['leader','student'])await connection.execute('INSERT IGNORE INTO group_members (group_id,user_id) VALUES (?,?)',[group,id(member)]);
      await connection.execute('INSERT INTO group_messages (group_id,user_id,body) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM group_messages WHERE group_id=?)',[group,id('leader'),'Welcome! This is a sample discussion. What topic would you like to review?',group]);
      await connection.execute('INSERT IGNORE INTO group_sessions (id,group_id,title,starts_at,ends_at,meeting_url) VALUES (?,?,?,?,?,?)',[id('session-'+course.code),group,'[Sample] Revision session - placeholder meeting',future(1+index),future(1+index,1),'https://example.com/']);
      await connection.execute('INSERT IGNORE INTO group_recordings (id,group_id,title,url) VALUES (?,?,?,?)',[id('recording-'+course.code),group,'[Sample] Recording placeholder (no video)','https://example.com/']);
      await connection.execute('INSERT IGNORE INTO tutor_profiles (user_id,university_id,subjects,bio,hourly_rate) VALUES (?,?,?,?,?)',[tutor,university,`${course.title} - ${course.code}`,'Sample tutor profile for testing availability, booking requests and acceptance. No real paid lessons are offered.',[80,65,50][index]]);
      for(let slot=0;slot<3;slot++)await connection.execute('INSERT IGNORE INTO tutor_slots (id,tutor_id,starts_at,ends_at,price) VALUES (?,?,?,?,?)',[id(`slot-${index}-${slot}`),tutor,future(2+index+slot),future(2+index+slot,1),[80,65,50][index]]);
    }
    await connection.execute('INSERT IGNORE INTO tutor_bookings (id,slot_id,student_id,status,note) VALUES (?,?,?,?,?)',[id('booking'),id('slot-0-0'),id('student'),'pending','Sample request: please help me revise binary search.']);
    for(const [index,event] of [['Global Day','global-day'],['Career Day','career-day'],['4th UoS International Dental Symposium','dental-symposium']].entries()){
      await connection.execute('INSERT IGNORE INTO campus_events (id,owner_id,university_id,title,description,location,starts_at,ends_at,image_key) VALUES (?,?,?,?,?,?,?,?,?)',[id('event-'+index),id('leader'),university,`[Sample] ${event[0]}`,'Demonstration event only. These dates and venues are fictional and are not an official university announcement.','Sample campus venue',future(7+index),future(7+index,3),event[1]]);
    }
    await connection.execute('INSERT IGNORE INTO notifications (id,user_id,title,href,dedupe_key) VALUES (?,?,?,?,?)',[id('notification'),id('tutor'),'Sample Student requested a tutoring session.','/dashboard','sample-booking']);
    await connection.commit();
    console.log('Sample content ready: 3 papers, 3 groups, 3 tutors, 9 slots, 3 events.');
    console.log('Private demo credentials: .demo-accounts.local.json (never commit or deploy).');
  }catch(error){await connection.rollback();throw error;}
  finally {connection.release();await browser.close();}
}
seed().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>pool.end());
