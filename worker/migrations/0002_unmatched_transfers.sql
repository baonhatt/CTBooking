-- Money that reached the bank account but matched no order (see shared/schema.ts, unmatched_transfers)
CREATE TABLE IF NOT EXISTS `unmatched_transfers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sepay_id` text,
  `amount` integer DEFAULT 0 NOT NULL,
  `content` text,
  `bank_ref` text,
  `transfer_at` text,
  `status` text DEFAULT 'open' NOT NULL,
  `booking_id` integer,
  `note` text,
  `resolved_by_staff_id` integer,
  `resolved_by_name` text,
  `resolved_at` text,
  `created_at` text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `unmatched_transfers_sepay_id_unique` ON `unmatched_transfers` (`sepay_id`);
CREATE INDEX IF NOT EXISTS `unmatched_transfers_status_idx` ON `unmatched_transfers` (`status`, `created_at`);
