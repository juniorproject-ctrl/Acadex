import {query} from '../db';

export async function bookingsForUser(user:string,id?:string) {
  return query<any[]>(`SELECT b.id,b.status,b.note,b.created_at AS createdAt,b.updated_at AS updatedAt,
    b.student_id AS studentId,student.name AS student,s.tutor_id AS tutorId,tutor.name AS tutor,
    s.starts_at AS startsAt,s.ends_at AS endsAt,s.price,v.name AS university,t.subjects,
    (SELECT o.status FROM payment_orders o WHERE o.kind='booking' AND o.reference_id=b.id ORDER BY o.created_at DESC LIMIT 1) AS paymentStatus,
    CASE WHEN b.status='accepted' AND (s.price=0 OR s.tutor_id=? OR EXISTS (SELECT 1 FROM payment_orders o WHERE o.kind='booking' AND o.reference_id=b.id AND o.status='paid')) THEN b.meeting_url ELSE NULL END AS meetingUrl
    FROM tutor_bookings b JOIN tutor_slots s ON s.id=b.slot_id
    JOIN users student ON student.id=b.student_id JOIN users tutor ON tutor.id=s.tutor_id
    LEFT JOIN tutor_profiles t ON t.user_id=s.tutor_id LEFT JOIN universities v ON v.id=t.university_id
    WHERE (b.student_id=? OR s.tutor_id=?) ${id?'AND b.id=?':''} ORDER BY s.starts_at DESC`,id?[user,user,user,id]:[user,user,user]);
}
