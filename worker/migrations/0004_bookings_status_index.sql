-- The expiry cron (every 2 minutes, worker/wrangler.toml) looks for pending orders past their deadline. Without an
-- index on the status it read the whole bookings table on every run; with it, only the few pending orders.
CREATE INDEX IF NOT EXISTS `idx_bookings_status_expires` ON `bookings` (`payment_status`, `payment_expires_at`);
