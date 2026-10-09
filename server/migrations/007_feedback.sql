CREATE TABLE IF NOT EXISTS feedback (
 id CHAR(36) PRIMARY KEY,
 name VARCHAR(100) NOT NULL DEFAULT '',
 category ENUM('suggestion','problem','comment') NOT NULL,
 message TEXT NOT NULL,
 status ENUM('new','reviewed') NOT NULL DEFAULT 'new',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
