-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_method" VARCHAR(50) NOT NULL DEFAULT 'cash',
ADD COLUMN     "payment_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
ADD COLUMN     "transaction_id" VARCHAR(255),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
