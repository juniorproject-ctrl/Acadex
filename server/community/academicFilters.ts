import type {Request} from 'express';
import {query} from '../db';
import {simpleAcademicOptions} from '../../src/lib/academicTopics';

export async function academicFilters(req:Request,clauses:string[],values:unknown[]) {
  const major=typeof req.query.major==='string'?req.query.major:'',course=typeof req.query.course==='string'?req.query.course:'';
  if(!major.startsWith('topic:')&&!course.startsWith('topic:')) {
    if(course){clauses.push('c.id=?');values.push(course);}
    if(major==='shared')clauses.push('c.is_shared=TRUE');
    else if(major){clauses.push('EXISTS (SELECT 1 FROM course_majors cm WHERE cm.course_id=c.id AND cm.major_id=?)');values.push(major);}
    return;
  }
  const majors=await query<any[]>('SELECT id,name,university_id AS universityId FROM majors');
  const courses=await query<any[]>('SELECT id,name,university_id AS universityId,is_shared AS isShared FROM courses');
  const options=simpleAcademicOptions({majors,courses:courses.map(c=>({...c,majorIds:[]}))},String(req.query.university||''),major);
  if(major==='shared')clauses.push('c.is_shared=TRUE');
  else if(major.startsWith('topic:')){
    const ids=options.majors.find(m=>m.id===major)?.ids||[];
    if(!ids.length)clauses.push('FALSE');
    else {clauses.push('EXISTS (SELECT 1 FROM course_majors cm WHERE cm.course_id=c.id AND cm.major_id IN ('+ids.map(()=>'?').join(',')+'))');values.push(...ids);}
  } else if(major){clauses.push('EXISTS (SELECT 1 FROM course_majors cm WHERE cm.course_id=c.id AND cm.major_id=?)');values.push(major);}
  if(course.startsWith('topic:')){
    const ids=options.courses.find(c=>c.id===course)?.ids||[];
    if(!ids.length)clauses.push('FALSE');
    else{clauses.push('c.id IN ('+ids.map(()=>'?').join(',')+')');values.push(...ids);}
  } else if(course){clauses.push('c.id=?');values.push(course);}
}

