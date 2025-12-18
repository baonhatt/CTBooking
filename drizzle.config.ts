import type { Config } from "drizzle-kit";

export default {
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",               // thay cho driver: "pg"
  dbCredentials: {
    url: process.env.DATABASE_URL as string, // thay connectionString -> url
  },
} satisfies Config;