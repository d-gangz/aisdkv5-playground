/**
 * Database relationship definitions for Drizzle ORM
 *
 * Enables type-safe relational queries with Drizzle
 *
 * Input data sources: Schema definitions
 * Output destinations: Drizzle query builder
 * Dependencies: drizzle-orm, ./schema
 * Key exports: chatsRelations, messagesRelations, partsRelations
 * Side effects: None (relations only)
 */

import { relations } from 'drizzle-orm';
import { chats, messages, parts } from './schema';

// One chat has many messages
export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
}));

// Each message belongs to one chat and has many parts
export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  parts: many(parts),
}));

// Each part belongs to one message
export const partsRelations = relations(parts, ({ one }) => ({
  message: one(messages, {
    fields: [parts.messageId],
    references: [messages.id],
  }),
}));

