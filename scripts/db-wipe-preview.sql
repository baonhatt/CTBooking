-- Empties the PREVIEW database before a copy of prod is imported into it (see docs/huong-dan-migrate-live-va-clone-preview.md).
-- Run ONLY with:  --env preview  (database cinema-db-preview). Never against prod.
-- Tables that point to other tables are dropped first. The new tables of migrations 0002/0003 are included in case
-- preview already has them.
PRAGMA defer_foreign_keys = TRUE;
DROP TABLE IF EXISTS "unmatched_transfers";
DROP TABLE IF EXISTS "register_pending";
DROP TABLE IF EXISTS "audit_logs";
DROP TABLE IF EXISTS "booking_vr_items";
DROP TABLE IF EXISTS "d1_migrations";
DROP TABLE IF EXISTS "email_logs";
DROP TABLE IF EXISTS "posts";
DROP TABLE IF EXISTS "role_permissions";
DROP TABLE IF EXISTS "showtimes";
DROP TABLE IF EXISTS "site_media";
DROP TABLE IF EXISTS "staff_branches";
DROP TABLE IF EXISTS "staff_roles";
DROP TABLE IF EXISTS "staff_tokens";
DROP TABLE IF EXISTS "tokens";
DROP TABLE IF EXISTS "toys";
DROP TABLE IF EXISTS "voucher_redemption_logs";
DROP TABLE IF EXISTS "accounts";
DROP TABLE IF EXISTS "bookings";
DROP TABLE IF EXISTS "permissions";
DROP TABLE IF EXISTS "roles";
DROP TABLE IF EXISTS "movies";
DROP TABLE IF EXISTS "ticket_packages";
DROP TABLE IF EXISTS "users";
DROP TABLE IF EXISTS "vouchers";
DROP TABLE IF EXISTS "branches";
DROP TABLE IF EXISTS "staffs";
