CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text,
	`content` text NOT NULL,
	`excerpt` text,
	`featured_image` text,
	`author_id` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_featured` integer DEFAULT false,
	`view_count` integer DEFAULT 0,
	`published_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);
