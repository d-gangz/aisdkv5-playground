<!--
Document Type: Planning
Purpose: Implementation plan for chat message persistence using Vercel AI SDK, Supabase, and Drizzle ORM
Context: Based on persistence.md and persistence-frontend.md guides. User has basic Supabase setup but needs full persistence implementation
Key Topics: Database schema extension, message mapping, API routes, frontend integration, progressive UI updates
Target Use: Execute phase-by-phase with detailed instructions
-->

# Chat Message Persistence: Implementation Plan

**Status**: Draft
**Created**: 2025-11-21
**Author**: Claude Code

## Overview

This plan implements a complete message persistence system for the chat application using Vercel AI SDK with Supabase (PostgreSQL) database via Drizzle ORM. The system will persist all message types including text, reasoning, files, tool calls, and custom data parts, with support for streaming responses and progressive UI updates.

The user has already set up basic Supabase infrastructure (`lib/db/`, Drizzle config, basic schema) but needs the full persistence schema and integration with the `/app/persist` routes.

**Simplified Approach**: This plan uses the default `UIMessage` type from AI SDK (no custom types). The API uses `streamText` directly with `onFinish` callback (not `createUIMessageStream`). Frontend keeps existing AI Elements UI components and adds persistence via custom transport.

**Chat Creation Flow**: Frontend generates chat ID using `crypto.randomUUID()`, backend creates chat record if it doesn't exist. All database operations stay on the backend. URL updates after first message from `/persist/new` to `/persist/[uuid]`.

## Goals

✅ Extend database schema to support AI SDK message parts (text, reasoning, files, sources - no tools yet)
✅ Implement message mapping functions (UI ↔ Database)
✅ Create database actions for message persistence (getChat, createChat, upsertMessage, loadChat, deleteMessage)
✅ Implement API route with "create if not exists" pattern and streaming + persistence (using `streamText.onFinish()`)
✅ Integrate frontend persistence with chat ID generation and URL updates
✅ Support message deletion

## Simplifications from Original Docs

- **No custom types**: Uses default `UIMessage` from AI SDK instead of `MyUIMessage`
- **No tools/data parts**: Core persistence only (text, reasoning, files, sources)
- **Simpler API**: Uses `streamText` with `onFinish` callback instead of `createUIMessageStream`
- **Keep existing UI**: Uses current AI Elements components, just adds persistence transport
- **Simpler chat creation**: Frontend generates ID, backend creates record if not exists (no separate create API call)

## Non-Goals

❌ Tool implementation (will be added later when needed)
❌ Custom data parts (can be added when specific use cases arise)
❌ Authentication/authorization (separate concern)
❌ Message search functionality
❌ Message editing UI
❌ Multi-user collaboration
❌ Real-time sync across devices

---

## Phase 1: Database Schema Extension

**Goal**: Extend existing database schema to support AI SDK message parts using prefix-based column naming

### Phase 1a: Extend Database Schema

**Goal**: Add `parts` table and update `messages` table to support AI SDK message structure

#### Files to Modify

- `lib/db/schema.ts`
  - Replace simple `content` field with role-based structure
  - Add `parts` table with prefix-based columns for all part types
  - Add check constraints for data integrity
  - Add indexes for performance

#### Files to Read/Reference

