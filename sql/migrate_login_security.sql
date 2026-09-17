-- Migration: adds login-throttling table for brute-force protection.
-- Safe to run on an existing bakery_db database; safe to re-run.

USE bakery_db;

CREATE TABLE IF NOT EXISTS login_attempts (
  identifier VARCHAR(191) PRIMARY KEY,
  fail_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
