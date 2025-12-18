-- Migration: Allow user_id to be NULL in bookings table for guest bookings
-- Postgres supports ALTER COLUMN, so this is simpler than SQLite

-- Step 1: Drop the NOT NULL constraint if it exists
ALTER TABLE "bookings" 
ALTER COLUMN "user_id" DROP NOT NULL;

-- Note: The foreign key constraint will remain, but it will allow NULL values
-- This allows guest bookings (users without accounts) to create bookings

