import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {simpleAcademicOptions,simpleMajorName} from '../../src/lib/academicTopics';
import type {PublishedUniversity} from '../catalogImport';

const partners=JSON.parse(await fs.readFile('server/data/partner-catalog.json','utf8')) as {universities:PublishedUniversity[]};
const sharjah=JSON.parse(await fs.readFile('server/data/sharjah-catalog.json','utf8'));
const supplement=JSON.parse(await fs.readFile('server/data/sharjah-supplement.json','utf8'));
for(const major of sharjah.majors){
  const fallback=supplement.majors.find(m=>m.id===major.id);
  if(fallback&&major.courses.length<=1)major.courses=[...new Map([...fallback.courses,...major.courses].map(c=>[c.code,c])).values()];
}
const institutions:PublishedUniversity[]=[{id:'uos',name:'University of Sharjah',website:'https://www.sharjah.ac.ae',majors:sharjah.majors},...partners.universities];
const majors=institutions.flatMap(u=>u.majors.map(m=>({...m,universityId:u.id})));
const courses=institutions.flatMap(u=>u.majors.flatMap(m=>m.courses.map(c=>({...c,id:u.id+'-'+c.code,universityId:u.id,majorIds:[m.id],sourceUrl:c.sourceUrl||m.sourceUrl}))));

test('published snapshots have official sources and populated partner study plans',()=>{
  for(const u of institutions){
    const host=new URL(u.website).hostname.replace(/^www\./,'');
    assert.ok(u.majors.length>=25);
    for(const m of u.majors){
      assert.ok(new URL(m.sourceUrl).hostname.endsWith(host));
      if(u.id!=='uos')assert.ok(m.courses.length>10,m.name);
      for(const c of m.courses){
        assert.ok(c.code.length<=30&&c.name.length<=240,c.name);
        assert.ok(!c.sourceUrl||new URL(c.sourceUrl).hostname.endsWith(host));
      }
    }
  }
});

test('university to major to course works with the real snapshots',()=>{
  const data={majors,courses};
  const aus=simpleAcademicOptions(data,'aus','topic:cs');
  assert.ok(aus.majors.some(m=>m.name==='Computer Science'));
  assert.ok(!aus.majors.some(m=>m.name==='Dentistry'||m.name==='Nursing'));
  assert.ok(aus.courses.some(c=>c.name==='Operating Systems'));
  assert.ok(!aus.courses.some(c=>/Anatomy/i.test(c.name)));
  const ajman=simpleAcademicOptions(data,'ajman','topic:nursing');
  assert.ok(ajman.courses.length>10);
  assert.ok(ajman.courses.every(c=>c.ids.every(id=>id.startsWith('ajman-'))));
  assert.ok(simpleAcademicOptions(data,'uos','topic:nursing').courses.length>10);
  assert.ok(simpleAcademicOptions(data,'uos','topic:dentistry').courses.length>10);
  assert.ok(simpleAcademicOptions(data,'ajman').majors.some(m=>m.name==='Dentistry'));
  assert.equal(simpleMajorName('Bachelor of Science in Business Administration Major in Finance'),'Finance');
  assert.equal(simpleMajorName('Bachelor of Science in Business Administration - Marketing'),'Marketing');
});

test('published import is repeatable and preserves existing course IDs',{skip:process.env.CATALOG_INTEGRATION!=='1'},async()=>{
  const {pool}=await import('../db');
  const {importPublishedUniversity}=await import('../catalogImport');
  const c=await pool.getConnection();
  try{
    await c.query('CREATE TEMPORARY TABLE universities (id VARCHAR(80) PRIMARY KEY,name VARCHAR(200),website VARCHAR(500))');
    await c.query('CREATE TEMPORARY TABLE majors (id VARCHAR(100) PRIMARY KEY,university_id VARCHAR(80),name VARCHAR(200),source_url VARCHAR(500))');
    await c.query('CREATE TEMPORARY TABLE courses (id VARCHAR(120) PRIMARY KEY,university_id VARCHAR(80),code VARCHAR(30),name VARCHAR(240),is_shared BOOLEAN,source_url VARCHAR(500),UNIQUE KEY university_code(university_id,code))');
    await c.query('CREATE TEMPORARY TABLE course_majors (course_id VARCHAR(120),major_id VARCHAR(100),PRIMARY KEY(course_id,major_id))');
    await c.execute("INSERT INTO courses VALUES ('existing-course','aus','CMP310','Old title',FALSE,'')");
    for(let run=0;run<2;run++)for(const u of partners.universities)await importPublishedUniversity(c,u);
    const [rows]=await c.query<any[]>("SELECT id,name FROM courses WHERE university_id='aus' AND code='CMP310'");
    assert.deepEqual(rows.map(r=>r.id),['existing-course']);
    assert.equal(rows[0].name,'Operating Systems');
    const [links]=await c.query<any[]>("SELECT major_id FROM course_majors WHERE course_id='existing-course'");
    assert.ok(links.length>=1);
    const [missing]=await c.query<any[]>('SELECT cm.course_id FROM course_majors cm LEFT JOIN courses c ON c.id=cm.course_id WHERE c.id IS NULL');
    assert.equal(missing.length,0);
  }finally{
    for(const table of ['course_majors','courses','majors','universities'])await c.query('DROP TEMPORARY TABLE IF EXISTS '+table);
    c.release();await pool.end();
  }
});
