-- Migration: Add email_logs table for tracking email delivery (D1/SQLite)
-- Created: 2026-01-02

CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  error_message TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  metadata TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_booking_id ON email_logs(booking_id);
