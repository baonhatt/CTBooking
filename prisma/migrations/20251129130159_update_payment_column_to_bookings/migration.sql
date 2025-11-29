-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "ticket_count" SET DEFAULT 1,
ALTER COLUMN "payment_method" DROP NOT NULL,
ALTER COLUMN "payment_status" DROP NOT NULL;