- `lib/db/schema.ts` (current structure: lines 11-36)
- `.claude/plan/docs/persistence.md` (lines 119-331: Schema reference - we'll simplify this)

#### What to Build

Replace the current simple schema with the AI SDK compatible schema:

```typescript
// lib/db/schema.ts - Update the entire file
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

// Chats table - stores chat sessions
export const chats = pgTable('chats', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Messages table - stores individual messages within chats
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chatId: uuid('chat_id')
      .references(() => chats.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
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
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    order: integer('order').notNull().default(0),

    // Text fields
    text_text: text('text_text'),

    // Reasoning fields
    reasoning_text: text('reasoning_text'),

    // File fields
    file_mediaType: varchar('file_media_type', { length: 255 }),
    file_filename: varchar('file_filename', { length: 500 }),
    file_url: text('file_url'),

    // Source URL fields
    source_url_sourceId: varchar('source_url_source_id', { length: 255 }),
    source_url_url: text('source_url_url'),
    source_url_title: varchar('source_url_title', { length: 500 }),

    // Source document fields
    source_document_sourceId: varchar('source_document_source_id', {
      length: 255,
    }),
    source_document_mediaType: varchar('source_document_media_type', {
      length: 255,
    }),
    source_document_title: varchar('source_document_title', { length: 500 }),
    source_document_filename: varchar('source_document_filename', {
      length: 500,
    }),

    // Provider metadata (for AI provider-specific data)
    providerMetadata: jsonb('provider_metadata'),
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
      sql`CASE WHEN ${t.type} = 'source_url' THEN ${t.source_url_sourceId} IS NOT NULL AND ${t.source_url_url} IS NOT NULL ELSE TRUE END`
    ),
    check(
      'source_document_fields_required',
      sql`CASE WHEN ${t.type} = 'source_document' THEN ${t.source_document_sourceId} IS NOT NULL AND ${t.source_document_mediaType} IS NOT NULL AND ${t.source_document_title} IS NOT NULL ELSE TRUE END`
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
```

#### Tests to Write

No tests for this phase (schema definition only)

#### Success Criteria

- [ ] Schema file updated with `parts` table
- [ ] File compiles without TypeScript errors
- [ ] Schema can be pushed to database: `bun run db:push` succeeds
- [ ] Verify in Supabase dashboard: `chats`, `messages`, `parts` tables exist
- [ ] Check indexes exist in Supabase Table Editor

#### Implementation Notes

[EXECUTOR FILLS THIS IN AFTER COMPLETING SUBPHASE 1a]

---

### Phase 1b: Update Database Relations

**Goal**: Update relations to include the `parts` table

#### Files to Modify

- `lib/db/relations.ts`
  - Add `partsRelations`
  - Update `messagesRelations` to include parts

#### Files to Read/Reference

- `lib/db/relations.ts` (current structure: lines 10-26)
- `.claude/plan/docs/persistence.md` (lines 440-473: Relations example)
- `lib/db/schema.ts` (updated in Phase 1a: for table imports)

#### What to Build

```typescript
// lib/db/relations.ts - Update the entire file
import { relations } from 'drizzle-orm';
import { chats, messages, parts } from './schema';

/**
 * Database relationship definitions
 * Enables type-safe relational queries with Drizzle
 */

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
```

#### Tests to Write

No tests for this phase (relations only)

#### Success Criteria

- [ ] Relations file updated with parts relations
- [ ] File compiles without TypeScript errors
- [ ] Can query with relations: Test in `db:studio` or simple script

#### Implementation Notes

[EXECUTOR FILLS THIS IN AFTER COMPLETING SUBPHASE 1b]

---

## Phase 2: Message Mapping Functions

**Goal**: Create bidirectional mapping between UI messages and database format

### Files to Create

- `lib/utils/message-mapping.ts`
  - `mapUIMessagePartsToDBParts()` - Convert UI parts to DB format
  - `mapDBPartToUIMessagePart()` - Convert DB parts to UI format

### Files to Read/Reference

- `.claude/plan/docs/persistence.md` (lines 696-1001: Mapping reference - we'll simplify this)
- `lib/db/schema.ts` (updated in Phase 1: for DB types)

### What to Build

```typescript
// lib/utils/message-mapping.ts
import { UIMessage } from 'ai';
import { NewPart, Part } from '@/lib/db/schema';

/**
 * Message mapping utilities for bidirectional conversion between UI and database formats
 *
 * Simplified for core message part types (text, reasoning, file, source-url, source-document).
 * No tools or custom data parts.
 *
 * Input data sources: UI messages from AI SDK, database rows from Drizzle
 * Output destinations: Database inserts, UI message reconstruction
 * Dependencies: ai package, db/schema
 * Key exports: mapUIMessagePartsToDBParts, mapDBPartToUIMessagePart
 * Side effects: None (pure functions)
 */

type UIMessagePart = UIMessage['parts'][0];

/**
 * Convert UI message parts to database format
 */
export const mapUIMessagePartsToDBParts = (
  messageParts: UIMessagePart[],
  messageId: string
): NewPart[] => {
  return messageParts.map((part, index) => {
    switch (part.type) {
      case 'text':
        return {
          messageId,
          order: index,
          type: part.type,
          text_text: part.text,
        };

      case 'reasoning':
        return {
          messageId,
          order: index,
          type: part.type,
          reasoning_text: part.text,
          providerMetadata: part.providerMetadata,
        };

      case 'file':
        return {
          messageId,
          order: index,
          type: part.type,
          file_mediaType: part.mediaType,
          file_filename: part.filename ?? undefined,
          file_url: part.url,
        };

      case 'source-document':
        return {
          messageId,
          order: index,
          type: part.type,
          source_document_sourceId: part.sourceId,
          source_document_mediaType: part.mediaType,
          source_document_title: part.title,
          source_document_filename: part.filename,
          providerMetadata: part.providerMetadata,
        };

      case 'source-url':
        return {
          messageId,
          order: index,
          type: part.type,
          source_url_sourceId: part.sourceId,
          source_url_url: part.url,
          source_url_title: part.title,
          providerMetadata: part.providerMetadata,
        };

      case 'step-start':
        return {
          messageId,
          order: index,
          type: part.type,
        };

      default:
        // For any unsupported types, create a minimal entry
        return {
          messageId,
          order: index,
          type: part.type as any,
        };
    }
  });
};

/**
 * Convert database parts back to UI message parts
 */
export const mapDBPartToUIMessagePart = (part: Part): UIMessagePart => {
  switch (part.type) {
    case 'text':
      return {
        type: part.type,
        text: part.text_text!,
      };

    case 'reasoning':
      return {
        type: part.type,
        text: part.reasoning_text!,
        providerMetadata: part.providerMetadata ?? undefined,
      };

    case 'file':
      return {
        type: part.type,
        mediaType: part.file_mediaType!,
        filename: part.file_filename!,
        url: part.file_url!,
      };

    case 'source-document':
      return {
        type: part.type,
        sourceId: part.source_document_sourceId!,
        mediaType: part.source_document_mediaType!,
        title: part.source_document_title!,
        filename: part.source_document_filename!,
        providerMetadata: part.providerMetadata ?? undefined,
      };

    case 'source-url':
      return {
        type: part.type,
        sourceId: part.source_url_sourceId!,
        url: part.source_url_url!,
        title: part.source_url_title!,
        providerMetadata: part.providerMetadata ?? undefined,
      };

    case 'step-start':
      return {
        type: part.type,
      };

    default:
      throw new Error(`Unsupported part type: ${part.type}`);
  }
};
```

### Tests to Write

Create `lib/utils/__tests__/message-mapping.test.ts`:
- `test_mapUIMessagePartsToDBParts_text_part` - Test text mapping
- `test_mapUIMessagePartsToDBParts_multiple_parts` - Test multiple parts with order
- `test_mapDBPartToUIMessagePart_text_part` - Test reverse mapping
- `test_roundtrip_mapping` - Test UI → DB → UI conversion preserves data

### Success Criteria

- [ ] `lib/utils/message-mapping.ts` created with both mapping functions
- [ ] File compiles without TypeScript errors
- [ ] Can import and use functions in other files
- [ ] Manual test: Convert sample message and verify structure

#### Implementation Notes

[EXECUTOR FILLS THIS IN AFTER COMPLETING PHASE 2]

---

## Phase 3: Database Actions

**Goal**: Implement server actions for message persistence operations

### Files to Modify

- `lib/db/actions.ts`
  - Replace simple actions with AI SDK compatible actions
  - Add `getChat()` function to check if chat exists
  - Add `createChat()` function that accepts chat ID (from frontend)
  - Add `upsertMessage()` function
  - Add `loadChat()` function
  - Add `deleteMessage()` function
  - Keep `deleteChat()` but simplify

### Files to Read/Reference

- `lib/db/actions.ts` (current structure: lines 1-99)
- `.claude/plan/docs/persistence.md` (lines 1003-1195: Complete actions example)
- `lib/utils/message-mapping.ts` (created in Phase 2: for mapping functions)

### What to Build

```typescript
// lib/db/actions.ts - Replace entire file
'use server';

import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chats, messages, parts } from '@/lib/db/schema';
import { UIMessage } from 'ai';
import {
  mapUIMessagePartsToDBParts,
  mapDBPartToUIMessagePart,
} from '@/lib/utils/message-mapping';

/**
 * Database server actions for chat message persistence
 *
 * Input data sources: Function parameters from client/server
 * Output destinations: Supabase Postgres via Drizzle ORM
 * Dependencies: drizzle-orm, schema, message-mapping utilities
 * Key exports: getChat, createChat, upsertMessage, loadChat, deleteMessage, deleteChat
 * Side effects: Database INSERT, SELECT, UPDATE, DELETE operations
 */

/**
 * Get a chat by ID
 * @returns The chat record or null if not found
 */
export const getChat = async (chatId: string) => {
  const [chat] = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);
  return chat || null;
};

/**
 * Create a new chat session with provided ID
 * @param chatId - The chat ID (generated on frontend)
 */
export const createChat = async (chatId: string): Promise<void> => {
  await db.insert(chats).values({ id: chatId });
};

/**
 * Insert or update a message in the database
 *
 * This function:
 * 1. Upserts the message record
 * 2. Deletes existing parts for the message
 * 3. Inserts new parts
 *
 * All operations are wrapped in a transaction for atomicity.
 */
export const upsertMessage = async ({
  chatId,
  message,
  id,
}: {
  id: string;
  chatId: string;
  message: UIMessage;
}): Promise<void> => {
  // Map UI message parts to database format
  const mappedDBUIParts = mapUIMessagePartsToDBParts(message.parts, id);

  // Use transaction to ensure atomicity
  await db.transaction(async (tx) => {
    // Upsert message (insert or update if exists)
    await tx
      .insert(messages)
      .values({
        chatId,
        role: message.role,
        id,
      })
      .onConflictDoUpdate({
        target: messages.id,
        set: {
          chatId,
        },
      });

    // Delete existing parts (in case of update)
    await tx.delete(parts).where(eq(parts.messageId, id));

    // Insert new parts if any exist
    if (mappedDBUIParts.length > 0) {
      await tx.insert(parts).values(mappedDBUIParts);
    }
  });
};

/**
 * Load all messages for a chat
 *
 * Retrieves messages with their parts, ordered by creation time.
 */
export const loadChat = async (chatId: string): Promise<UIMessage[]> => {
  // Use Drizzle's relational query API
  const result = await db.query.messages.findMany({
    where: eq(messages.chatId, chatId),
    with: {
      parts: {
        orderBy: (parts, { asc }) => [asc(parts.order)],
      },
    },
    orderBy: (messages, { asc }) => [asc(messages.createdAt)],
  });

  // Map database results back to UI format
  return result.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts.map((part) => mapDBPartToUIMessagePart(part)),
  }));
};

/**
 * Delete a chat and all associated messages/parts
 *
 * Cascade delete ensures messages and parts are also deleted.
 */
export const deleteChat = async (chatId: string): Promise<void> => {
  await db.delete(chats).where(eq(chats.id, chatId));
};

/**
 * Delete a message and all subsequent messages in the chat
 *
 * This is useful for implementing "regenerate" functionality.
 */
export const deleteMessage = async (messageId: string): Promise<void> => {
  await db.transaction(async (tx) => {
    // Get the target message to find its chat and timestamp
    const [targetMessage] = await tx
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!targetMessage) return;

    // Delete all messages after this one in the chat
    await tx
      .delete(messages)
      .where(
        and(
          eq(messages.chatId, targetMessage.chatId),
          gt(messages.createdAt, targetMessage.createdAt)
        )
      );

    // Delete the target message (cascade delete will handle parts)
    await tx.delete(messages).where(eq(messages.id, messageId));
  });
};

/**
 * Get all chats (for listing)
 */
export const getChats = async () => {
  return await db.select().from(chats);
};
```

### Tests to Write

No automated tests for this phase (server actions with database dependency)

### Success Criteria

- [ ] `lib/db/actions.ts` updated with all functions
- [ ] File compiles without TypeScript errors
- [ ] Can import functions in other files
- [ ] Manual test using `db:studio`: Create chat, insert message, verify in database

#### Implementation Notes

[EXECUTOR FILLS THIS IN AFTER COMPLETING PHASE 3]

---

## Phase 4: API Route Implementation

**Goal**: Implement the persistence API route that handles streaming with message persistence

### Files to Modify

- `app/api/persist/route.ts`
  - Replace simple implementation with full streaming + persistence
  - Check if chat exists, create if not (using frontend-provided ID)
  - Persist user message immediately
  - Load chat history before streaming
  - Persist assistant message on stream completion

### Files to Read/Reference

- `app/api/persist/route.ts` (current structure: lines 1-37)
- `.claude/plan/docs/persistence.md` (lines 1197-1414: Complete API route example)
- `lib/db/actions.ts` (created in Phase 3: for persistence functions)

### What to Build

```typescript
// app/api/persist/route.ts - Replace entire file
/**
 * API route for persistent chat with streaming responses
 *
 * Simplified approach using streamText directly with onFinish callback.
 *
 * Flow:
 * 1. Receive user message and chatId from frontend (chatId generated on frontend)
 * 2. Check if chat exists, create if not (all DB operations on backend)
 * 3. Persist user message to database immediately
 * 4. Load full chat history from database
 * 5. Stream AI response using streamText
 * 6. Persist AI response when streaming completes (onFinish callback)
 *
 * Input data sources: POST request with message and chatId
 * Output destinations: Streaming response to frontend, database persistence
 * Dependencies: OpenAI API, AI SDK, database actions
 * Key exports: POST handler
 * Side effects: Database writes, OpenAI API calls, streaming responses
 */

import { getChat, createChat, upsertMessage, loadChat } from '@/lib/db/actions';
import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, UIMessage } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  try {
    // Parse request body
    const { message, chatId }: { message: UIMessage; chatId: string } =
      await req.json();

    // Validate inputs
    if (!message || !chatId) {
      return new Response('Missing message or chatId', { status: 400 });
    }

    // Step 1: Check if chat exists, create if not
    const chat = await getChat(chatId);
    if (!chat) {
      await createChat(chatId);
    }

    // Step 2: Persist incoming user message immediately
    await upsertMessage({ chatId, id: message.id, message });

    // Step 3: Load conversation history from database
    const messages = await loadChat(chatId);

    // Step 4: Stream AI response using streamText
    const result = streamText({
      model: openai('gpt-4o'),
      messages: convertToModelMessages(messages),
      onFinish: async ({ response }) => {
        // Step 5: Persist assistant response when streaming completes
        try {
          const assistantMessage: UIMessage = {
            id: response.id,
            role: 'assistant',
            parts: response.parts,
          };

          await upsertMessage({
            id: response.id,
            chatId,
            message: assistantMessage,
          });
        } catch (error) {
          console.error('Error persisting response message:', error);
          // Don't throw - streaming already completed
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('API route error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
```

### Tests to Write

No automated tests for this phase (API route with external dependencies)

### Success Criteria

- [ ] API route updated with "create if not exists" logic and persistence
- [ ] File compiles without TypeScript errors
- [ ] Test with Postman/curl: POST to `/api/persist` with new `chatId` (not in DB)
- [ ] Verify chat record is created in database (check `db:studio`)
- [ ] Verify message persists in database
- [ ] Verify streaming response works
- [ ] Verify assistant response persists after streaming completes
- [ ] Test with existing `chatId` - should not create duplicate chat

#### Implementation Notes

[EXECUTOR FILLS THIS IN AFTER COMPLETING PHASE 4]

---

## Phase 5: Frontend Integration

**Goal**: Update the frontend to load persisted messages and use the persistence API

### Phase 5a: Update Chat Page to Load Messages

**Goal**: Load messages from database on page load (server-side)

#### Files to Modify

- `app/persist/[id]/page.tsx`
  - Import `loadChat` action
  - Load messages for the chat ID
  - Pass messages to Chat component

#### Files to Read/Reference

- `app/persist/[id]/page.tsx` (current structure: lines 1-151)
- `.claude/plan/docs/persistence-frontend.md` (lines 136-158: Server-side loading example)
- `lib/db/actions.ts` (created in Phase 3: for loadChat function)

#### What to Build

```typescript
// app/persist/[id]/page.tsx - Update to load messages
import { loadChat } from '@/lib/db/actions';
import PersistChat from './chat';

/**
 * Server component that loads chat messages from database
 *
 * Input data sources: Chat ID from URL params, database via loadChat
 * Output destinations: Passes messages to client component
 * Dependencies: loadChat action
 * Key exports: Default page component
 * Side effects: Database read
 */

export default async function PersistChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Load messages from database (skip if 'new' route)
  const initialMessages = id === 'new' ? [] : await loadChat(id);

  return <PersistChat id={id} initialMessages={initialMessages} />;
}
```

#### Tests to Write

No tests for this phase

#### Success Criteria

- [ ] Page component updated to load messages
- [ ] File compiles without TypeScript errors
- [ ] Navigate to `/persist/[some-uuid]` - page loads without errors
- [ ] Navigate to `/persist/new` - page loads with empty messages
- [ ] Check browser console for any errors

#### Implementation Notes

[EXECUTOR FILLS THIS IN AFTER COMPLETING SUBPHASE 5a]

---

### Phase 5b: Update Chat Component for Persistence

**Goal**: Update chat component to generate chat ID, use custom transport, and update URL after first message

#### Files to Create

- `app/persist/[id]/chat.tsx` (move logic from page.tsx)

#### Files to Modify

- `app/persist/[id]/page.tsx` (already updated in 5a)

#### Files to Read/Reference

- `app/persist/[id]/page.tsx` (current structure: lines 63-150)
- `.claude/plan/docs/persistence-frontend.md` (lines 202-286: DefaultChatTransport configuration)

#### What to Build

```typescript
// app/persist/[id]/chat.tsx - Update existing chat component with persistence
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { Fragment, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputProvider,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputHeader,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input';
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';

/**
 * Client component for persistent chat with custom transport
 *
 * Generates chat ID on frontend, backend creates chat record if needed.
 * Uses existing AI Elements components with database persistence.
 * Custom transport sends only last message to API, backend loads full history.
 * Updates URL with chat ID after first message.
 *
 * Input data sources: Initial messages from server, user input via form
 * Output destinations: API route at /api/persist, displays in UI
 * Dependencies: @ai-sdk/react, AI Elements components, Next.js router
 * Key exports: PersistChat component
 * Side effects: Sends messages to API, updates URL, updates UI
 */

function ConditionalHeader() {
  const attachments = usePromptInputAttachments();

  if (!attachments.files.length) {
    return null;
  }

  return (
    <PromptInputHeader>
      <PromptInputAttachments>
        {(attachment) => <PromptInputAttachment data={attachment} />}
      </PromptInputAttachments>
    </PromptInputHeader>
  );
}

interface PersistChatProps {
  id: string;
  initialMessages?: UIMessage[];
}

export default function PersistChat({ id, initialMessages }: PersistChatProps) {
  const router = useRouter();

  // Generate backup chat ID for new conversations
  const [backupChatId, setBackupChatId] = useState(() => crypto.randomUUID());

  // Use URL chat ID if available, otherwise use backup
  // 'new' is a special route that indicates creating a new chat
  const chatId = id !== 'new' ? id : backupChatId;

  const { messages, sendMessage, status } = useChat<UIMessage>({
    id: chatId, // Chat ID for tracking
    messages: initialMessages, // Pre-loaded from database
    transport: new DefaultChatTransport({
      api: '/api/persist',
      prepareSendMessagesRequest: ({ messages }) => {
        // Only send the last message - backend loads full history from DB
        const lastMessage = messages[messages.length - 1];
        return {
          body: {
            message: lastMessage,
            chatId: chatId,
          },
        };
      },
    }),
  });

  const handleSubmit = (
    message: PromptInputMessage,
    _event: React.FormEvent<HTMLFormElement>
  ) => {
    const hasText = Boolean(message.text?.trim());
    const hasAttachments = Boolean(message.files?.length);

    if (hasText || hasAttachments) {
      startTransition(() => {
        sendMessage({
          text: message.text || 'Sent with attachments',
          files: message.files,
        });

        // Update URL with chat ID after first message (if currently 'new')
        if (id === 'new') {
          router.push(`/persist/${chatId}`);
          // Refresh backup ID for next potential new chat
          setBackupChatId(crypto.randomUUID());
        }
      });
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto p-6 h-screen">
      <div className="flex flex-col h-full">
        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageSquare className="size-12" />}
                title="Start a conversation"
                description="Type a message below to begin chatting"
              />
            ) : (
              messages.map((message) => (
                <Fragment key={message.id}>
                  {message.parts.map((part, i) => {
                    switch (part.type) {
                      case 'text':
                        return (
                          <Message
                            from={message.role}
                            key={`${message.id}-${i}`}
                          >
                            <MessageContent>
                              <MessageResponse>{part.text}</MessageResponse>
                            </MessageContent>
                          </Message>
                        );
                      default:
                        return null;
                    }
                  })}
                </Fragment>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInputProvider>
          <PromptInput
            onSubmit={handleSubmit}
            className="mt-4 w-full px-4"
            multiple
          >
            <ConditionalHeader />
            <PromptInputBody>
              <PromptInputTextarea placeholder="Say something..." />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
              </PromptInputTools>
              <PromptInputSubmit
                status={status === 'streaming' ? 'streaming' : 'ready'}
              />
            </PromptInputFooter>
          </PromptInput>
        </PromptInputProvider>
      </div>
    </div>
  );
}
```

#### Tests to Write

No tests for this phase

#### Success Criteria

- [ ] Chat component extracted to separate file
- [ ] Component uses custom transport with persistence API
- [ ] Component generates chat ID and updates URL
- [ ] File compiles without TypeScript errors
- [ ] Test: Navigate to `/persist/new` → Send message → Verify URL updates to `/persist/[uuid]`
- [ ] Test: Send message → verify it streams back
- [ ] Test: Refresh page → verify messages persist and reload
- [ ] Test: Check database → verify chat and messages are stored

#### Implementation Notes

[EXECUTOR FILLS THIS IN AFTER COMPLETING SUBPHASE 5b]

---

## Testing Strategy Summary

### Manual Testing

Since this is a database-backed system with streaming, testing will be primarily manual:

1. **Database Persistence**
   - Create chat → Check database for chat record
   - Send message → Check database for message + parts records
   - Send multiple messages → Verify all persist correctly

2. **Message Loading**
   - Send messages → Refresh page → Verify messages reload
   - Check message order is preserved
   - Verify all part types load correctly

3. **Streaming**
   - Send message → Verify response streams in real-time
   - Check no errors in browser console
   - Verify streaming completes successfully

4. **Edge Cases**
   - Empty chat → Should work without errors
   - Long messages → Should persist and load correctly
   - Page refresh during streaming → Partial message should persist

### Integration Testing

Test the complete flow:

1. Navigate to `/persist/new`
2. Send first message
3. Verify URL updates to `/persist/[uuid]`
4. Wait for response
5. Refresh page
6. Send second message
7. Verify both messages persist
8. Check database has correct chat + message records

---

## Risk Mitigation

### Risk: Schema Migration Breaks Existing Data

**Mitigation:**
- This is a new feature on `/app/persist` routes
- Existing `/app/chat` routes remain unchanged
- Can test schema changes independently
- Backup database before pushing schema changes

### Risk: Message Mapping Errors

**Mitigation:**
- Start with simple text-only messages
- Add part types incrementally
- Add error logging in mapping functions
- Test each part type individually before combining

### Risk: Database Connection Issues

**Mitigation:**
- Verify `DATABASE_URL` is correctly set
- Test connection before implementing features
- Add try-catch blocks around database operations
- Log errors for debugging

### Risk: Streaming Persistence Race Conditions

**Mitigation:**
- Use transactions for atomic operations
- `onFinish` callback ensures completion before persisting
- Database cascade deletes handle cleanup automatically

---

## References

### Key Files

- Planning docs: `.claude/plan/docs/persistence.md`, `.claude/plan/docs/persistence-frontend.md`
- Schema: `lib/db/schema.ts`
- Actions: `lib/db/actions.ts`
- API Route: `app/api/persist/route.ts`
- Frontend: `app/persist/[id]/page.tsx`, `app/persist/[id]/chat.tsx`

### External Documentation

- Vercel AI SDK: https://sdk.vercel.ai
- Drizzle ORM: https://orm.drizzle.team
- Supabase: https://supabase.com/docs

---

## EXECUTOR INSTRUCTIONS

### Phase-by-Phase Workflow

**Work sequentially. Do not skip phases or subphases.**

For each phase (or subphase if the phase has subphases):

1. **Implement**
   - Read "Files to Read/Reference" first
   - Build what's described in "What to Build"
   - Write all tests in "Tests to Write" (if applicable)
   - Run tests as you work

2. **Verify Success Criteria**
   - Check EVERY box in "Success Criteria"
   - Run EVERY command specified
   - **Only check when 100% complete** (not "mostly done")
   - All tests must pass, all commands must work

3. **Document Implementation Notes**
   - Fill in the "Implementation Notes" section with:
     - What was actually implemented
     - Deviations from plan (if any)
     - Key technical insights learned
     - Challenges encountered and solutions
     - Unexpected discoveries

4. **Move to next phase/subphase** (only after steps 2 and 3 complete). Stop after completion of each phase/subphase for the user to review. Only proceed to the next phase/subphase when user specifies to continue.

### Working with Subphases

When a phase has subphases (e.g., Phase 1a, 1b, 1c):

- **Treat each subphase as a mini-phase**: Complete all 4 steps above for each subphase
- **Stop after each subphase**: Wait for user review before proceeding to the next subphase
- **Complete all subphases before moving to next phase**: Don't skip from Phase 1a to Phase 2
- **Document each subphase separately**: Fill in Implementation Notes after each subphase completes

### Critical Rules

- ✅ Check box: 100% complete, all tests pass, commands work
- ❌ Don't check: Failing tests, partial work, unresolved errors
- 📝 Always fill Implementation Notes before next phase/subphase
- 🚫 Never skip ahead to later phases/subphases
- 🔄 Complete subphases sequentially (1a → 1b → 1c, not 1a → 1c)

### Database Commands

- Push schema: `bun run db:push`
- View database: `bun run db:studio`
- Generate migrations: `bun run db:generate`

### Testing Commands

- Type check: `bunx tsc --noEmit`
- Dev server: `bun run dev`
- Manual test: Navigate to `http://localhost:3000/persist/[some-uuid]`
