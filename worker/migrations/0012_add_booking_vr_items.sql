-- Migration 0012: Add booking_vr_items table for multi-VR-package support
-- Each booking can now have multiple VR packages with different quantities
-- NOTE: User confirmed this migration has NOT been run yet. Full edit allowed.
-- Added columns: voucher_id (per-item), discounted_unit_price, line_total,
-- voucher_discount_amount (snapshot), branch_id (for branch-level reporting)

CREATE TABLE IF NOT EXISTS booking_vr_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  vr_ticket_package_id INTEGER NOT NULL REFERENCES ticket_packages(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  package_name TEXT NOT NULL,
  voucher_id INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
  discounted_unit_price REAL,
  line_total REAL NOT NULL,
  voucher_discount_amount REAL DEFAULT 0,
  branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_booking_vr_items_booking_id ON booking_vr_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_vr_items_vr_package_id ON booking_vr_items(vr_ticket_package_id);
CREATE INDEX IF NOT EXISTS idx_booking_vr_items_branch_id ON booking_vr_items(branch_id);
