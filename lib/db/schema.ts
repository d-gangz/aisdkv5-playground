/**
 * Database schema definitions for Drizzle ORM
 *
 * Input data sources: None (schema definition)
 * Output destinations: Drizzle ORM type system, SQL migrations
 * Dependencies: drizzle-orm/pg-core
 * Key exports: chats, messages table schemas
 * Side effects: None (schema only)
 */

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// Chats table - represents a conversation session
export const chats = pgTable('chats', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Messages table - individual messages in a chat
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatId: uuid('chat_id')
    .references(() => chats.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// TypeScript types inferred from schema
export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

