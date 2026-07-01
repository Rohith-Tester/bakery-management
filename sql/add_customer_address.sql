-- Migration: Add address fields to customers table
-- Run this once: mysql -u root -p bakery_db < sql/add_customer_address.sql

USE bakery_db;

-- Add address columns to customers table if they don't exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address VARCHAR(255) DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20) DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_notes TEXT DEFAULT '';
