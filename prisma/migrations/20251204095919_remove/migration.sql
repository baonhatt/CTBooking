/*
  Warnings:

  - You are about to drop the column `price` on the `movies` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `showtimes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "movies" DROP COLUMN "price";

-- AlterTable
ALTER TABLE "showtimes" DROP COLUMN "price";
