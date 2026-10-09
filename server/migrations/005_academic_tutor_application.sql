ALTER TABLE tutor_applications
 ADD applicant_type VARCHAR(40) NOT NULL DEFAULT 'faculty',
 ADD academic_title VARCHAR(100) NOT NULL DEFAULT '',
 MODIFY employment_status VARCHAR(40) NOT NULL DEFAULT '',
 MODIFY permit_reference VARCHAR(100) NOT NULL DEFAULT '',
 MODIFY permit_expires DATE NULL,
 MODIFY permit_file VARCHAR(100) NOT NULL DEFAULT '',
 MODIFY qualification_file VARCHAR(100) NOT NULL DEFAULT '';
