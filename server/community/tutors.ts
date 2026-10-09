import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { query } from '../db';
import { ApiError, asyncHandler } from '../errors';
import { requireAuth } from '../middleware/auth';
import { refundBooking } from './payments';
import { filters, httpsUrl, money, notify, page, rows, text, timeRange, transaction, tutor, university, userId, verified } from './shared';

const router = Router();
const select = 'SELECT t.user_id AS id,u.name,t.university_id AS universityId,v.name AS university,t.subjects,t.bio,t.hourly_rate AS hourlyRate';
const from = 'FROM tutor_profiles t JOIN users u ON u.id=t.user_id JOIN universities v ON v.id=t.university_id';
router.get('/', asyncHandler(async (req,res) => {
  const {clauses,values} = filters(req,'t.university_id',['u.name','t.subjects','t.bio']);
  clauses.push("NOT EXISTS (SELECT 1 FROM tutor_applications a WHERE a.user_id=u.id AND (a.status<>'approved')) AND u.is_verified=TRUE AND u.role IN ('tutor','admin')");
  res.json(await page(req,select,from,clauses,values,'u.name,t.user_id'));
}));
router.get('/:id', asyncHandler(async (req,res) => {
  const [profile] = await query<any[]>(select+' '+from+' WHERE t.user_id=? AND u.is_verified=TRUE AND u.role IN (\'tutor\',\'admin\') AND NOT EXISTS (SELECT 1 FROM tutor_applications a WHERE a.user_id=u.id AND (a.status<>\'approved\'))',[req.params.id]);
  if (!profile) throw new ApiError(404,'Tutor not found.');
  const slots = await query<any[]>("SELECT s.id,s.starts_at AS startsAt,s.ends_at AS endsAt,s.price FROM tutor_slots s WHERE s.tutor_id=? AND s.cancelled=FALSE AND s.starts_at>UTC_TIMESTAMP() AND NOT EXISTS (SELECT 1 FROM tutor_bookings b WHERE b.slot_id=s.id AND b.status IN ('pending','accepted')) ORDER BY s.starts_at",[req.params.id]);
  res.json({...profile,slots});
}));
router.use(requireAuth,verified);
router.put('/profile', asyncHandler(async (req,res) => {
  await tutor(req);
  const universityId = await university(req.body.universityId);
  const subjects = text(req.body.subjects,'Subjects',3,500), bio = text(req.body.bio,'Biography',20,5000), rate = money(req.body.hourlyRate);
  await query('INSERT INTO tutor_profiles (user_id,university_id,subjects,bio,hourly_rate) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE university_id=VALUES(university_id),subjects=VALUES(subjects),bio=VALUES(bio),hourly_rate=VALUES(hourly_rate)',[userId(req),universityId,subjects,bio,rate]);
  res.json({ok:true});
}));
router.post('/slots', asyncHandler(async (req,res) => {
  await tutor(req);
  const [start,end] = timeRange(req.body);
  const price = money(req.body.price);
  if(price>0&&price<2)throw new ApiError(400,'Paid sessions must cost at least AED 2. Use zero for a free session.');
  const id = randomUUID();
  await transaction(async (connection) => {
    // Lock the tutor profile to serialize overlapping availability changes.
    const [profile] = await rows(connection,'SELECT user_id FROM tutor_profiles WHERE user_id=? FOR UPDATE',[userId(req)]);
    if (!profile) throw new ApiError(400,'Save your tutor profile before adding availability.');
    const overlaps = await rows(connection,'SELECT id FROM tutor_slots WHERE tutor_id=? AND cancelled=FALSE AND starts_at<? AND ends_at>?',[userId(req),end,start]);
    if (overlaps.length) throw new ApiError(409,'This slot overlaps your existing availability.');
    await connection.execute('INSERT INTO tutor_slots (id,tutor_id,starts_at,ends_at,price) VALUES (?,?,?,?,?)',[id,userId(req),start,end,price]);
  });
  res.status(201).json({id});
}));
router.delete('/slots/:id', asyncHandler(async (req,res) => {
  await tutor(req);
  await transaction(async (connection) => {
    const [slot] = await rows(connection,'SELECT * FROM tutor_slots WHERE id=? AND tutor_id=? FOR UPDATE',[req.params.id,userId(req)]);
    if (!slot) throw new ApiError(404,'Slot not found.');
    const bookings = await rows(connection,"SELECT * FROM tutor_bookings WHERE slot_id=? AND status IN ('pending','accepted')",[slot.id]);
    await connection.execute('UPDATE tutor_slots SET cancelled=TRUE WHERE id=?',[slot.id]);
    for (const booking of bookings) {
      await refundBooking(connection,booking.id);
      await connection.execute("UPDATE tutor_bookings SET status='cancelled',meeting_url=NULL WHERE id=?",[booking.id]);
      await notify(connection,booking.student_id,'Your tutor cancelled a session.','/dashboard');
    }
  });
  res.json({ok:true});
}));
router.post('/slots/:id/book', asyncHandler(async (req,res) => {
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (note.length>1000) throw new ApiError(400,'Keep your booking note under 1,000 characters.');
  const id = randomUUID();
  await transaction(async (connection) => {
    // All booking transitions lock the slot before the booking to prevent double booking.
    const [slot] = await rows(connection,'SELECT * FROM tutor_slots WHERE id=? FOR UPDATE',[req.params.id]);
    if (!slot || slot.cancelled || new Date(slot.starts_at).getTime() <= Date.now()) throw new ApiError(409,'This slot is no longer available.');
    const blocked=await rows(connection,"SELECT id FROM tutor_applications WHERE user_id=? AND (status<>'approved')",[slot.tutor_id]);
    if(blocked.length)throw new ApiError(409,'This tutor is not currently accepting bookings.');
    if (slot.tutor_id === userId(req)) throw new ApiError(400,'You cannot book your own slot.');
    const active = await rows(connection,"SELECT id FROM tutor_bookings WHERE slot_id=? AND status IN ('pending','accepted')",[slot.id]);
    if (active.length) throw new ApiError(409,'Another student has already requested this slot.');
    await connection.execute('INSERT INTO tutor_bookings (id,slot_id,student_id,note) VALUES (?,?,?,?)',[id,slot.id,userId(req),note]);
    await notify(connection,slot.tutor_id,'New tutoring booking request.','/dashboard');
    await notify(connection,userId(req),'Booking requested. Waiting for the tutor to respond.','/dashboard');
  });
  res.status(201).json({id});
}));
router.patch('/bookings/:id', asyncHandler(async (req,res) => {
  const status = req.body.status;
  if (!['accepted','declined','cancelled'].includes(status)) throw new ApiError(400,'Invalid booking decision.');
  const meeting = status === 'accepted' ? httpsUrl(req.body.meetingUrl,'Meeting link') : null;
  await transaction(async (connection) => {
    const [reference] = await rows(connection,'SELECT slot_id FROM tutor_bookings WHERE id=?',[req.params.id]);
    if (!reference) throw new ApiError(404,'Booking not found.');
    const [slot] = await rows(connection,'SELECT * FROM tutor_slots WHERE id=? FOR UPDATE',[reference.slot_id]);
    const [booking] = await rows(connection,'SELECT * FROM tutor_bookings WHERE id=? FOR UPDATE',[req.params.id]);
    const isTutor = slot.tutor_id === userId(req), isStudent = booking.student_id === userId(req);
    if ((!isTutor && !isStudent) || (!isTutor && status !== 'cancelled')) throw new ApiError(403,'You cannot change this booking.');
    if (!['pending','accepted'].includes(booking.status) || (status !== 'cancelled' && booking.status !== 'pending') || slot.cancelled || new Date(slot.starts_at).getTime() <= Date.now()) throw new ApiError(409,'This booking can no longer be changed.');
    if(status==='cancelled')await refundBooking(connection,booking.id);
    await connection.execute('UPDATE tutor_bookings SET status=?,meeting_url=? WHERE id=?',[status,meeting,booking.id]);
    await notify(connection,isTutor ? booking.student_id : slot.tutor_id,`Tutoring booking ${status}.`,'/dashboard');
  });
  res.json({ok:true});
}));
export default router;
