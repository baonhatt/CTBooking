-- Repair schema drift on preview DB (columns missing despite earlier migration records)

-- branches: align with schema.ts
ALTER TABLE branches ADD COLUMN is_default INTEGER DEFAULT 0;
ALTER TABLE branches ADD COLUMN deleted_at TEXT;
ALTER TABLE branches ADD COLUMN deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL;

-- movies
ALTER TABLE movies ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE movies ADD COLUMN deleted_at TEXT;
ALTER TABLE movies ADD COLUMN deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL;

-- ticket_packages
ALTER TABLE ticket_packages ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE ticket_packages ADD COLUMN deleted_at TEXT;
ALTER TABLE ticket_packages ADD COLUMN deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL;

-- toys
ALTER TABLE toys ADD COLUMN deleted_at TEXT;

-- site_media
ALTER TABLE site_media ADD COLUMN deleted_at TEXT;

-- roles: upgrade legacy schema (permissions column retained for compatibility)
ALTER TABLE roles ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;
ALTER TABLE roles ADD COLUMN level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE roles ADD COLUMN created_at TEXT;
ALTER TABLE roles ADD COLUMN updated_at TEXT;
ALTER TABLE roles ADD COLUMN deleted_at TEXT;
ALTER TABLE roles ADD COLUMN deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL;
UPDATE roles SET created_at = COALESCE(created_at, datetime('now')), updated_at = COALESCE(updated_at, datetime('now'));

-- bookings
ALTER TABLE bookings ADD COLUMN confirmed_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL;

-- indexes
CREATE INDEX IF NOT EXISTS idx_movies_deleted_at ON movies (deleted_at);
CREATE INDEX IF NOT EXISTS idx_ticket_packages_deleted_at ON ticket_packages (deleted_at);
CREATE INDEX IF NOT EXISTS idx_toys_deleted_at ON toys (deleted_at);
CREATE INDEX IF NOT EXISTS idx_site_media_deleted_at ON site_media (deleted_at);
CREATE INDEX IF NOT EXISTS idx_branches_deleted_at ON branches (deleted_at);
CREATE INDEX IF NOT EXISTS idx_roles_deleted_at ON roles (deleted_at);
CREATE INDEX IF NOT EXISTS idx_staffs_deleted_at ON staffs (deleted_at);
CREATE INDEX IF NOT EXISTS idx_bookings_confirmed_by_staff_id ON bookings (confirmed_by_staff_id);
