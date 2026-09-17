-- Splits the old single "picked_up" step into two distinct confirmations:
--   1. picked_up  — the delivery partner has collected the item from the
--                    customer (OTP-confirmed), same as before.
--   2. received   — the admin/staff has confirmed the item actually arrived
--                    back at the bakery, before a refund can be issued.
-- This avoids the previous confusion where the delivery partner's pickup
-- confirmation displayed as "Product Received" even though the item hadn't
-- reached the bakery yet.
ALTER TABLE returns
  MODIFY COLUMN status ENUM('requested','approved','pickup_assigned','picked_up','received','rejected','refunded')
  NOT NULL DEFAULT 'requested';
