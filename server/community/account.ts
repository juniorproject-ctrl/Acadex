import { Router } from 'express';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireAuth } from '../middleware/auth';
import { notify, rows, text, transaction, userId, verified } from './shared';
import accountSecurity from './accountSecurity';
import {bookingsForUser} from './bookings';

const router = Router();
router.use(requireAuth,verified);
router.use('/security',accountSecurity);
router.patch('/profile', asyncHandler(async (req,res) => {
  const name = text(req.body.name,'Name',2,100);
  await query('UPDATE users SET name=? WHERE id=?',[name,userId(req)]);
  const [user] = await query<any[]>('SELECT id,name,email,role FROM users WHERE id=?',[userId(req)]);
  res.json({user});
}));
router.get('/dashboard', asyncHandler(async (req,res) => {
  const id = userId(req);
  const groups = await query<any[]>('SELECT g.id,g.title,g.owner_id AS ownerId,c.name AS course,u.name AS university FROM group_members m JOIN study_groups g ON g.id=m.group_id JOIN courses c ON c.id=g.course_id JOIN universities u ON u.id=g.university_id WHERE m.user_id=? ORDER BY g.title',[id]);
  const [profile] = await query<any[]>('SELECT university_id AS universityId,subjects,bio,hourly_rate AS hourlyRate FROM tutor_profiles WHERE user_id=?',[id]);
  const slots = await query<any[]>("SELECT s.id,s.starts_at AS startsAt,s.ends_at AS endsAt,s.price,s.cancelled,EXISTS (SELECT 1 FROM tutor_bookings b WHERE b.slot_id=s.id AND b.status IN ('pending','accepted')) AS reserved FROM tutor_slots s WHERE tutor_id=? AND ends_at>UTC_TIMESTAMP() ORDER BY starts_at",[id]);
  const bookings=await bookingsForUser(id);
  const events = await query<any[]>('SELECT id,title,starts_at AS startsAt,cancelled FROM campus_events WHERE owner_id=? ORDER BY starts_at DESC',[id]);
  res.json({groups,profile:profile||null,slots,bookings,events});
}));
router.get('/bookings/:id', asyncHandler(async(req,res)=>{
  const [booking]=await bookingsForUser(userId(req),req.params.id);
  if(!booking)throw new ApiError(404,'Booking not found.');
  res.setHeader('Cache-Control','private, no-store');
  res.json({booking});
}));
router.get('/notifications', asyncHandler(async (req,res) => {
  const id = userId(req);
  // Generate durable, deduplicated reminders when the signed-in app polls.
  await transaction(async (connection) => {
    const sessions = await rows(connection,'SELECT s.id,s.group_id,s.title,s.starts_at FROM group_sessions s JOIN group_members m ON m.group_id=s.group_id WHERE m.user_id=? AND s.cancelled=FALSE AND s.starts_at BETWEEN UTC_TIMESTAMP() AND DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR)',[id]);
    for (const session of sessions) await notify(connection,id,`Upcoming group session: ${session.title}`,`/study-groups/${session.group_id}`,`session:${session.id}:${new Date(session.starts_at).toISOString()}`);
    const bookings = await rows(connection,"SELECT b.id FROM tutor_bookings b JOIN tutor_slots s ON s.id=b.slot_id WHERE (b.student_id=? OR s.tutor_id=?) AND b.status='accepted' AND s.cancelled=FALSE AND s.starts_at BETWEEN UTC_TIMESTAMP() AND DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR)",[id,id]);
    for (const booking of bookings) await notify(connection,id,'Your tutoring session starts within 24 hours.','/bookings/'+booking.id,`booking:${booking.id}`);
  });
  const items = await query<any[]>('SELECT id,title,href,is_read AS isRead,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100',[id]);
  const [count] = await query<any[]>('SELECT COUNT(*) AS unread FROM notifications WHERE user_id=? AND is_read=FALSE',[id]);
  res.json({items,unread:Number(count.unread)});
}));
router.patch('/notifications/read', asyncHandler(async (req,res) => {
  await query('UPDATE notifications SET is_read=TRUE WHERE user_id=?',[userId(req)]);
  res.json({ok:true});
}));
router.patch('/notifications/:id/read', asyncHandler(async(req,res)=>{
  const [notification]=await query<any[]>('SELECT id FROM notifications WHERE id=? AND user_id=?',[req.params.id,userId(req)]);
  if(!notification)throw new ApiError(404,'Notification not found.');
  await query('UPDATE notifications SET is_read=TRUE WHERE id=? AND user_id=?',[req.params.id,userId(req)]);
  res.json({ok:true});
}));
export default router;
