CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`login_type` text DEFAULT 'email' NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer,
	`staff_email` text,
	`staff_fullname` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`old_values` text,
	`new_values` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staffs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`ticket_count` integer DEFAULT 1 NOT NULL,
	`total_price` real NOT NULL,
	`created_at` text NOT NULL,
	`paid_at` text,
	`payment_method` text DEFAULT 'cash',
	`payment_status` text DEFAULT 'pending',
	`transaction_id` text,
	`updated_at` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`booking_code` text,
	`pay_txt_code` text,
	`combo` text,
	`movie_title` text,
	`movie_duration` text,
	`movie_poster` text,
	`ticket_package_name` text,
	`ticket_unit_price` real,
	`is_used` integer DEFAULT false,
	`movie_id` integer,
	`ticket_package_id` integer,
	`expiry_date` text,
	`checked_in_at` text,
	`branch_id` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ticket_package_id`) REFERENCES `ticket_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_booking_code_unique` ON `bookings` (`booking_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_pay_txt_code_unique` ON `bookings` (`pay_txt_code`);--> statement-breakpoint
CREATE TABLE `branches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`address` text,
	`phone` text,
	`email` text,
	`is_default` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branches_code_unique` ON `branches` (`code`);--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`email_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text,
	`error_message` text,
	`user_id` integer,
	`booking_id` integer,
	`metadata` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `movies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_image` text,
	`detail_images` text,
	`genres` text,
	`rating` real,
	`duration_min` integer,
	`branch_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_active` integer DEFAULT true,
	`release_date` text,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module` text NOT NULL,
	`action` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text,
	`content` text NOT NULL,
	`excerpt` text,
	`featured_image` text,
	`meta_description` text,
	`meta_keywords` text,
	`seo_title` text,
	`og_image` text,
	`canonical_url` text,
	`schema_type` text DEFAULT 'Article',
	`author_id` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_featured` integer DEFAULT false,
	`view_count` integer DEFAULT 0,
	`published_at` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` integer NOT NULL,
	`permission_id` integer NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_system` integer DEFAULT false NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);--> statement-breakpoint
CREATE TABLE `site_media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`section` text NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`description` text,
	`public_id` text,
	`url` text NOT NULL,
	`format` text,
	`width` integer,
	`height` integer,
	`duration` real,
	`display_order` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_branches` (
	`staff_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staffs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `staff_roles` (
	`staff_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staffs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `staff_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer NOT NULL,
	`token` text NOT NULL,
	`type` text DEFAULT 'session' NOT NULL,
	`expired_at` text NOT NULL,
	`revoked_at` text,
	`revoke_reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staffs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_tokens_token_unique` ON `staff_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `staffs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`fullname` text NOT NULL,
	`phone` text,
	`avatar` text,
	`is_super_admin` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`force_password_change` integer DEFAULT false NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staffs_email_unique` ON `staffs` (`email`);--> statement-breakpoint
CREATE TABLE `ticket_packages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`description` text,
	`price` real NOT NULL,
	`features` text,
	`type` text,
	`combo` text,
	`min_group_size` integer,
	`max_group_size` integer,
	`is_member_only` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`display_order` integer DEFAULT 0,
	`branch_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_packages_code_unique` ON `ticket_packages` (`code`);--> statement-breakpoint
CREATE TABLE `tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`type` text NOT NULL,
	`token` text NOT NULL,
	`expired_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_token_unique` ON `tokens` (`token`);--> statement-breakpoint
CREATE TABLE `toys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`price` real NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`image_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fullname` text,
	`phone` text,
	`avatar` text,
	`gender` text,
	`dob` text,
	`created_at` text,
	`updated_at` text
);
