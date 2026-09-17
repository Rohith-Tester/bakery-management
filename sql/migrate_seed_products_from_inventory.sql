-- Seeds the Product Catalog with your existing finished-good items that
-- were (incorrectly) being sold straight out of Inventory — Baguette,
-- Banana Bread Loaf, Blueberry Muffin, Brownie, Cheesecake Slice,
-- Chocolate Cake, Chocolate Chip Cookie, Cinnamon Roll, Croissant, Garlic
-- Bread, Glazed Donut, Red Velvet Cupcake.
--
-- For each one (if it isn't already in Product Catalog), this creates:
--   1. A simple "passthrough" Recipe whose one ingredient IS that same
--      inventory row (quantity 1, yield 1) — so the Inventory quantity you
--      already track for e.g. "Chocolate Cake" keeps being exactly what
--      determines how many are orderable, with no behavior change yet.
--   2. A Product Catalog entry linked to that recipe, with the same image
--      and a selling price computed the same way this app already
--      suggests retail prices from cost (cost x 2.6, rounded to nearest 5).
--
-- This is a transitional bridge, not the final state: for real
-- ingredient-level stock tracking (e.g. "Chocolate Cake" consuming flour +
-- sugar + eggs + cocoa), go into Recipe Management afterwards and replace
-- each passthrough recipe with a real one built from your raw ingredients.
--
-- Raw ingredients (Flour, Butter, Eggs, Sugar, Vanilla Extract, Yeast,
-- Cocoa Powder, Heavy Cream, etc.) are intentionally left alone — they
-- stay in Inventory only and are never added to Product Catalog.
--
-- Safe to re-run: skips any product name that's already in Product Catalog.
-- Usage: mysql -u root -p bakery_db < sql/migrate_seed_products_from_inventory.sql
-- Requires migrate_product_catalog.sql to have been run first.

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_finished_products $$
CREATE PROCEDURE seed_finished_products()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_name VARCHAR(150);
  DECLARE v_category VARCHAR(100);
  DECLARE v_sku VARCHAR(50);
  DECLARE v_invid CHAR(36);
  DECLARE v_cost DECIMAL(12,2);
  DECLARE v_img LONGTEXT;
  DECLARE v_unit VARCHAR(20);
  DECLARE v_recipe_id CHAR(36);
  DECLARE v_product_id CHAR(36);
  DECLARE v_exists INT;
  DECLARE cur CURSOR FOR SELECT name, category, sku FROM tmp_seed_products;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  DROP TEMPORARY TABLE IF EXISTS tmp_seed_products;
  CREATE TEMPORARY TABLE tmp_seed_products (name VARCHAR(150), category VARCHAR(100), sku VARCHAR(50));
  INSERT INTO tmp_seed_products (name, category, sku) VALUES
    ('Baguette', 'Breads', 'BREAD-BAGUETTE-001'),
    ('Banana Bread Loaf', 'Breads', 'BREAD-BANANA-001'),
    ('Blueberry Muffin', 'Muffins', 'MUFFIN-BLUEBERRY-001'),
    ('Brownie', 'Cookies & Bars', 'BAR-BROWNIE-001'),
    ('Cheesecake Slice', 'Cakes', 'CAKE-CHEESECAKE-001'),
    ('Chocolate Cake', 'Cakes', 'CAKE-CHOC-001'),
    ('Chocolate Chip Cookie', 'Cookies & Bars', 'COOKIE-CHOCCHIP-001'),
    ('Cinnamon Roll', 'Pastries', 'PASTRY-CINNAMON-001'),
    ('Croissant', 'Pastries', 'PASTRY-CROISSANT-001'),
    ('Garlic Bread', 'Breads', 'BREAD-GARLIC-001'),
    ('Glazed Donut', 'Donuts', 'DONUT-GLAZED-001'),
    ('Red Velvet Cupcake', 'Cupcakes', 'CUPCAKE-REDVELVET-001');

  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_name, v_category, v_sku;
    IF done THEN
      LEAVE read_loop;
    END IF;

    SET v_exists = (SELECT COUNT(*) FROM products WHERE name = v_name);
    IF v_exists = 0 THEN
      SET v_invid = NULL;
      SELECT id, cost_per_unit, image_url, unit INTO v_invid, v_cost, v_img, v_unit
        FROM inventory WHERE name = v_name LIMIT 1;

      IF v_invid IS NOT NULL THEN
        SET v_recipe_id = UUID();
        SET v_product_id = UUID();

        INSERT INTO recipes (id, name, category, linked_item_id, yield_qty, yield_unit)
          VALUES (v_recipe_id, CONCAT(v_name, ' (Finished Item)'), v_category, v_invid, 1, IFNULL(v_unit, 'pcs'));

        INSERT INTO recipe_ingredients (recipe_id, item_id, item_name, quantity, unit)
          VALUES (v_recipe_id, v_invid, v_name, 1, IFNULL(v_unit, 'pcs'));

        INSERT INTO products (id, name, sku, category, selling_price, image_url, is_available, recipe_id, description)
          VALUES (v_product_id, v_name, v_sku, v_category, GREATEST(10, ROUND((IFNULL(v_cost, 0) * 2.6) / 5) * 5), v_img, 1, v_recipe_id, '');
      END IF;
    END IF;
  END LOOP;
  CLOSE cur;
  DROP TEMPORARY TABLE IF EXISTS tmp_seed_products;
END $$

DELIMITER ;

CALL seed_finished_products();
DROP PROCEDURE IF EXISTS seed_finished_products;
