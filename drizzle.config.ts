import type { Config } from 'drizzle-kit';

export default {
  schema: './worker/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite', // Thay cho postgresql
} satisfies Config;
