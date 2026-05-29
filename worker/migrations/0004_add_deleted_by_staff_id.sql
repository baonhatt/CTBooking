-- Add deleted_by_staff_id columns to track who deleted records
-- This helps with audit trail and showing "deleted by" information

-- Add to movies table
ALTER TABLE movies ADD COLUMN deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL;

-- Add to ticket_packages table
ALTER TABLE ticket_packages ADD COLUMN deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL;

-- Add to branches table
ALTER TABLE branches ADD COLUMN deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL;

-- Add to staffs table (self-reference)
ALTER TABLE staffs ADD COLUMN deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL;

-- Add to roles table
ALTER TABLE roles ADD COLUMN deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL;
