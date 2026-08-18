-- Migration: Enhance email_logs with recipient_type and staff_id
-- To support Auth Hardening traceability

-- Add recipient_type to distinguish between user and staff
ALTER TABLE email_logs ADD COLUMN recipient_type TEXT DEFAULT 'user';

-- Add staff_id for tracking staff-related email events
ALTER TABLE email_logs ADD COLUMN staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL;
