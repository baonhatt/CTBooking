-- Alter bookings: make showtime_id nullable and add is_used column
ALTER TABLE "bookings"
  ALTER COLUMN "showtime_id" DROP NOT NULL;

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "is_used" BOOLEAN NOT NULL DEFAULT false;

-- Optional: ensure booking_code remains unique (already defined in Prisma)
-- CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_code_idx ON "bookings" ("booking_code");

