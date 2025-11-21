/**
 * Drizzle ORM database client setup
 *
 * Input data sources: DATABASE_URL environment variable
 * Output destinations: Drizzle client instance for queries
 * Dependencies: drizzle-orm/postgres-js, postgres, schema, relations
 * Key exports: db (Drizzle client)
 * Side effects: Creates database connection
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as relations from './relations';

// Postgres connection string from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL environment variable is not set. ' +
      'Please add it to .env.local with your Supabase connection string.'
  );
}

// Create postgres client
// Note: prepare: false is required for Supabase connection pooler in Transaction mode
const client = postgres(connectionString, { prepare: false });

// Create and export Drizzle instance with schema
export const db = drizzle(client, {
  schema: { ...schema, ...relations },
});
