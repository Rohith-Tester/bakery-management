-- Adds a set of ready-to-sell finished bakery items (with real product
-- photos) to the Inventory table, which is what powers the New Order / POS
-- item grid customers and staff order from.
--
-- Images link to real photographs hosted on Wikimedia Commons via their
-- stable Special:FilePath redirect (e.g. .../Special:FilePath/Croissant.jpg
-- always resolves to the current original file for that filename) -- all
-- freely licensed (public domain / CC) and safe to hotlink and display.
-- Requires your server/browser to have internet access to load them; if you
-- run fully offline, re-run sql/seed_more_bakery_items.sql instead (uses
-- self-contained inline icon images).
--
-- Skips any item whose name already exists, so it's safe to run more than
-- once, and safe to run alongside the icon-based seed file (it will just
-- update... actually it will skip, since the name already exists -- delete
-- the old row first in Inventory if you want to replace an icon with a
-- real photo for the same item name).
-- Usage: mysql -u root -p bakery_db < sql/seed_more_bakery_items_real_photos.sql

USE bakery_db;

INSERT INTO inventory (id, name, quantity, unit, min_stock, cost_per_unit, image_url)
SELECT UUID(), n.name, n.quantity, n.unit, n.min_stock, n.cost_per_unit, n.image_url
FROM (
  SELECT 'Croissant' AS name, 40 AS quantity, 'pcs' AS unit, 10 AS min_stock, 40 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Croissant.jpg' AS image_url
  UNION ALL
  SELECT 'Chocolate Cake' AS name, 8 AS quantity, 'pcs' AS unit, 2 AS min_stock, 350 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chocolate_cake_%281%29.jpg' AS image_url
  UNION ALL
  SELECT 'Red Velvet Cupcake' AS name, 60 AS quantity, 'pcs' AS unit, 15 AS min_stock, 45 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Cupcake_with_sugar_hearts_and_nonpareils.jpg' AS image_url
  UNION ALL
  SELECT 'Blueberry Muffin' AS name, 45 AS quantity, 'pcs' AS unit, 12 AS min_stock, 50 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Blueberry_muffin.JPG' AS image_url
  UNION ALL
  SELECT 'Glazed Donut' AS name, 50 AS quantity, 'pcs' AS unit, 15 AS min_stock, 30 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Donut.jpg' AS image_url
  UNION ALL
  SELECT 'Chocolate Chip Cookie' AS name, 80 AS quantity, 'pcs' AS unit, 20 AS min_stock, 20 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chocolate_chip_cookie.jpg' AS image_url
  UNION ALL
  SELECT 'Banana Bread Loaf' AS name, 15 AS quantity, 'pcs' AS unit, 4 AS min_stock, 120 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Freshly_baked_banana_bread.jpg' AS image_url
  UNION ALL
  SELECT 'Cinnamon Roll' AS name, 35 AS quantity, 'pcs' AS unit, 10 AS min_stock, 55 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Cinnamon_roll.jpg' AS image_url
  UNION ALL
  SELECT 'Baguette' AS name, 25 AS quantity, 'pcs' AS unit, 6 AS min_stock, 60 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Baguette.jpg' AS image_url
  UNION ALL
  SELECT 'Brownie' AS name, 50 AS quantity, 'pcs' AS unit, 12 AS min_stock, 40 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Chocolatebrownie.JPG' AS image_url
  UNION ALL
  SELECT 'Cheesecake Slice' AS name, 20 AS quantity, 'pcs' AS unit, 5 AS min_stock, 90 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Basque-cheesecake.jpg' AS image_url
  UNION ALL
  SELECT 'Garlic Bread' AS name, 20 AS quantity, 'pcs' AS unit, 5 AS min_stock, 70 AS cost_per_unit, 'https://commons.wikimedia.org/wiki/Special:FilePath/Garlic_bread.jpg' AS image_url
) AS n
WHERE NOT EXISTS (
  SELECT 1 FROM inventory i
  WHERE CONVERT(i.name USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(n.name USING utf8mb4) COLLATE utf8mb4_unicode_ci
);
