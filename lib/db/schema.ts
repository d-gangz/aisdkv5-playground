/**
 * Database schema for AI SDK message persistence
 *
 * Simplified schema supporting core message part types:
 * - text: Basic text content
 * - reasoning: Model thinking/reasoning steps
 * - file: File attachments
 * - source-url: URL sources
 * - source-document: Document sources
 *
 * Input data sources: None (schema definition)
 * Output destinations: Drizzle ORM type system, SQL migrations
 * Dependencies: drizzle-orm/pg-core
 * Key exports: chats, messages, parts table schemas
 * Side effects: None (schema only)
 */

import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { UIMessage, JSONValue } from 'ai';

// Provider metadata type - matches AI SDK's provider metadata structure
type ProviderMetadata = Record<string, Record<string, JSONValue>>;

// Chats table - stores chat sessions
export const chats = pgTable('chats', {
  id: uuid().defaultRandom().primaryKey(),
  title: text(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Messages table - stores individual messages within chats
export const messages = pgTable(
  'messages',
  {
    id: uuid().defaultRandom().primaryKey(),
    chatId: uuid('chat_id')
      .references(() => chats.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    role: varchar({ length: 20 }).$type<UIMessage['role']>().notNull(), // 'user' | 'assistant' | 'system'
  },
  (table) => [
    index('messages_chat_id_idx').on(table.chatId),
    index('messages_chat_id_created_at_idx').on(table.chatId, table.createdAt),
  ]
);

// Parts table - stores message content parts using prefix-based columns
export const parts = pgTable(
  'parts',
  {
    id: uuid().defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar({ length: 50 })
      .$type<UIMessage['parts'][0]['type']>()
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    order: integer().notNull().default(0),

    // Text fields
    text_text: text(),

    // Reasoning fields
    reasoning_text: text(),

    // File fields
    file_mediaType: varchar('file_media_type', { length: 100 }),
    file_filename: varchar({ length: 255 }), // optional
    file_url: varchar({ length: 2048 }),

    // Source URL fields
    source_url_sourceId: varchar('source_url_source_id', { length: 255 }),
    source_url_url: varchar({ length: 2048 }),
    source_url_title: varchar({ length: 500 }), // optional

    // Source document fields
    source_document_sourceId: varchar('source_document_source_id', {
      length: 255,
    }),
    source_document_mediaType: varchar('source_document_media_type', {
      length: 100,
    }),
    source_document_title: varchar({ length: 500 }), // optional
    source_document_filename: varchar({ length: 255 }), // optional

    // Provider metadata (for AI provider-specific data)
    providerMetadata: jsonb('provider_metadata').$type<ProviderMetadata>(),
  },
  (t) => [
    // Indexes for performance
    index('parts_message_id_idx').on(t.messageId),
    index('parts_message_id_order_idx').on(t.messageId, t.order),

    // Check constraints for data integrity
    check(
      'text_text_required_if_type_is_text',
      sql`CASE WHEN ${t.type} = 'text' THEN ${t.text_text} IS NOT NULL ELSE TRUE END`
    ),
    check(
      'reasoning_text_required_if_type_is_reasoning',
      sql`CASE WHEN ${t.type} = 'reasoning' THEN ${t.reasoning_text} IS NOT NULL ELSE TRUE END`
    ),
    check(
      'file_fields_required_if_type_is_file',
      sql`CASE WHEN ${t.type} = 'file' THEN ${t.file_mediaType} IS NOT NULL AND ${t.file_url} IS NOT NULL ELSE TRUE END`
    ),
    check(
      'source_url_fields_required',
      sql`CASE WHEN ${t.type} = 'source-url' THEN ${t.source_url_sourceId} IS NOT NULL AND ${t.source_url_url} IS NOT NULL ELSE TRUE END`
    ),
    check(
      'source_document_fields_required',
      sql`CASE WHEN ${t.type} = 'source-document' THEN ${t.source_document_sourceId} IS NOT NULL AND ${t.source_document_mediaType} IS NOT NULL AND ${t.source_document_title} IS NOT NULL ELSE TRUE END`
    ),
  ]
);

// Type exports
export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Part = typeof parts.$inferSelect;
export type NewPart = typeof parts.$inferInsert;
