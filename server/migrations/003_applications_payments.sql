CREATE TABLE IF NOT EXISTS tutor_applications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  university_id VARCHAR(80) NOT NULL,
  subjects VARCHAR(500) NOT NULL,
  experience TEXT NOT NULL,
  employment_status VARCHAR(40) NOT NULL,
  teaching_mode VARCHAR(20) NOT NULL,
  permit_reference VARCHAR(100) NOT NULL,
  permit_expires DATE NOT NULL,
  permit_file VARCHAR(100) NOT NULL,
  qualification_file VARCHAR(100) NOT NULL,
  status ENUM('pending','approved','declined','withdrawn') NOT NULL DEFAULT 'pending',
  decision_reason VARCHAR(2000) NOT NULL DEFAULT '',
  reviewer_id CHAR(36) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (university_id) REFERENCES universities(id),
  FOREIGN KEY (reviewer_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS tutor_application_audit (
  id CHAR(36) PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  note VARCHAR(2000) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES tutor_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS payment_orders (
  id CHAR(36) PRIMARY KEY,
  buyer_id CHAR(36) NOT NULL,
  seller_id CHAR(36) NOT NULL,
  kind ENUM('listing','booking') NOT NULL,
  reference_id CHAR(36) NOT NULL,
  title VARCHAR(240) NOT NULL,
  amount_minor INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'aed',
  status ENUM('pending','paid','expired','refunded','review_required') NOT NULL DEFAULT 'pending',
  checkout_session_id VARCHAR(255) NULL UNIQUE,
  payment_intent_id VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (buyer_id) REFERENCES users(id),
  FOREIGN KEY (seller_id) REFERENCES users(id),
  INDEX payment_reference (kind,reference_id,status)
);
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id VARCHAR(255) PRIMARY KEY,
  processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
