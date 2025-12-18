import { bookings } from "../db/schema";
import { eq } from "drizzle-orm";
import "dotenv/config";
export * from "./email-templates";

/**
 * Generate unique booking code (8 random alphanumeric characters)
 * Check database to avoid duplicates
 * Format: XXXXXXXX (e.g., A7K9M2B5)
 */
export async function generateBookingCode(anyDb: any): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let isUnique = false;
  let bookingCode = "";

  while (!isUnique) {
    // Generate random string (8 chars)
    bookingCode = "";
    for (let i = 0; i < 8; i++) {
      bookingCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if code already exists in database
    const existing = await anyDb.query.bookings.findFirst({
      where: eq(bookings.booking_code, bookingCode),
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return bookingCode;
}
