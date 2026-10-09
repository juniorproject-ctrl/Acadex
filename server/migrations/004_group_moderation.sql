CREATE TABLE IF NOT EXISTS group_announcements (
 id CHAR(36) PRIMARY KEY, group_id CHAR(36) NOT NULL, body TEXT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS group_bans (
 group_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
 PRIMARY KEY (group_id,user_id),
 FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reports (
 id CHAR(36) PRIMARY KEY, reporter_id CHAR(36) NOT NULL,
 subject VARCHAR(160) NOT NULL, details TEXT NOT NULL,
 status ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
 resolution VARCHAR(2000) NOT NULL DEFAULT '', reviewer_id CHAR(36) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (reporter_id) REFERENCES users(id),
 FOREIGN KEY (reviewer_id) REFERENCES users(id)
);
