-- Add deleted_at columns for soft delete functionality
ALTER TABLE `movies` ADD COLUMN `deleted_at` text;--> statement-breakpoint
ALTER TABLE `ticket_packages` ADD COLUMN `deleted_at` text;--> statement-breakpoint
ALTER TABLE `toys` ADD COLUMN `deleted_at` text;--> statement-breakpoint
ALTER TABLE `site_media` ADD COLUMN `deleted_at` text;--> statement-breakpoint
ALTER TABLE `branches` ADD COLUMN `deleted_at` text;--> statement-breakpoint
ALTER TABLE `roles` ADD COLUMN `deleted_at` text;--> statement-breakpoint
ALTER TABLE `staffs` ADD COLUMN `deleted_at` text;--> statement-breakpoint

-- Add confirmed_by_staff_id column to bookings for tracking who confirmed the booking
ALTER TABLE `bookings` ADD COLUMN `confirmed_by_staff_id` integer;--> statement-breakpoint

-- Add foreign key constraint for confirmed_by_staff_id
-- Note: SQLite doesn't support adding foreign key constraints to existing tables directly
-- The constraint is already defined in the schema.ts and will be applied when recreating the table

-- Create indexes for deleted_at columns to optimize queries
CREATE INDEX `idx_movies_deleted_at` ON `movies` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_ticket_packages_deleted_at` ON `ticket_packages` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_toys_deleted_at` ON `toys` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_site_media_deleted_at` ON `site_media` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_branches_deleted_at` ON `branches` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_roles_deleted_at` ON `roles` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_staffs_deleted_at` ON `staffs` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_bookings_confirmed_by_staff_id` ON `bookings` (`confirmed_by_staff_id`);
