-- Branch links as tables instead of JSON text columns (docs/ke-hoach-tai-cau-truc-chi-nhanh.md).
-- Only adds tables, columns and indexes: no existing row or value is changed here. The old columns
-- (branch_id, branch_ids, combo, the voucher JSON lists) stay in the database untouched; the code no longer reads them.
-- The data of the old columns is copied into the new tables by scripts/migrate-branch-links.cjs.
-- A link row means "offered at that branch"; taking a record off a branch deletes its row. Price and display order
-- are the record's own (one price for every branch of a package).

-- ===== WHERE A MOVIE IS SHOWN =====
CREATE TABLE IF NOT EXISTS `movie_branches` (
  `movie_id` integer NOT NULL REFERENCES `movies`(`id`) ON DELETE CASCADE,
  `branch_id` integer NOT NULL REFERENCES `branches`(`id`) ON DELETE RESTRICT,
  PRIMARY KEY (`movie_id`, `branch_id`)
);
CREATE INDEX IF NOT EXISTS `idx_movie_branches_branch` ON `movie_branches` (`branch_id`, `movie_id`);

-- ===== WHERE A PACKAGE IS SOLD =====
CREATE TABLE IF NOT EXISTS `package_branches` (
  `package_id` integer NOT NULL REFERENCES `ticket_packages`(`id`) ON DELETE CASCADE,
  `branch_id` integer NOT NULL REFERENCES `branches`(`id`) ON DELETE RESTRICT,
  PRIMARY KEY (`package_id`, `branch_id`)
);
CREATE INDEX IF NOT EXISTS `idx_package_branches_branch` ON `package_branches` (`branch_id`, `package_id`);

-- ===== THE MOVIES OF A PACKAGE (movie_scope = 'selected') =====
CREATE TABLE IF NOT EXISTS `package_movies` (
  `package_id` integer NOT NULL REFERENCES `ticket_packages`(`id`) ON DELETE CASCADE,
  `movie_id` integer NOT NULL REFERENCES `movies`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`package_id`, `movie_id`)
);
CREATE INDEX IF NOT EXISTS `idx_package_movies_movie` ON `package_movies` (`movie_id`);

-- ===== VOUCHERS: BRANCHES AND PACKAGES =====
CREATE TABLE IF NOT EXISTS `voucher_branches` (
  `voucher_id` integer NOT NULL REFERENCES `vouchers`(`id`) ON DELETE CASCADE,
  `branch_id` integer NOT NULL REFERENCES `branches`(`id`) ON DELETE RESTRICT,
  PRIMARY KEY (`voucher_id`, `branch_id`)
);
CREATE TABLE IF NOT EXISTS `voucher_packages` (
  `voucher_id` integer NOT NULL REFERENCES `vouchers`(`id`) ON DELETE CASCADE,
  `package_id` integer NOT NULL REFERENCES `ticket_packages`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`voucher_id`, `package_id`)
);

-- ===== POSTS AND SITE MEDIA =====
CREATE TABLE IF NOT EXISTS `post_branches` (
  `post_id` integer NOT NULL REFERENCES `posts`(`id`) ON DELETE CASCADE,
  `branch_id` integer NOT NULL REFERENCES `branches`(`id`) ON DELETE RESTRICT,
  PRIMARY KEY (`post_id`, `branch_id`)
);
CREATE TABLE IF NOT EXISTS `site_media_branches` (
  `media_id` integer NOT NULL REFERENCES `site_media`(`id`) ON DELETE CASCADE,
  `branch_id` integer NOT NULL REFERENCES `branches`(`id`) ON DELETE RESTRICT,
  PRIMARY KEY (`media_id`, `branch_id`)
);

-- ===== NEW COLUMNS (the defaults keep every existing row and every row written by the old code valid) =====
ALTER TABLE `movies` ADD COLUMN `all_branches` integer NOT NULL DEFAULT 0;
ALTER TABLE `ticket_packages` ADD COLUMN `all_branches` integer NOT NULL DEFAULT 0;
ALTER TABLE `ticket_packages` ADD COLUMN `movie_scope` text NOT NULL DEFAULT 'selected';
ALTER TABLE `vouchers` ADD COLUMN `all_branches` integer NOT NULL DEFAULT 0;
ALTER TABLE `vouchers` ADD COLUMN `all_packages` integer NOT NULL DEFAULT 0;
ALTER TABLE `posts` ADD COLUMN `all_branches` integer NOT NULL DEFAULT 0;
ALTER TABLE `site_media` ADD COLUMN `all_branches` integer NOT NULL DEFAULT 0;

-- ===== INDEXES FOR BRANCH REPORTS AND SCHEDULES =====
CREATE INDEX IF NOT EXISTS `idx_bookings_branch_created` ON `bookings` (`branch_id`, `created_at`);
CREATE INDEX IF NOT EXISTS `idx_showtimes_branch_start` ON `showtimes` (`branch_id`, `start_time`);
