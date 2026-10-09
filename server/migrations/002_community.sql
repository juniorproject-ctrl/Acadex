ALTER TABLE users MODIFY role ENUM('student', 'tutor', 'leader', 'admin') NOT NULL DEFAULT 'student';

CREATE TABLE IF NOT EXISTS universities (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  website VARCHAR(500) NOT NULL
);
CREATE TABLE IF NOT EXISTS majors (
  id VARCHAR(100) PRIMARY KEY,
  university_id VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  source_url VARCHAR(500) NOT NULL,
  FOREIGN KEY (university_id) REFERENCES universities(id)
);
CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(120) PRIMARY KEY,
  university_id VARCHAR(80) NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(240) NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  source_url VARCHAR(500) NOT NULL,
  UNIQUE KEY university_code (university_id, code),
  FOREIGN KEY (university_id) REFERENCES universities(id)
);
CREATE TABLE IF NOT EXISTS course_majors (
  course_id VARCHAR(120) NOT NULL,
  major_id VARCHAR(100) NOT NULL,
  PRIMARY KEY (course_id, major_id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (major_id) REFERENCES majors(id)
);
CREATE TABLE IF NOT EXISTS past_papers (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  course_id VARCHAR(120) NOT NULL,
  title VARCHAR(160) NOT NULL,
  academic_year SMALLINT NOT NULL,
  exam_type VARCHAR(30) NOT NULL,
  file_name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  INDEX papers_course (course_id, created_at)
);
CREATE TABLE IF NOT EXISTS study_groups (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  university_id VARCHAR(80) NOT NULL,
  course_id VARCHAR(120) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (university_id) REFERENCES universities(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS group_sessions (
  id CHAR(36) PRIMARY KEY,
  group_id CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  meeting_url VARCHAR(2000) NOT NULL,
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS group_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX messages_group (group_id, id)
);
CREATE TABLE IF NOT EXISTS group_recordings (
  id CHAR(36) PRIMARY KEY,
  group_id CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  url VARCHAR(2000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS tutor_profiles (
  user_id CHAR(36) PRIMARY KEY,
  university_id VARCHAR(80) NOT NULL,
  subjects VARCHAR(500) NOT NULL,
  bio TEXT NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (university_id) REFERENCES universities(id)
);
CREATE TABLE IF NOT EXISTS tutor_slots (
  id CHAR(36) PRIMARY KEY,
  tutor_id CHAR(36) NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (tutor_id) REFERENCES tutor_profiles(user_id),
  INDEX slots_tutor (tutor_id, starts_at)
);
CREATE TABLE IF NOT EXISTS tutor_bookings (
  id CHAR(36) PRIMARY KEY,
  slot_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  status ENUM('pending','accepted','declined','cancelled') NOT NULL DEFAULT 'pending',
  note VARCHAR(1000) NOT NULL,
  meeting_url VARCHAR(2000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (slot_id) REFERENCES tutor_slots(id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  INDEX bookings_slot (slot_id, status)
);
CREATE TABLE IF NOT EXISTS campus_events (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  university_id VARCHAR(80) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(300) NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  source_url VARCHAR(2000) NULL,
  image_key VARCHAR(50) NOT NULL DEFAULT 'campus',
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (university_id) REFERENCES universities(id),
  INDEX events_date (starts_at)
);
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(240) NOT NULL,
  href VARCHAR(200) NOT NULL,
  dedupe_key VARCHAR(180) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY notification_dedupe (user_id, dedupe_key),
  INDEX notification_user (user_id, created_at)
);
