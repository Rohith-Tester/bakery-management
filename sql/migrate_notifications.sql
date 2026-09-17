-- Run this on an EXISTING bakery_db database to add the notifications
-- system: admins/staff get notified when a new order comes in; customers
-- and delivery partners get notified when order status changes.
-- Usage: mysql -u root -p bakery_db < migrate_notifications.sql

USE bakery_db;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  recipient_role ENUM('management') NULL,
  recipient_user_id CHAR(36) NULL,
  order_id CHAR(36) NULL,
  message VARCHAR(255) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;
