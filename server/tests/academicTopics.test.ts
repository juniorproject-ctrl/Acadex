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
  assert.ok(!all.courses.some(c=>c.name==='Cloud Computing'));
});

test('published university choices exclude unsupported starter degrees and courses',()=>{
  const data={majors:[
    {id:'cs',universityId:'aus',name:'Bachelor of Science in Computer Science',sourceUrl:'https://www.aus.edu/cs'},
    {id:'old-cs',universityId:'aus',name:'Computer Science',sourceUrl:''},
    {id:'old-nursing',universityId:'aus',name:'Nursing',sourceUrl:''},
    {id:'nursing',universityId:'ajman',name:'Bachelor of Science in Nursing (BSN)',sourceUrl:'https://www.ajman.ac.ae/nursing'}
  ],courses:[
    {id:'prog',universityId:'aus',name:'Programming I',sourceUrl:'https://www.aus.edu/cs',majorIds:['cs'],isShared:false},
    {id:'old-prog',universityId:'aus',name:'Programming',sourceUrl:'',majorIds:['old-cs'],isShared:false},
    {id:'cloud',universityId:'aus',name:'Cloud Computing',sourceUrl:'',majorIds:['old-cs'],isShared:false},
    {id:'anat',universityId:'ajman',name:'Human Anatomy',sourceUrl:'https://www.ajman.ac.ae/nursing',majorIds:['nursing'],isShared:false}
  ]};
  const aus=simpleAcademicOptions(data,'aus','topic:cs');
  assert.deepEqual(aus.majors.map(m=>m.name),['Computer Science']);
  assert.deepEqual(aus.courses.map(c=>c.name),['Programming']);
  assert.deepEqual(aus.courses[0].ids,['prog','old-prog']);
  assert.deepEqual(simpleAcademicOptions(data,'ajman','topic:nursing').courses.map(c=>c.name),['Anatomy']);
  assert.equal(simpleAcademicOptions(data,'aus','topic:nursing').courses.length,0);
});

test('unknown published subjects are included and major-course links are respected',()=>{
  const data={majors:[
    {id:'arch',universityId:'aus',name:'Bachelor of Architecture',sourceUrl:'https://www.aus.edu/arch'},
    {id:'design',universityId:'aus',name:'Bachelor of Interior Design',sourceUrl:'https://www.aus.edu/design'}
  ],courses:[
    {id:'studio',name:'Architecture Studio I',universityId:'aus',sourceUrl:'https://www.aus.edu/arch',majorIds:['arch'],isShared:false},
    {id:'interior',name:'Interior Design Studio I',universityId:'aus',sourceUrl:'https://www.aus.edu/design',majorIds:['design'],isShared:false}
  ]};
  const result=simpleAcademicOptions(data,'aus','major:architecture');
  assert.deepEqual(result.majors.map(m=>m.name),['Architecture','Interior Design']);
  assert.deepEqual(result.courses.map(c=>c.name),['Architecture Studio I']);
  assert.equal(result.courses[0].id,'course:architecture studio i');
  assert.deepEqual(simpleAcademicOptions(data,'aus','arch').courses,result.courses);
});

test('Arabic subjects and parenthesised concentrations remain distinct',()=>{
  const data={majors:[
    {id:'a',name:'بكالوريوس في الشريعة (أصول الدين)',universityId:'uos'},
    {id:'b',name:'بكالوريوس في الشريعة (الفقه وأصوله)',universityId:'uos'}
  ],courses:[
    {id:'c',name:'أصول الفقه',universityId:'uos',majorIds:['b'],isShared:false},
    {id:'d',name:'العقيدة',universityId:'uos',majorIds:['a'],isShared:false}
  ]};
  const options=simpleAcademicOptions(data,'uos');
  assert.equal(options.majors.length,2);assert.equal(options.courses.length,2);
  assert.equal(new Set(options.majors.map(m=>m.id)).size,2);
  assert.equal(new Set(options.courses.map(c=>c.id)).size,2);
  assert.equal(simpleAcademicOptions(data,'uos',options.majors.find(m=>m.ids.includes('a'))!.id).courses[0].ids[0],'d');
});
