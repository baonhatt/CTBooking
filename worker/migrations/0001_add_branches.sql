-- Add branches table
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Add branch_id to movies
ALTER TABLE movies ADD COLUMN branch_id INTEGER REFERENCES branches(id);

-- Add branch_id to ticket_packages
ALTER TABLE ticket_packages ADD COLUMN branch_id INTEGER REFERENCES branches(id);

-- Add branch_id to bookings
ALTER TABLE bookings ADD COLUMN branch_id INTEGER REFERENCES branches(id);
