UPDATE notifications n
JOIN tutor_bookings b ON n.dedupe_key=CONCAT('booking:',b.id)
JOIN tutor_slots s ON s.id=b.slot_id
SET n.href=CONCAT('/bookings/',b.id)
WHERE n.href='/dashboard' AND (n.user_id=b.student_id OR n.user_id=s.tutor_id);
