-- Daily repeating showtimes, one movie per slot, scoped to a single branch.

CREATE TABLE `showtimes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`movie_id` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `idx_showtimes_branch_id` ON `showtimes` (`branch_id`);
CREATE INDEX `idx_showtimes_branch_start` ON `showtimes` (`branch_id`, `start_time`);

INSERT INTO permissions (module, action, description) VALUES ('showtimes', 'view', 'Xem lịch chiếu');
INSERT INTO permissions (module, action, description) VALUES ('showtimes', 'create', 'Thêm suất chiếu');
INSERT INTO permissions (module, action, description) VALUES ('showtimes', 'edit', 'Sửa suất chiếu');
INSERT INTO permissions (module, action, description) VALUES ('showtimes', 'delete', 'Xóa suất chiếu');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'manager' AND p.module = 'showtimes' AND p.action IN ('view', 'create', 'edit');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.module = 'showtimes' AND p.action IN ('view', 'create', 'edit', 'delete');
