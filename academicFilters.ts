import type {Request} from 'express';
import {query} from '../db';
import {simpleAcademicOptions} from '../../src/lib/academicTopics';

export async function academicFilters(req:Request,clauses:string[],values:unknown[]) {
  const major=typeof req.query.major==='string'?req.query.major:'',course=typeof req.query.course==='string'?req.query.course:'';
  if(!major.startsWith('topic:')&&!major.startsWith('major:')&&!course.startsWith('topic:')&&!course.startsWith('course:')) {
    if(course){clauses.push('c.id=?');values.push(course);}
    if(major==='shared')clauses.push('c.is_shared=TRUE');
    else if(major){clauses.push('EXISTS (SELECT 1 FROM course_majors cm WHERE cm.course_id=c.id AND cm.major_id=?)');values.push(major);}
    return;
  }
  const majors=await query<any[]>('SELECT id,name,university_id AS universityId,source_url AS sourceUrl FROM majors');
  const courses=await query<any[]>('SELECT id,name,university_id AS universityId,is_shared AS isShared,source_url AS sourceUrl FROM courses');
  const links=await query<any[]>('SELECT course_id AS courseId,major_id AS majorId FROM course_majors');
  const majorIds=new Map<string,string[]>();
  for(const link of links)majorIds.set(link.courseId,[...(majorIds.get(link.courseId)||[]),link.majorId]);
  const options=simpleAcademicOptions({majors,courses:courses.map(c=>({...c,majorIds:majorIds.get(c.id)||[]}))},String(req.query.university||''),major);
  if(major==='shared')clauses.push('c.is_shared=TRUE');
  else if(major.startsWith('topic:')||major.startsWith('major:')){
    const ids=options.majors.find(m=>m.id===major)?.ids||[];
    if(!ids.length)clauses.push('FALSE');
    else {clauses.push('EXISTS (SELECT 1 FROM course_majors cm WHERE cm.course_id=c.id AND cm.major_id IN ('+ids.map(()=>'?').join(',')+'))');values.push(...ids);}
  } else if(major){clauses.push('EXISTS (SELECT 1 FROM course_majors cm WHERE cm.course_id=c.id AND cm.major_id=?)');values.push(major);}
  if(course.startsWith('topic:')||course.startsWith('course:')){
    const ids=options.courses.find(c=>c.id===course)?.ids||[];
    if(!ids.length)clauses.push('FALSE');
    else{clauses.push('c.id IN ('+ids.map(()=>'?').join(',')+')');values.push(...ids);}
  } else if(course){clauses.push('c.id=?');values.push(course);}
}

