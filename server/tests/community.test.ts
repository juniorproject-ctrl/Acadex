import assert from 'node:assert/strict';
import test from 'node:test';
import { searchDestination } from '../../src/lib/search';
import { validateRegistration } from '../validation';

test('home search routes category terms and keeps specific course terms',()=>{
  assert.equal(searchDestination('textbook'),'/browse?category=Textbooks');
  assert.equal(searchDestination('calculus textbook'),'/browse?category=Textbooks&search=calculus');
  assert.equal(searchDestination('algorithms','Past Papers'),'/past-papers?q=algorithms');
  assert.equal(searchDestination('past papers algorithms'),'/past-papers?q=algorithms');
  assert.equal(searchDestination('calculus tutor'),'/tutors?q=calculus');
  assert.equal(searchDestination('study groups'),'/study-groups');
  assert.equal(searchDestination('campus events'),'/events');
  assert.equal(searchDestination('laptop'),'/search?q=laptop');
});
test('registration creates students only; privileged roles require approval',()=>{
  const input={name:'Test User',email:'test@sharjah.ac.ae',password:'Valid123!'};
  assert.equal(validateRegistration(input).role,'student');
  assert.throws(()=>validateRegistration({...input,role:'Tutor'}));
  assert.throws(()=>validateRegistration({...input,role:'Study Group Leader'}));
  assert.throws(()=>validateRegistration({...input,role:'Admin'}));
  assert.throws(()=>validateRegistration({...input,role:'admin'}));
});

