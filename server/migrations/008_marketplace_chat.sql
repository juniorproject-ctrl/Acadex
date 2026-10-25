ALTER TABLE listings ADD pickup_available BOOLEAN NOT NULL DEFAULT TRUE, ADD seller_delivery BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payment_orders ADD handover_method ENUM('pickup','seller_delivery') NULL;
CREATE TABLE IF NOT EXISTS listing_conversations (
 id CHAR(36) PRIMARY KEY,
 listing_id CHAR(36) NULL,
 listing_title VARCHAR(240) NOT NULL,
 buyer_id CHAR(36) NOT NULL,
 seller_id CHAR(36) NOT NULL,
 buyer_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
 seller_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY listing_buyer (listing_id,buyer_id),
 FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
 FOREIGN KEY (buyer_id) REFERENCES users(id),
 FOREIGN KEY (seller_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS listing_messages (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 conversation_id CHAR(36) NOT NULL,
 sender_id CHAR(36) NOT NULL,
 body VARCHAR(2000) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (conversation_id) REFERENCES listing_conversations(id) ON DELETE CASCADE,
 FOREIGN KEY (sender_id) REFERENCES users(id),
 INDEX conversation_messages (conversation_id,id)
);
