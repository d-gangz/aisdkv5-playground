/**
 * Database relationship definitions for Drizzle ORM
 *
 * Input data sources: Schema definitions
 * Output destinations: Drizzle query builder
 * Dependencies: drizzle-orm, ./schema
 * Key exports: chatsRelations, messagesRelations
 * Side effects: None (relations only)
 */

import { relations } from 'drizzle-orm';
import { chats, messages } from './schema';

// One chat has many messages
export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
}));

// Each message belongs to one chat
export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
}));