test('community database workflows and authorization',{skip:process.env.COMMUNITY_INTEGRATION!=='1'},async(t)=>{
  const {default:express}=await import('express');
  const {randomUUID}=await import('node:crypto');
  const {pool,query}=await import('../db');
  const {createAccessToken}=await import('../auth');
  const {errorHandler}=await import('../errors');
  const app=express();app.use(express.json());
  for(const [prefix,file] of [['groups','groups'],['tutors','tutors'],['papers','papers'],['events','events'],['account','account'],['catalog','catalog']]) {
    const module=await import('../community/'+file+'.ts');app.use('/api/'+prefix,module.default);
  }
  app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+(server.address() as any).port+'/api';
  const people=['student','student','tutor','leader','student'].map((role,i)=>({id:randomUUID(),name:'Community test '+i,email:randomUUID()+'@example.test',role}));
  const tokens=people.map(createAccessToken);
  let groupId='',paperId='',eventId='';
  const catalogEntries:string[]=[];
  const call=async(path:string,who:number|null=null,body?:any,method=body===undefined?'GET':'POST')=>{
    const response=await fetch(base+path,{method,headers:{...(who!==null?{Authorization:'Bearer '+tokens[who]}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
    const data=response.headers.get('content-type')?.includes('json')?await response.json():await response.text();
    return {status:response.status,data};
  };
  const expect=async(path:string,who:number|null,status:number,body?:any,method?:string)=>{const result=await call(path,who,body,method);assert.equal(result.status,status,JSON.stringify({path,...result}));return result.data;};
  try {
    for(let i=0;i<people.length;i++)await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,?)',[people[i].id,people[i].name,people[i].email,'disabled-test-account',people[i].role,i!==4]);
    const catalog=await expect('/catalog',null,200);
    const course=catalog.courses.find((c:any)=>c.code==='1501371');assert.ok(course,'Run db:catalog first');
    const groupBody={title:'Test Algorithms Group',description:'A database integration test group for algorithms.',universityId:'uos',courseId:course.id};
    await t.test('account settings validate name and cannot change role, email or another user',async()=>{
      await expect('/account/profile',null,401,{name:'Changed'},'PATCH');
      await expect('/account/profile',4,401,{name:'Changed'},'PATCH');
      await expect('/account/profile',0,400,{name:' '},'PATCH');
      await expect('/account/profile',0,400,{name:'x'.repeat(101)},'PATCH');
      const updated=await expect('/account/profile',0,200,{name:'Updated Student',role:'admin',email:'other@example.test',id:people[1].id},'PATCH');
      assert.equal(updated.user.name,'Updated Student');
      assert.equal(updated.user.role,'student');assert.equal(updated.user.email,people[0].email);
      const [other]=await query<any[]>('SELECT name FROM users WHERE id=?',[people[1].id]);
      assert.equal(other.name,people[1].name);
    });
    await t.test('missing-course catalogue entries enforce role, university and official-domain source',async()=>{
      const entry={universityId:'uos',majorId:'uos-computer-science',code:'QA-'+randomUUID().slice(0,8),name:'Temporary test course',sourceUrl:'https://www.sharjah.ac.ae/academics/degree/undergraduate/computer-science'};
      await expect('/catalog/entries',0,403,entry);
      await expect('/catalog/entries',3,400,{...entry,sourceUrl:'https://example.com/curriculum'});
      await expect('/catalog/entries',3,400,{...entry,majorId:'invalid-major'});
      const added=await expect('/catalog/entries',3,201,entry);catalogEntries.push(added.id);
      const duplicate=await expect('/catalog/entries',3,201,{...entry,name:'Must not replace the original name'});assert.equal(duplicate.id,added.id);
      const updated=await expect('/catalog',null,200);assert.equal(updated.courses.find((c:any)=>c.id===added.id).name,entry.name);
    });
    await t.test('roles and verified-account enforcement',async()=>{
      await expect('/groups',null,401,groupBody);
      const studentGroup=(await expect('/groups',0,201,groupBody)).id;
      assert.equal((await expect('/groups/'+studentGroup,0,200)).ownerId,people[0].id);
      await query('DELETE FROM study_groups WHERE id=?',[studentGroup]);
      await expect('/groups',4,401,groupBody);
      groupId=(await expect('/groups',3,201,groupBody)).id;
      await expect('/groups/'+groupId+'/room',0,403);
      await expect('/groups/'+groupId+'/join',0,200,{});
      await expect('/groups/'+groupId+'/join',0,200,{});
      const g=await expect('/groups/'+groupId,null,200);assert.equal(g.members,2);
      await expect('/groups/'+groupId+'/messages',1,403,{body:'Not a member'});
      await expect('/groups/'+groupId+'/messages',0,201,{body:'How does quicksort work?'});
      const chat=await expect('/groups/'+groupId+'/messages',3,200);assert.equal(chat.messages[0].body,'How does quicksort work?');
    });
    const startsAt=new Date(Date.now()+3600_000).toISOString(),endsAt=new Date(Date.now()+7200_000).toISOString();
    await t.test('group leader sessions, recordings and notifications',async()=>{
      const session={title:'Algorithms review',startsAt,endsAt,meetingUrl:'https://teams.microsoft.com/l/meetup-join/test'};
      await expect('/groups/'+groupId+'/sessions',0,403,session);
      await expect('/groups/'+groupId+'/sessions',3,400,{...session,meetingUrl:'javascript:alert(1)'});
      await expect('/groups/'+groupId+'/sessions',3,201,session);
      const room=await expect('/groups/'+groupId+'/room',0,200);assert.equal(room.sessions.length,1);
      await expect('/groups/'+groupId+'/recordings',3,201,{title:'Lesson one',url:'https://example.com/recording'});
      const notifications=await expect('/account/notifications',0,200);assert.ok(notifications.unread>=2);
      const second=await expect('/account/notifications',0,200);assert.equal(second.items.length,notifications.items.length,'reminders are deduplicated');
      await expect('/groups/'+groupId+'/sessions/'+room.sessions[0].id,3,200,undefined,'DELETE');
      await expect('/groups/'+groupId+'/join',0,200,undefined,'DELETE');
      await expect('/groups/'+groupId+'/messages',0,403);
    });
    let slotId='',bookingId='';
    await t.test('availability validates price, times and overlaps',async()=>{
      const profile={universityId:'uos',subjects:'Algorithms',bio:'Tutoring algorithms and data structures for university students.',hourlyRate:100};
      await expect('/tutors/profile',0,403,profile,'PUT');
      await expect('/tutors/profile',2,200,profile,'PUT');
      await expect('/tutors/slots',2,400,{startsAt,endsAt,price:-1});
      await expect('/tutors/slots',2,400,{startsAt:endsAt,endsAt:startsAt,price:100});
      slotId=(await expect('/tutors/slots',2,201,{startsAt,endsAt,price:100})).id;
      await expect('/tutors/slots',2,409,{startsAt,endsAt,price:100});
    });
    await t.test('only one student can reserve a slot; accept, cancel, decline',async()=>{
      await expect('/tutors/slots/'+slotId+'/book',2,400,{});
      const first=await call('/tutors/slots/'+slotId+'/book',0,{note:'Algorithms please'});
      assert.equal(first.status,201);bookingId=first.data.id;
      await expect('/tutors/slots/'+slotId+'/book',1,409,{});
      await expect('/tutors/bookings/'+bookingId,1,403,{status:'accepted',meetingUrl:'https://example.com/meeting'},'PATCH');
      await expect('/tutors/bookings/'+bookingId,0,403,{status:'accepted',meetingUrl:'https://example.com/meeting'},'PATCH');
      await expect('/tutors/bookings/'+bookingId,2,200,{status:'accepted',meetingUrl:'https://example.com/meeting'},'PATCH');
      const dashboard=await expect('/account/dashboard',0,200);assert.equal(dashboard.bookings[0].status,'accepted');assert.equal(dashboard.bookings[0].meetingUrl,null,'Paid meeting link remains locked until payment is verified');
      await expect('/tutors/bookings/'+bookingId,0,200,{status:'cancelled'},'PATCH');
      const second=await expect('/tutors/slots/'+slotId+'/book',1,201,{});
      await expect('/tutors/bookings/'+second.id,2,200,{status:'declined'},'PATCH');
      const third=await expect('/tutors/slots/'+slotId+'/book',0,201,{});assert.ok(third.id);
      await expect('/tutors/slots/'+slotId,2,200,undefined,'DELETE');
      const cancelled=await expect('/account/dashboard',0,200);assert.ok(cancelled.bookings.every((b:any)=>b.status==='cancelled'));
    });
    await t.test('PDF validation, download and ownership',async()=>{
      const body=new FormData();body.set('title','Algorithms practice');body.set('courseId',course.id);body.set('academicYear','2026');body.set('examType','Practice');body.set('permission','true');body.set('file',new Blob(['not a PDF'],{type:'application/pdf'}),'paper.pdf');
      await expect('/papers',0,400,body);
      body.set('file',new Blob(['%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF'],{type:'application/pdf'}),'paper.pdf');
      paperId=(await expect('/papers',0,201,body)).id;
      const list=await expect('/papers?university=uos&major=uos-computer-science&q=1501371',null,200);assert.ok(list.items.some((p:any)=>p.id===paperId));
      const pdf=await expect('/papers/'+paperId+'/download',null,200);assert.ok(pdf.startsWith('%PDF-'));
      await expect('/papers/'+paperId,1,404,undefined,'DELETE');
      await expect('/papers/'+paperId,0,200,undefined,'DELETE');paperId='';
    });
    await t.test('events provide details and owner-only edits',async()=>{
      const body={universityId:'uos',title:'Test campus workshop',description:'An integration test event with informational attendance details.',location:'University of Sharjah, test room',startsAt,endsAt,imageKey:'campus'};
      await expect('/events',0,403,body);
      eventId=(await expect('/events',3,201,body)).id;
      const event=await expect('/events/'+eventId,null,200);assert.equal(event.location,body.location);
      await expect('/events/'+eventId,2,403,{cancelled:true},'PATCH');
      await expect('/events/'+eventId,3,200,{cancelled:true},'PATCH');
      await expect('/account/notifications/read',0,200,undefined,'PATCH');
      const notifications=await expect('/account/notifications',0,200);assert.equal(notifications.unread,0);
    });
  } finally {
    if(paperId)await call('/papers/'+paperId,0,undefined,'DELETE');
    if(groupId)await query('DELETE FROM study_groups WHERE id=?',[groupId]);
    if(eventId)await query('DELETE FROM campus_events WHERE id=?',[eventId]);
    for(const id of catalogEntries){await query('DELETE FROM course_majors WHERE course_id=?',[id]);await query('DELETE FROM courses WHERE id=?',[id]);}
    try {
      for(const person of people) await query('DELETE b FROM tutor_bookings b JOIN tutor_slots s ON s.id=b.slot_id WHERE s.tutor_id=?',[person.id]);
      for(const person of people) {
        await query('DELETE FROM tutor_slots WHERE tutor_id=?',[person.id]);
        await query('DELETE FROM tutor_profiles WHERE user_id=?',[person.id]);
        await query('DELETE FROM users WHERE id=?',[person.id]);
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
      await pool.end();
    }
  }
});
