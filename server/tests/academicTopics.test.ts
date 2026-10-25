import test from 'node:test';
import assert from 'node:assert/strict';
import {majorTopic,courseTopic,simpleAcademicOptions} from '../../src/lib/academicTopics';

test('degree variants become simple major labels',()=>{
  for(const name of ['Computer Science','Bachelor of Science in Computer Science','Bachelor of Computer Science'])assert.equal(majorTopic(name),'cs');
  assert.equal(majorTopic('Bachelor of Dental Surgery'),'dentistry');
  assert.equal(majorTopic('Bachelor of Physiotherapy'),'physio');
  assert.equal(majorTopic('Bachelor of Science in Artificial Intelligence'),'ai');
});
test('basic course names omit codes and group introductory variants',()=>{
  assert.equal(courseTopic('Introduction to Programming'),'Programming');
  assert.equal(courseTopic('Programming I'),'Programming');
  assert.equal(courseTopic('Digital Logic'),'Digital Logic Design');
  assert.equal(courseTopic('Human Anatomy'),'Anatomy');
});
test('simple filters merge records across universities without losing IDs',()=>{
  const data={
    majors:[{id:'one',name:'Bachelor of Science in Computer Science',universityId:'uos'},{id:'two',name:'Computer Science',universityId:'uos'},{id:'three',name:'Computer Science',universityId:'aus'}],
    courses:[{id:'a',name:'Introduction to Programming',universityId:'uos',majorIds:['one'],isShared:false},{id:'b',name:'Programming I',universityId:'aus',majorIds:['three'],isShared:false}]
  };
  const all=simpleAcademicOptions(data,'','topic:cs');
  assert.deepEqual(all.majors.find(m=>m.id==='topic:cs')?.ids,['one','two','three']);
  assert.deepEqual(all.courses.find(c=>c.name==='Programming')?.ids,['a','b']);
  assert.equal(new Set(all.majors.map(m=>m.name)).size,all.majors.length);
  assert.equal(new Set(all.courses.map(c=>c.name)).size,all.courses.length);
  const scoped=simpleAcademicOptions(data,'uos','topic:cs');
  assert.deepEqual(scoped.courses.find(c=>c.name==='Programming')?.ids,['a']);
  assert.ok(all.courses.some(c=>c.name==='Operating Systems'));
  assert.ok(all.courses.some(c=>c.name==='Cloud Computing'));
});
