-- Migration: Allow user_id to be NULL in bookings table for guest bookings
-- SQLite doesn't support ALTER COLUMN, so we need to rebuild the table

-- Step 1: Create new table with nullable user_id
CREATE TABLE "bookings_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,  -- Changed from NOT NULL to nullable
    "ticket_count" INTEGER NOT NULL DEFAULT 1,
    "total_price" REAL NOT NULL,
    "created_at" INTEGER NOT NULL DEFAULT (unixepoch()),
    "paid_at" INTEGER,
    "payment_method" TEXT DEFAULT 'cash',
    "payment_status" TEXT DEFAULT 'pending',
    "transaction_id" TEXT,
    "updated_at" INTEGER NOT NULL DEFAULT (unixepoch()),
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "booking_code" TEXT UNIQUE,
    "is_used" INTEGER DEFAULT 0,
    "movie_id" INTEGER,
    "ticket_package_id" INTEGER,
    "expiry_date" INTEGER,
    CONSTRAINT "bookings_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies" ("id") ON DELETE CASCADE,
    CONSTRAINT "bookings_ticket_package_id_fkey" FOREIGN KEY ("ticket_package_id") REFERENCES "ticket_packages" ("id") ON DELETE SET NULL,
    CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Step 2: Copy data from old table to new table
INSERT INTO "bookings_new" 
SELECT * FROM "bookings";

-- Step 3: Drop old table
DROP TABLE "bookings";

-- Step 4: Rename new table to original name
ALTER TABLE "bookings_new" RENAME TO "bookings";

