import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireAuth } from '../middleware/auth';
import { course, filters, httpsUrl, notifyGroup, page, rows, text, timeRange, transaction, university, userId, verified } from './shared';

const router = Router();
const selection = 'SELECT g.id,g.owner_id AS ownerId,g.title,g.description,g.course_id AS courseId,g.university_id AS universityId,u.name AS university,c.name AS course,c.code,a.name AS leader,(SELECT COUNT(*) FROM group_members m WHERE m.group_id=g.id) AS members';
const from = 'FROM study_groups g JOIN users a ON a.id=g.owner_id JOIN universities u ON u.id=g.university_id JOIN courses c ON c.id=g.course_id';
async function group(id: string) {
  const [result] = await query<any[]>(selection + ' ' + from + ' WHERE g.id=?',[id]);
  if (!result) throw new ApiError(404,'Study group not found.');
  return result;
}
async function owner(id: string, user: string) {
  const result = await group(id);
  if (result.ownerId !== user) throw new ApiError(403,'Only the group leader can make this change.');
  return result;
}
async function member(id: string, user: string) {
  if (!(await query<any[]>('SELECT user_id FROM group_members WHERE group_id=? AND user_id=?',[id,user])).length) throw new ApiError(403,'Join this group to access its members-only content.');
}
router.get('/', asyncHandler(async (req,res) => {
  const {clauses,values} = filters(req,'g.university_id',['g.title','g.description','c.name','c.code','a.name']);
  res.json(await page(req,selection,from,clauses,values,'g.created_at DESC,g.id'));
}));
router.get('/:id', asyncHandler(async (req,res) => { res.json(await group(req.params.id)); }));
router.use(requireAuth,verified);
router.post('/', asyncHandler(async (req,res) => {
  const universityId = await university(req.body.universityId);
  const courseId = await course(req.body.courseId,universityId);
  const title = text(req.body.title,'Group name',3), description = text(req.body.description,'Description',20,5000);
  const id = randomUUID();
  await transaction(async (connection) => {
    await connection.execute('INSERT INTO study_groups (id,owner_id,university_id,course_id,title,description) VALUES (?,?,?,?,?,?)',[id,userId(req),universityId,courseId,title,description]);
    await connection.execute('INSERT INTO group_members (group_id,user_id) VALUES (?,?)',[id,userId(req)]);
  });
  res.status(201).json({id});
}));
router.patch('/:id', asyncHandler(async (req,res) => {
  await owner(req.params.id,userId(req));
  await query('UPDATE study_groups SET title=?,description=? WHERE id=?',[text(req.body.title,'Group name',3),text(req.body.description,'Description',20,5000),req.params.id]);
  res.json({ok:true});
}));
router.post('/:id/join', asyncHandler(async (req,res) => {
  await group(req.params.id);
  await transaction(async c=>{
    await rows(c,'SELECT id FROM study_groups WHERE id=? FOR UPDATE',[req.params.id]);
    if((await rows(c,'SELECT user_id FROM group_bans WHERE group_id=? AND user_id=?',[req.params.id,userId(req)])).length)throw new ApiError(403,'The group administrator has removed your access.');
    await c.execute('INSERT IGNORE INTO group_members (group_id,user_id) VALUES (?,?)',[req.params.id,userId(req)]);
  });
  res.json({ok:true});
}));
router.delete('/:id/join', asyncHandler(async (req,res) => {
  const current = await group(req.params.id);
  if (current.ownerId === userId(req)) throw new ApiError(400,'The group leader cannot leave their own group.');
  await query('DELETE FROM group_members WHERE group_id=? AND user_id=?',[req.params.id,userId(req)]);
  res.json({ok:true});
}));
router.get('/:id/room', asyncHandler(async (req,res) => {
  await member(req.params.id,userId(req));
  const sessions = await query<any[]>('SELECT id,title,starts_at AS startsAt,ends_at AS endsAt,meeting_url AS meetingUrl,cancelled FROM group_sessions WHERE group_id=? ORDER BY starts_at DESC',[req.params.id]);
  const recordings = await query<any[]>('SELECT id,title,url,created_at AS createdAt FROM group_recordings WHERE group_id=? ORDER BY created_at DESC',[req.params.id]);
  res.json({sessions,recordings});
}));
router.get('/:id/messages', asyncHandler(async (req,res) => {
  await member(req.params.id,userId(req));
  const before = Number(req.query.before), after = Number(req.query.after);
  const clauses = ['m.group_id=?'], values:any[] = [req.params.id];
  if (Number.isSafeInteger(before) && before > 0) { clauses.push('m.id < ?'); values.push(before); }
  if (Number.isSafeInteger(after) && after > 0) { clauses.push('m.id > ?'); values.push(after); }
  const ascending = after > 0;
  const messages = await query<any[]>('SELECT m.id,m.user_id AS userId,m.body,m.created_at AS createdAt,u.name AS author FROM group_messages m JOIN users u ON u.id=m.user_id WHERE ' + clauses.join(' AND ') + ' ORDER BY m.id ' + (ascending ? 'ASC' : 'DESC') + ' LIMIT 50',values);
  res.json({messages:ascending ? messages : messages.reverse(),hasMore:messages.length===50});
}));
router.post('/:id/messages', rateLimit({windowMs:60_000,limit:30,message:{error:'Please wait before sending more messages.'}}), asyncHandler(async (req,res) => {
  await member(req.params.id,userId(req));
  const body = text(req.body.body,'Message',1,2000);
  await query('INSERT INTO group_messages (group_id,user_id,body) VALUES (?,?,?)',[req.params.id,userId(req),body]);
  res.status(201).json({ok:true});
}));
router.post('/:id/sessions', asyncHandler(async (req,res) => {
  const current = await owner(req.params.id,userId(req));
  const [start,end] = timeRange(req.body);
  const title = text(req.body.title,'Session title'), meeting = httpsUrl(req.body.meetingUrl,'Meeting link');
  await transaction(async (connection) => {
    await connection.execute('INSERT INTO group_sessions (id,group_id,title,starts_at,ends_at,meeting_url) VALUES (?,?,?,?,?,?)',[randomUUID(),current.id,title,start,end,meeting]);
    await notifyGroup(connection,current.id,`${current.title}: new session - ${title}`,userId(req));
  });
  res.status(201).json({ok:true});
}));
router.patch('/:id/sessions/:sessionId', asyncHandler(async (req,res) => {
  const current = await owner(req.params.id,userId(req));
  const [start,end] = timeRange(req.body);
  const title = text(req.body.title,'Session title'), meeting = httpsUrl(req.body.meetingUrl,'Meeting link');
  await transaction(async (connection) => {
    const [session] = await rows(connection,'SELECT id FROM group_sessions WHERE id=? AND group_id=? FOR UPDATE',[req.params.sessionId,current.id]);
    if (!session) throw new ApiError(404,'Session not found.');
    await connection.execute('UPDATE group_sessions SET title=?,starts_at=?,ends_at=?,meeting_url=?,cancelled=FALSE WHERE id=?',[title,start,end,meeting,session.id]);
    await notifyGroup(connection,current.id,`${current.title}: session updated - ${title}`,userId(req));
  });
  res.json({ok:true});
}));
router.delete('/:id/sessions/:sessionId', asyncHandler(async (req,res) => {
  const current = await owner(req.params.id,userId(req));
  await transaction(async (connection) => {
    const [session] = await rows(connection,'SELECT title,cancelled FROM group_sessions WHERE id=? AND group_id=? FOR UPDATE',[req.params.sessionId,current.id]);
    if (!session) throw new ApiError(404,'Session not found.');
    if (!session.cancelled) {
      await connection.execute('UPDATE group_sessions SET cancelled=TRUE WHERE id=?',[req.params.sessionId]);
      await notifyGroup(connection,current.id,`${current.title}: session cancelled - ${session.title}`,userId(req));
    }
  });
  res.json({ok:true});
}));
router.post('/:id/recordings', asyncHandler(async (req,res) => {
  const current = await owner(req.params.id,userId(req));
  const title = text(req.body.title,'Recording title'), url = httpsUrl(req.body.url,'Recording link');
  await transaction(async (connection) => {
    await connection.execute('INSERT INTO group_recordings (id,group_id,title,url) VALUES (?,?,?,?)',[randomUUID(),current.id,title,url]);
    await notifyGroup(connection,current.id,`${current.title}: recording added - ${title}`,userId(req));
  });
  res.status(201).json({ok:true});
}));
router.delete('/:id/recordings/:recordingId', asyncHandler(async (req,res) => {
  await owner(req.params.id,userId(req));
  await query('DELETE FROM group_recordings WHERE id=? AND group_id=?',[req.params.recordingId,req.params.id]);
  res.json({ok:true});
}));
router.get('/:id/moderation',asyncHandler(async(req,res)=>{
 await member(req.params.id,userId(req));
 const members=await query('SELECT u.id,u.name FROM group_members m JOIN users u ON u.id=m.user_id WHERE m.group_id=?',[req.params.id]);
 const announcements=await query('SELECT id,body,created_at AS createdAt FROM group_announcements WHERE group_id=? ORDER BY created_at DESC LIMIT 50',[req.params.id]);
 const g=await group(req.params.id);
 const removed=g.ownerId===userId(req)?await query('SELECT u.id,u.name FROM group_bans b JOIN users u ON u.id=b.user_id WHERE b.group_id=?',[req.params.id]):[];
 res.json({members,announcements,removed});
}));
router.post('/:id/announcements',asyncHandler(async(req,res)=>{
 const g=await owner(req.params.id,userId(req)),body=text(req.body.body,'Announcement',3,2000);
 await transaction(async c=>{
  await c.execute('INSERT INTO group_announcements (id,group_id,body) VALUES (?,?,?)',[randomUUID(),g.id,body]);
  await notifyGroup(c,g.id,g.title+': '+body,userId(req));
 });res.status(201).json({ok:true});
}));
router.delete('/:id/members/:user',asyncHandler(async(req,res)=>{
 await owner(req.params.id,userId(req));
 if(req.params.user===userId(req))throw new ApiError(400,'The group administrator cannot remove themselves.');
 await transaction(async c=>{
  await rows(c,'SELECT id FROM study_groups WHERE id=? FOR UPDATE',[req.params.id]);
  if(!(await rows(c,'SELECT user_id FROM group_members WHERE group_id=? AND user_id=?',[req.params.id,req.params.user])).length)throw new ApiError(404,'Member not found.');
  await c.execute('INSERT IGNORE INTO group_bans (group_id,user_id) VALUES (?,?)',[req.params.id,req.params.user]);
  await c.execute('DELETE FROM group_members WHERE group_id=? AND user_id=?',[req.params.id,req.params.user]);
 });res.json({ok:true});
}));
router.delete('/:id/bans/:user',asyncHandler(async(req,res)=>{
 await owner(req.params.id,userId(req));
 await transaction(async c=>{
  await rows(c,'SELECT id FROM study_groups WHERE id=? FOR UPDATE',[req.params.id]);
  await c.execute('DELETE FROM group_bans WHERE group_id=? AND user_id=?',[req.params.id,req.params.user]);
 });res.json({ok:true});
}));
export default router;
