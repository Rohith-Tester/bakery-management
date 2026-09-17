-- Renames the bakery to "Golden Crust Bakery" for installs that already
-- ran migrate_store_settings.sql / migrate_settings_extended.sql before
-- this name change (those only set the name on first insert, so an
-- existing row keeps its old value until updated here).
-- Usage: mysql -u root -p bakery_db < sql/migrate_rename_bakery.sql
--
-- Safe to skip if you'd rather just retype the name in Settings > Store
-- Settings in the app instead.

UPDATE store_settings SET bakery_name = 'Golden Crust Bakery' WHERE id = 1;
