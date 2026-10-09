import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
test('academic tutor applications, student owners and complaint moderation',{skip:process.env.ROLES_INTEGRATION!=='1'},async()=>{
 const {default:express}=await import('express'),{pool,query}=await import('../db'),{createAccessToken}=await import('../auth'),{errorHandler}=await import('../errors');
 const users=['student','student','admin'].map(role=>({id:randomUUID(),role,name:'Role integration '+role,email:randomUUID()+'@example.test'}));
 const app=express();app.use(express.json());
 for(const name of ['groups','applications','reports']){const module=await import('../community/'+name+'.ts');app.use('/'+name,module.default);}
 app.use(errorHandler);const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+(server.address() as any).port,tokens=users.map(createAccessToken);
 let group='',application='';
 async function call(path:string,index:number,status:number,body?:any,method=body?'POST':'GET'){
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+tokens[index],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const data=await response.json();assert.equal(response.status,status,JSON.stringify({path,data}));return data;
 }
 try{
  for(const u of users)await query('INSERT INTO users (id,name,email,password_hash,role,is_verified) VALUES (?,?,?,?,?,TRUE)',[u.id,u.name,u.email,'disabled-test-account',u.role]);
  const [course]=await query<any[]>('SELECT id,university_id FROM courses LIMIT 1');assert.ok(course);
  const body={universityId:course.university_id,subjects:'Algorithms',experience:'Senior student with experience helping students revise algorithms.',academicTitle:'Final-year computing student',applicantType:'senior_student',teachingMode:'online',consent:'true'};
  await call('/applications',0,400,{...body,academicTitle:''});
  await call('/applications',0,201,body);
  const mine=(await call('/applications/mine',0,200)).application;application=mine.id;
  assert.equal(mine.academic_title,body.academicTitle);assert.equal('permit_file' in mine,false);
  await call('/applications',0,409,body);
  await call('/applications/'+application+'/review',1,403,{decision:'approved',reason:'Academic background reviewed.',confirmed:true},'PATCH');
  await call('/applications/'+application+'/review',2,200,{decision:'approved',reason:'Academic background reviewed.',confirmed:true},'PATCH');
  assert.equal((await query<any[]>('SELECT role FROM users WHERE id=?',[users[0].id]))[0].role,'tutor');
  group=(await call('/groups',1,201,{universityId:course.university_id,courseId:course.id,title:'Student-owned group',description:'A student-created study group for authorization testing.'})).id;
  assert.equal((await query<any[]>('SELECT role FROM users WHERE id=?',[users[1].id]))[0].role,'student');
  await call('/groups/'+group+'/join',0,200,{});
  await call('/groups/'+group+'/announcements',0,403,{body:'Not an owner announcement'});
  await call('/groups/'+group+'/announcements',1,201,{body:'Revision starts tomorrow; please bring your questions.'});
  assert.equal((await call('/groups/'+group+'/moderation',0,200)).announcements.length,1);
  await call('/groups/'+group+'/members/'+users[1].id,1,400,undefined,'DELETE');
  await call('/groups/'+group+'/members/'+users[0].id,0,403,undefined,'DELETE');
  await call('/groups/'+group+'/members/'+users[0].id,1,200,undefined,'DELETE');
  await call('/groups/'+group+'/room',0,403);
  await call('/groups/'+group+'/join',0,403,{});
  await call('/reports',1,201,{subject:'Sample group complaint',details:'A sample complaint about inappropriate group messages.'});
  await call('/reports',1,403);
  const report=(await call('/reports',2,200)).items.find((r:any)=>r.reporter_id===users[1].id);assert.ok(report);
  await call('/reports/'+report.id,1,403,{status:'resolved',resolution:'Reviewed complaint.'},'PATCH');
  await call('/reports/'+report.id,2,200,{status:'resolved',resolution:'Reviewed complaint and contacted the group owner.'},'PATCH');
 }finally{
  if(group)await query('DELETE FROM study_groups WHERE id=?',[group]);
  if(application){await query('DELETE FROM tutor_application_audit WHERE application_id=?',[application]);await query('DELETE FROM tutor_applications WHERE id=?',[application]);}
  for(const u of users){await query('DELETE FROM reports WHERE reporter_id=?',[u.id]);await query('DELETE FROM notifications WHERE user_id=?',[u.id]);}
  for(const u of users)await query('DELETE FROM users WHERE id=?',[u.id]);
  await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();
 }
});
