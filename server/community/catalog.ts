import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireAuth } from '../middleware/auth';
import { httpsUrl, rows, teaching, text, transaction, verified } from './shared';

const router = Router();
router.get('/', asyncHandler(async (_req, res) => {
  const universities = await query<any[]>('SELECT * FROM universities ORDER BY name');
  const majors = await query<any[]>('SELECT id, university_id AS universityId, name, source_url AS sourceUrl FROM majors ORDER BY name');
  const courses = await query<any[]>('SELECT id, university_id AS universityId, code, name, is_shared AS isShared, source_url AS sourceUrl FROM courses ORDER BY name');
  const links = await query<any[]>('SELECT course_id AS courseId, major_id AS majorId FROM course_majors');
  const majorIds=new Map<string,string[]>();
  for(const link of links) majorIds.set(link.courseId,[...(majorIds.get(link.courseId)||[]),link.majorId]);
  res.json({ universities, majors, courses: courses.map((c) => ({ ...c, isShared: !!c.isShared, majorIds: majorIds.get(c.id)||[] })) });
}));
router.post('/entries', requireAuth, verified, rateLimit({windowMs:3600_000,limit:30,message:{error:'Too many catalogue changes. Try again later.'}}), asyncHandler(async(req,res)=>{
  teaching(req);
  const sourceUrl=httpsUrl(req.body.sourceUrl,'Official course source');
  const code=text(req.body.code,'Course code',1,30),name=text(req.body.name,'Course name',2,240);
  if(!/^[a-z0-9 ._-]+$/i.test(code))throw new ApiError(400,'Course code contains unsupported characters.');
  const shared=req.body.isShared===true;
  const result=await transaction(async(connection)=>{
    let universityId=typeof req.body.universityId==='string'?req.body.universityId:'';
    let institution:any;
    if(universityId) {
      [institution]=await rows(connection,'SELECT * FROM universities WHERE id=?',[universityId]);
      if(!institution)throw new ApiError(400,'University not found.');
    } else {
      const institutionName=text(req.body.universityName,'University name',3,200);
      const website=httpsUrl(req.body.website,'University website');
      const host=new URL(website).hostname.replace(/^www\./,'').toLowerCase();
      if(!host.endsWith('.ac.ae')&&host!=='aus.edu')throw new ApiError(400,'Use the official UAE university website (.ac.ae or aus.edu).');
      const all=await rows(connection,'SELECT * FROM universities');
      institution=all.find(u=>new URL(u.website).hostname.replace(/^www\./,'').toLowerCase()===host);
      if(institution)universityId=institution.id;
      else {universityId='uni-'+createHash('sha256').update(host).digest('hex').slice(0,24);institution={website};await connection.execute('INSERT INTO universities (id,name,website) VALUES (?,?,?) ON DUPLICATE KEY UPDATE id=id',[universityId,institutionName,website]);}
    }
    await rows(connection,'SELECT id FROM universities WHERE id=? FOR UPDATE',[universityId]);
    const host=new URL(institution.website).hostname.replace(/^www\./,'').toLowerCase(),sourceHost=new URL(sourceUrl).hostname.toLowerCase();
    if(sourceHost!==host&&!sourceHost.endsWith('.'+host))throw new ApiError(400,'The source must be on the selected university website.');
    let majorId=typeof req.body.majorId==='string'?req.body.majorId:'';
    if(majorId) {
      const [major]=await rows(connection,'SELECT id FROM majors WHERE id=? AND university_id=?',[majorId,universityId]);
      if(!major)throw new ApiError(400,'Major does not belong to this university.');
    } else if(!shared) {
      const majorName=text(req.body.majorName,'Major name',2,200);
      const [existing]=await rows(connection,'SELECT id FROM majors WHERE name=? AND university_id=?',[majorName,universityId]);
      majorId=existing?.id||randomUUID();
      if(!existing)await connection.execute('INSERT INTO majors (id,university_id,name,source_url) VALUES (?,?,?,?)',[majorId,universityId,majorName,sourceUrl]);
    }
    const [existing]=await rows(connection,'SELECT id FROM courses WHERE university_id=? AND code=?',[universityId,code]);
    const id=existing?.id||randomUUID();
    if(!existing)await connection.execute('INSERT INTO courses (id,university_id,code,name,is_shared,source_url) VALUES (?,?,?,?,?,?)',[id,universityId,code,name,shared,sourceUrl]);
    else if(shared)await connection.execute('UPDATE courses SET is_shared=TRUE WHERE id=?',[id]);
    if(majorId)await connection.execute('INSERT IGNORE INTO course_majors (course_id,major_id) VALUES (?,?)',[id,majorId]);
    return {id};
  });
  res.status(201).json(result);
}));
export default router;
