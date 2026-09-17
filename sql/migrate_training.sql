-- Adds the Staff Training module to an existing database.
-- Safe to re-run.
-- Usage: mysql -u root -p bakery_db < sql/migrate_training.sql

CREATE TABLE IF NOT EXISTS training_materials (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  category VARCHAR(100) DEFAULT '',
  description TEXT,
  resource_url VARCHAR(500) DEFAULT '',
  duration_minutes INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- One row per (material, staff member) who has marked it complete. A
-- unique key on the pair means "mark complete" is naturally idempotent —
-- the same person completing the same material twice just no-ops.
CREATE TABLE IF NOT EXISTS training_completions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_material_user (material_id, user_id),
  FOREIGN KEY (material_id) REFERENCES training_materials(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
