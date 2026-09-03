-- Migration 0015: Add payment_expires_at to bookings for auto-expiry support
-- Created: 2026-09-03

ALTER TABLE bookings ADD COLUMN payment_expires_at TEXT;
