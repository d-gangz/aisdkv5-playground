import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

export default defineConfig({
  // Schema location
  schema: './lib/db/schema.ts',

  // Migration output directory
  out: './drizzle',

  // Database type
  dialect: 'postgresql',

  // Connection from env
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

