<!--
Document Type: Process Documentation
Purpose: Backend implementation guide for persisting chat messages using Vercel AI SDK with Supabase database
Context: Created to guide junior engineers through backend message persistence implementation
Key Topics: Database schema, message mapping, streaming persistence, Supabase setup, Drizzle ORM, API routes
Target Use: Follow sequentially, check off completed steps, reference code examples. See persistence-frontend.md for client-side integration.
-->

# Backend Message Persistence Implementation Plan

This document provides a step-by-step guide for implementing the **backend** components of chat message persistence using Vercel AI SDK with Supabase (PostgreSQL) database. This covers database schema, server actions, API routes, and message mapping.

> **📘 Related Document:** For frontend integration (React components, `useChat` hook, UI rendering, client-side tools), see [`persistence-frontend.md`](./persistence-frontend.md).

Follow each section sequentially and check off completed steps.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Database Schema Design](#database-schema-design)
4. [Supabase Setup](#supabase-setup)
5. [Database Connection Configuration](#database-connection-configuration)
6. [Message Type Definitions](#message-type-definitions)
7. [Understanding Tools and Custom Data Parts](#understanding-tools-and-custom-data-parts)
8. [Message Mapping Functions](#message-mapping-functions)
9. [Database Actions](#database-actions)
10. [API Route Implementation](#api-route-implementation)
11. [Testing & Validation](#testing--validation)
12. [Troubleshooting](#troubleshooting)

---

## Overview

### What We're Building

A complete message persistence system that:

- Stores chat sessions in Supabase (PostgreSQL)
- Persists all message types (text, reasoning, files, tool calls, data parts)
- Supports streaming responses from AI SDK
- Maintains message order and relationships
- Handles complex message parts with type safety

### Architecture Overview

```
┌─────────────┐
│   Client    │
│  (React)    │
└──────┬──────┘
       │ HTTP POST
       ▼
┌─────────────┐
│ API Route   │ ◄──┐
│ /api/chat   │    │
└──────┬──────┘    │
       │           │
       │ Stream    │ Load Messages
       │ Messages  │
       ▼           │
┌─────────────┐    │
│ AI SDK      │    │
│ Stream      │    │
└──────┬──────┘    │
       │           │
       │ Upsert    │
       ▼           │
┌─────────────┐    │
│ DB Actions  │────┘
│ (actions.ts)│
└──────┬──────┘
       │
       │ Drizzle ORM
       ▼
┌─────────────┐
│  Supabase   │
│  PostgreSQL │
└─────────────┘
```

### Key Concepts

**Prefix-Based Column Naming**: Instead of using polymorphic relationships, we use a single `parts` table with prefixed columns for each message part type (e.g., `text_text`, `tool_getWeatherInformation_input`). This approach:

- Maintains type safety
- Improves query performance
- Simplifies schema management
- Avoids complex joins

**Message Parts**: Messages are composed of multiple "parts" that can include:

- Text content
- Reasoning/thinking steps
- File attachments
- Source URLs and documents
- Tool calls (with inputs/outputs)
- Custom data parts

---

## Prerequisites

Before starting, ensure you have:

- [ ] Node.js 18+ and pnpm installed
- [ ] A Supabase account (sign up at [supabase.com](https://supabase.com))
- [ ] Basic understanding of:
  - Next.js App Router
  - TypeScript
  - SQL databases
  - Drizzle ORM (or willingness to learn)
- [ ] Access to the project repository

**Estimated Time:** 3-4 hours

---

## Database Schema Design

### Step 1: Understand the Table Structure

We need three main tables:

1. **`chats`** - Stores chat sessions
2. **`messages`** - Stores individual messages within chats
3. **`parts`** - Stores message content parts (text, tools, files, etc.)

### Step 2: Create the Schema File

Create or update `lib/db/schema.ts`:

```typescript
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { generateId } from 'ai';
import { sql } from 'drizzle-orm';

// Import your message types (we'll define these next)
import { MyUIMessage, MyProviderMetadata } from '../message-type';

/**
 * Chats table - stores chat sessions
 *
 * Columns:
 * - id: Unique chat identifier (auto-generated)
 */
export const chats = pgTable('chats', {
  id: varchar()
    .primaryKey()
    .$defaultFn(() => generateId()),
});

/**
 * Messages table - stores individual messages within chats
 *
 * Columns:
 * - id: Unique message identifier (auto-generated)
 * - chatId: Foreign key to chats table
 * - createdAt: Timestamp when message was created
 * - role: Message role (user, assistant, system, etc.)
 */
export const messages = pgTable(
  'messages',
  {
    id: varchar()
      .primaryKey()
      .$defaultFn(() => generateId()),
    chatId: varchar()
      .references(() => chats.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    role: varchar().$type<MyUIMessage['role']>().notNull(),
  },
  (table) => [
    // Index for faster chat message queries
    index('messages_chat_id_idx').on(table.chatId),
    // Composite index for ordered message retrieval
    index('messages_chat_id_created_at_idx').on(table.chatId, table.createdAt),
  ]
);

/**
 * Parts table - stores message content parts using prefix-based columns
 *
 * This table uses a prefix convention to store different part types:
 * - text_*: Text content
 * - reasoning_*: Reasoning/thinking steps
 * - file_*: File attachments
 * - source_url_*: URL sources
 * - source_document_*: Document sources
 * - tool_[toolName]_*: Tool calls
 * - data_[dataType]_*: Custom data parts
 */
export const parts = pgTable(
  'parts',
  {
    id: varchar()
      .primaryKey()
      .$defaultFn(() => generateId()),
    messageId: varchar()
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar().$type<MyUIMessage['parts'][0]['type']>().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    order: integer().notNull().default(0),

    // Text fields
    text_text: text(),

    // Reasoning fields
    reasoning_text: text(),

    // File fields
    file_mediaType: varchar(),
    file_filename: varchar(), // optional
    file_url: varchar(),

    // Source URL fields
    source_url_sourceId: varchar(),
    source_url_url: varchar(),
    source_url_title: varchar(), // optional

    // Source document fields
    source_document_sourceId: varchar(),
    source_document_mediaType: varchar(),
    source_document_title: varchar(),
    source_document_filename: varchar(), // optional

    // Shared tool call columns
    tool_toolCallId: varchar(),
    tool_state: varchar().$type<
      | 'input-streaming'
      | 'input-available'
      | 'output-available'
      | 'output-error'
    >(),
    tool_errorText: text(), // Error message text, not a state type

    // Tool-specific input/output columns
    // Example: getWeatherInformation tool
    tool_getWeatherInformation_input: jsonb(),
    tool_getWeatherInformation_output: jsonb(),

    // Example: getLocation tool
    tool_getLocation_input: jsonb(),
    tool_getLocation_output: jsonb(),

    // Data parts - example: weather data
    data_weather_id: varchar().$defaultFn(() => generateId()),
    data_weather_location: varchar(),
    data_weather_weather: varchar(),
    data_weather_temperature: real(),

    // Provider metadata (for AI provider-specific data)
    providerMetadata: jsonb().$type<MyProviderMetadata>(),
  },
  (t) => [
    // Indexes for performance optimization
    index('parts_message_id_idx').on(t.messageId),
    index('parts_message_id_order_idx').on(t.messageId, t.order),

    // Check constraints ensure data integrity
    // Text parts must have text_text
    check(
      'text_text_required_if_type_is_text',
      sql`CASE WHEN ${t.type} = 'text' THEN ${t.text_text} IS NOT NULL ELSE TRUE END`
    ),
    // Reasoning parts must have reasoning_text
    check(
      'reasoning_text_required_if_type_is_reasoning',
      sql`CASE WHEN ${t.type} = 'reasoning' THEN ${t.reasoning_text} IS NOT NULL ELSE TRUE END`
    ),
    // File parts must have required fields
    check(
      'file_fields_required_if_type_is_file',
      sql`CASE WHEN ${t.type} = 'file' THEN ${t.file_mediaType} IS NOT NULL AND ${t.file_url} IS NOT NULL ELSE TRUE END`
    ),
    // Source URL parts must have required fields
    check(
      'source_url_fields_required_if_type_is_source_url',
      sql`CASE WHEN ${t.type} = 'source_url' THEN ${t.source_url_sourceId} IS NOT NULL AND ${t.source_url_url} IS NOT NULL ELSE TRUE END`
    ),
    // Source document parts must have required fields
    check(
      'source_document_fields_required_if_type_is_source_document',
      sql`CASE WHEN ${t.type} = 'source_document' THEN ${t.source_document_sourceId} IS NOT NULL AND ${t.source_document_mediaType} IS NOT NULL AND ${t.source_document_title} IS NOT NULL ELSE TRUE END`
    ),
    // Tool parts must have toolCallId and state
    check(
      'tool_getWeatherInformation_fields_required',
      sql`CASE WHEN ${t.type} = 'tool-getWeatherInformation' THEN ${t.tool_toolCallId} IS NOT NULL AND ${t.tool_state} IS NOT NULL ELSE TRUE END`
    ),
    check(
      'tool_getLocation_fields_required',
      sql`CASE WHEN ${t.type} = 'tool-getLocation' THEN ${t.tool_toolCallId} IS NOT NULL AND ${t.tool_state} IS NOT NULL ELSE TRUE END`
    ),
    // Data parts must have required fields
    check(
      'data_weather_fields_required',
      sql`CASE WHEN ${t.type} = 'data-weather' THEN ${t.data_weather_location} IS NOT NULL AND ${t.data_weather_weather} IS NOT NULL AND ${t.data_weather_temperature} IS NOT NULL ELSE TRUE END`
    ),
  ]
);

// Type exports for use in other files
export type MyDBUIMessagePart = typeof parts.$inferInsert;
export type MyDBUIMessagePartSelect = typeof parts.$inferSelect;
```

**Key Points:**

- `chats` table is simple - just an ID
- `messages` table links to chats and stores role/timestamp
- `parts` table uses prefix-based columns for different part types
- Check constraints ensure data integrity
- Indexes optimize query performance
- Cascade deletes ensure data consistency

**Checkpoint:** ✅ Schema file created with all three tables

---

## Supabase Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `ai-sdk-persistence-db` (or your preferred name)
   - **Database Password**: Save this securely (you'll need it for connection string)
   - **Region**: Choose closest to your users
4. Wait for project to be created (2-3 minutes)

### Step 2: Get Database Connection String

1. In your Supabase project dashboard, go to **Settings** → **Database**
2. Scroll down to **Connection string**
3. Select **"URI"** tab
4. Copy the connection string (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres`)
5. Replace `[YOUR-PASSWORD]` with your actual database password

### Step 3: Configure Environment Variables

1. Create or update `.env.local` file in project root:

```bash
# Supabase Database Connection
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres

# OpenAI API Key (for AI SDK)
OPENAI_API_KEY=your_openai_api_key_here
```

**Important:**

- Never commit `.env.local` to git (it should be in `.gitignore`)
- Replace `[YOUR-PASSWORD]` and `[project-ref]` with actual values
- The password is the one you set when creating the project

**Checkpoint:** ✅ Supabase project created and connection string configured

---

## Database Connection Configuration

### Step 1: Install Dependencies

Ensure these packages are installed:

```bash
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg
```

### Step 2: Configure Drizzle

Update `drizzle.config.ts`:

```typescript
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle', // Migration output directory
  schema: './lib/db/schema.ts', // Path to your schema file
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Step 3: Set Up Database Connection

Create or update `lib/db/index.ts`:

```typescript
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as relations from './relations';

/**
 * Database connection pool configuration
 *
 * - max: Maximum number of clients in the pool
 * - idleTimeoutMillis: Close idle clients after this many milliseconds
 * - connectionTimeoutMillis: Return error after this many milliseconds if connection cannot be established
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Drizzle database instance
 *
 * Includes schema and relations for type-safe queries
 */
export const db = drizzle(pool, {
  schema: { ...schema, ...relations },
});
```

### Step 4: Create Relations File

Create `lib/db/relations.ts`:

```typescript
import { relations } from 'drizzle-orm';
import { chats, messages, parts } from './schema';

/**
 * Define relationships between tables for Drizzle queries
 *
 * This enables type-safe relational queries like:
 * db.query.chats.findMany({ with: { messages: { with: { parts: true } } } })
 */
export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  parts: many(parts),
}));

export const partsRelations = relations(parts, ({ one }) => ({
  message: one(messages, {
    fields: [parts.messageId],
    references: [messages.id],
  }),
}));
```

### Step 5: Push Schema to Database

Run the migration command:

```bash
pnpm db:push
```

This will:

- Create all tables in your Supabase database
- Set up indexes
- Add check constraints
- Create foreign key relationships

**Verify:** Check your Supabase dashboard → **Table Editor** to see the three tables (`chats`, `messages`, `parts`)

**Checkpoint:** ✅ Database connection configured and schema pushed to Supabase

---

## Message Type Definitions

### Step 1: Define Message Types

Create or update `lib/message-type.ts`:

```typescript
import { InferUITools, JSONValue, UIMessage, UIMessagePart } from 'ai';
import z from 'zod';
import { tools } from '@/ai/tools'; // Your AI SDK tools

/**
 * Provider metadata schema
 * Used to store AI provider-specific metadata
 */
export const metadataSchema = z.object({});

type MyMetadata = z.infer<typeof metadataSchema>;

/**
 * Custom data parts schema
 * Define your custom data part types here
 *
 * Example: Weather data part
 */
export const dataPartSchema = z.object({
  weather: z.object({
    weather: z.string().optional(),
    location: z.string().optional(),
    temperature: z.number().optional(),
    loading: z.boolean().default(true),
  }),
});

export type MyDataPart = z.infer<typeof dataPartSchema>;

/**
 * Infer tool types from your tools function
 * This ensures type safety for tool calls
 */
export type MyToolSet = InferUITools<ReturnType<typeof tools>>;

/**
 * Typed UI message that matches AI SDK's UIMessage
 * Includes metadata, data parts, and tool set
 */
export type MyUIMessage = UIMessage<MyMetadata, MyDataPart, MyToolSet>;

/**
 * Typed UI message part
 */
export type MyUIMessagePart = UIMessagePart<MyDataPart, MyToolSet>;

/**
 * Provider metadata type
 * Used for storing AI provider-specific information
 */
export type MyProviderMetadata = Record<string, Record<string, JSONValue>>;
```

**Key Points:**

- `MyUIMessage` is the main message type used throughout the app
- `MyUIMessagePart` represents individual parts within a message
- `MyDataPart` defines custom data structures (like weather data)
- `MyToolSet` infers types from your tools function
- `MyProviderMetadata` stores provider-specific data

**Checkpoint:** ✅ Message types defined

---

## Understanding Tools and Custom Data Parts

### Step 1: Overview of Tools Function

The `tools()` function is critical for enabling custom data parts and progressive UI updates. It's defined in `ai/tools.ts` and passed to the AI SDK's `streamText()` function.

**Key Concept:** Tools can write custom UI parts using `UIMessageStreamWriter`, allowing progressive updates (like loading states) that are persisted to the database.

### Step 2: Server-Side Tools (with Writer)

Server-side tools receive a `writer` parameter that allows them to write custom data parts during execution:

```typescript
// ai/tools.ts
import { UIMessageStreamWriter } from 'ai';
import { MyDataPart } from '@/lib/message-type';

export const getWeatherInformation = (
  writer: UIMessageStreamWriter<UIMessage<never, MyDataPart>>
) =>
  tool({
    description: 'show the weather in a given city to the user',
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }, { toolCallId: id }) => {
      // Write initial loading state
      writer.write({
        type: 'data-weather',
        data: { location: city, weather: undefined, loading: true },
        id,
      });

      // Simulate async work...
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update with weather data (still loading)
      writer.write({
        type: 'data-weather',
        data: { weather: 'sunny', loading: true },
        id, // Same ID to update the same part
      });

      // More async work...
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Final update with temperature (loading complete)
      writer.write({
        type: 'data-weather',
        data: { temperature: 25, loading: false },
        id, // Same ID
      });

      return { city, weather: 'sunny' };
    },
  });
```

**Key Points:**

- `writer.write()` creates custom UI parts that stream to the client
- Using the same `id` updates an existing part (progressive updates)
- These parts are automatically persisted via `upsertMessage()` in the API route
- The `data` object must match your `MyDataPart` schema

### Step 3: Client-Side Tools (without Writer)

Client-side tools don't have an `execute` function. They require the client to call `addToolResult()`:

```typescript
// ai/tools.ts
export const getLocation = tool({
  description: 'Get the user location.',
  inputSchema: z.object({}),
  outputSchema: z.object({ location: z.string() }), // Required for client-side tools
  // No execute function - handled on client
});
```

**Key Points:**

- Client-side tools require an explicit `outputSchema`
- The client must call `addToolResult()` when the tool is invoked
- See `persistence-frontend.md` for client-side tool handling

### Step 4: Tools Function Export

The `tools()` function combines all tools and passes the writer to server-side tools:

```typescript
// ai/tools.ts
export const tools = (writer: UIMessageStreamWriter) => ({
  getWeatherInformation: getWeatherInformation(writer), // Server-side with writer
  getLocation, // Client-side, no writer needed
});
```

**Usage in API Route:**

```typescript
const result = streamText({
  model: openai('gpt-4o-mini'),
  messages: convertToModelMessages(messages),
  tools: tools(writer), // Pass writer for server-side tools
});
```

### Step 5: Tool Input/Output Types

Export types for use in database schema:

```typescript
// ai/tools.ts
import { InferToolInput, InferToolOutput } from 'ai';

export type getWeatherInformationInput = InferToolInput<
  ReturnType<typeof getWeatherInformation>
>;
export type getWeatherInformationOutput = InferToolOutput<
  ReturnType<typeof getWeatherInformation>
>;

export type getLocationInput = InferToolInput<typeof getLocation>;
export type getLocationOutput = InferToolOutput<typeof getLocation>;
```

These types are used in the database schema for type-safe tool input/output storage.

**Checkpoint:** ✅ Tools function understood

---

## Message Mapping Functions

### Step 1: Create Mapping Utility File

Create `lib/utils/message-mapping.ts`:

This file handles bidirectional conversion between UI messages (used by AI SDK) and database format.

### Step 2: Implement UI → Database Mapping

```typescript
import { MyUIMessagePart } from '../message-type';
import { MyDBUIMessagePart, MyDBUIMessagePartSelect } from '@/lib/db/schema';

/**
 * Convert UI message parts to database format
 *
 * This function maps each UI message part type to the appropriate
 * database columns using the prefix-based naming convention.
 *
 * @param messageParts - Array of UI message parts
 * @param messageId - The message ID these parts belong to
 * @returns Array of database-ready part objects
 */
export const mapUIMessagePartsToDBParts = (
  messageParts: MyUIMessagePart[],
  messageId: string
): MyDBUIMessagePart[] => {
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
          file_filename: part.filename ?? undefined, // Optional field
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

      case 'tool-getWeatherInformation':
        return {
          messageId,
          order: index,
          type: part.type,
          tool_toolCallId: part.toolCallId,
          tool_state: part.state,
          tool_getWeatherInformation_input:
            part.state === 'input-available' ||
            part.state === 'output-available' ||
            part.state === 'output-error'
              ? part.input
              : undefined,
          tool_getWeatherInformation_output:
            part.state === 'output-available' ? part.output : undefined,
          tool_errorText:
            part.state === 'output-error' ? part.errorText : undefined, // text() type, not state
        };

      case 'tool-getLocation':
        return {
          messageId,
          order: index,
          type: part.type,
          tool_toolCallId: part.toolCallId,
          tool_state: part.state,
          tool_getLocation_input:
            part.state === 'input-available' ||
            part.state === 'output-available' ||
            part.state === 'output-error'
              ? part.input
              : undefined,
          tool_getLocation_output:
            part.state === 'output-available' ? part.output : undefined,
          tool_errorText:
            part.state === 'output-error' ? part.errorText : undefined,
        };

      case 'data-weather':
        return {
          messageId,
          order: index,
          type: part.type,
          data_weather_id: part.id,
          data_weather_location: part.data.location,
          data_weather_weather: part.data.weather,
          data_weather_temperature: part.data.temperature,
        };

      default:
        throw new Error(`Unsupported part type: ${part}`);
    }
  });
};
```

### Step 3: Implement Database → UI Mapping

```typescript
/**
 * Convert database parts back to UI message parts
 *
 * This function reconstructs UI message parts from database rows,
 * restoring all type information and state.
 *
 * @param part - Database part row
 * @returns UI message part object
 */
export const mapDBPartToUIMessagePart = (
  part: MyDBUIMessagePartSelect
): MyUIMessagePart => {
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

    case 'tool-getWeatherInformation':
      if (!part.tool_state) {
        throw new Error('tool_state is undefined for getWeatherInformation');
      }
      switch (part.tool_state) {
        case 'input-streaming':
          return {
            type: 'tool-getWeatherInformation',
            state: 'input-streaming',
            toolCallId: part.tool_toolCallId!,
            input: part.tool_getWeatherInformation_input!,
          };
        case 'input-available':
          return {
            type: 'tool-getWeatherInformation',
            state: 'input-available',
            toolCallId: part.tool_toolCallId!,
            input: part.tool_getWeatherInformation_input!,
          };
        case 'output-available':
          return {
            type: 'tool-getWeatherInformation',
            state: 'output-available',
            toolCallId: part.tool_toolCallId!,
            input: part.tool_getWeatherInformation_input!,
            output: part.tool_getWeatherInformation_output!,
          };
        case 'output-error':
          return {
            type: 'tool-getWeatherInformation',
            state: 'output-error',
            toolCallId: part.tool_toolCallId!,
            input: part.tool_getWeatherInformation_input!,
            errorText: part.tool_errorText!,
          };
      }

    case 'tool-getLocation':
      if (!part.tool_state) {
        throw new Error('tool_state is undefined for getLocation');
      }
      switch (part.tool_state) {
        case 'input-streaming':
          return {
            type: 'tool-getLocation',
            state: 'input-streaming',
            toolCallId: part.tool_toolCallId!,
            input: part.tool_getLocation_input!,
          };
        case 'input-available':
          return {
            type: 'tool-getLocation',
            state: 'input-available',
            toolCallId: part.tool_toolCallId!,
            input: part.tool_getLocation_input!,
          };
        case 'output-available':
          return {
            type: 'tool-getLocation',
            state: 'output-available',
            toolCallId: part.tool_toolCallId!,
            input: part.tool_getLocation_input!,
            output: part.tool_getLocation_output!,
          };
        case 'output-error':
          return {
            type: 'tool-getLocation',
            state: 'output-error',
            toolCallId: part.tool_toolCallId!,
            input: part.tool_getLocation_input!,
            errorText: part.tool_errorText!,
          };
      }

    case 'data-weather':
      return {
        type: 'data-weather',
        data: {
          loading: false, // Always set to false when loading from DB
          location: part.data_weather_location!,
          weather: part.data_weather_weather!,
          temperature: part.data_weather_temperature!,
        },
        id: part.data_weather_id!,
      };

    default:
      throw new Error(`Unsupported part type: ${part.type}`);
  }
};
```

**Key Points:**

- Mapping functions handle all part types
- Order is preserved using the `order` field
- Tool states are properly restored
- Type safety is maintained throughout

**Checkpoint:** ✅ Message mapping functions implemented

---

## Database Actions

### Step 1: Create Server Actions File

Create `lib/db/actions.ts`:

This file contains all server-side database operations. These are marked with `"use server"` to run on the server only.

### Step 2: Implement Chat Management Functions

```typescript
'use server';

import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chats, messages, parts } from '@/lib/db/schema';
import { MyUIMessage } from '../message-type';
import {
  mapUIMessagePartsToDBParts,
  mapDBPartToUIMessagePart,
} from '@/lib/utils/message-mapping';

/**
 * Create a new chat session
 *
 * @returns The ID of the newly created chat
 */
export const createChat = async () => {
  const [{ id }] = await db.insert(chats).values({}).returning();
  return id;
};
```

### Step 3: Implement Message Upsert Function

```typescript
/**
 * Insert or update a message in the database
 *
 * This function:
 * 1. Upserts the message record
 * 2. Deletes existing parts for the message
 * 3. Inserts new parts
 *
 * All operations are wrapped in a transaction for atomicity.
 *
 * @param params - Message data
 * @param params.id - Message ID
 * @param params.chatId - Chat ID this message belongs to
 * @param params.message - The UI message object
 */
export const upsertMessage = async ({
  chatId,
  message,
  id,
}: {
  id: string;
  chatId: string;
  message: MyUIMessage;
}) => {
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
```

### Step 4: Implement Chat Loading Function

```typescript
/**
 * Load all messages for a chat
 *
 * Retrieves messages with their parts, ordered by creation time.
 *
 * @param chatId - The chat ID to load messages for
 * @returns Array of UI messages
 */
export const loadChat = async (chatId: string): Promise<MyUIMessage[]> => {
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
```

### Step 5: Implement Additional Utility Functions

```typescript
/**
 * Get all chats
 *
 * @returns Array of all chat records
 */
export const getChats = async () => {
  return await db.select().from(chats);
};

/**
 * Delete a chat and all associated messages/parts
 *
 * Cascade delete ensures messages and parts are also deleted.
 *
 * @param chatId - The chat ID to delete
 */
export const deleteChat = async (chatId: string) => {
  await db.delete(chats).where(eq(chats.id, chatId));
};

/**
 * Delete a message and all subsequent messages in the chat
 *
 * This is useful for implementing "regenerate" functionality.
 * When a user regenerates a response, we delete the old response
 * and all messages that came after it.
 *
 * @param messageId - The message ID to delete
 */
export const deleteMessage = async (messageId: string) => {
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
```

**Key Points:**

- All functions use `"use server"` directive
- Transactions ensure data consistency
- Relational queries simplify data loading
- Cascade deletes handle cleanup automatically

**Checkpoint:** ✅ Database actions implemented

---

## API Route Implementation

### Step 1: Create API Route Handler

Create or update `app/api/chat/route.ts`:

This is the main API endpoint that handles chat requests and streaming responses.

### Step 2: Set Up Basic Route Structure

```typescript
import { tools } from '@/ai/tools';
import { upsertMessage, loadChat } from '@/lib/db/actions';
import { MyUIMessage } from '@/lib/message-type';
import { openai } from '@ai-sdk/openai';
import {
  streamText,
  createUIMessageStream,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStreamResponse,
  generateId,
  UIMessageStreamWriter,
} from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  // Implementation will go here
}
```

### Step 3: Implement Request Handling

```typescript
export async function POST(req: Request) {
  // Parse request body
  const { message, chatId }: { message: MyUIMessage; chatId: string } =
    await req.json();

  // Persist the incoming message immediately
  await upsertMessage({ chatId, id: message.id, message });

  // Load previous messages from database
  const messages = await loadChat(chatId);

  // Create UI message stream
  const stream = createUIMessageStream({
    // Stream execution logic
    execute: ({ writer }) => {
      // Handle message start logic
      if (message.role === 'user') {
        writer.write({
          type: 'start',
          messageId: generateId(),
        });
        writer.write({
          type: 'start-step',
        });
      }

      // Optional: Demo function for testing different part types
      // This randomly injects reasoning, source-url, and source-document parts
      // Remove in production or make it conditional
      // randomlyWriteChunks(writer);

      // Stream AI response
      const result = streamText({
        model: openai('gpt-4o-mini'), // or your preferred model
        messages: convertToModelMessages(messages),
        stopWhen: stepCountIs(5), // Stop after 5 steps
        tools: tools(writer), // Pass writer for custom data parts
      });

      result.consumeStream();
      writer.merge(result.toUIMessageStream({ sendStart: false }));
    },

    // Error handling
    onError: (error) => {
      return error instanceof Error ? error.message : String(error);
    },

    // Original messages for context
    originalMessages: messages,

    // Persist response when stream completes
    onFinish: async ({ responseMessage }) => {
      try {
        await upsertMessage({
          id: responseMessage.id,
          chatId,
          message: responseMessage,
        });
      } catch (error) {
        console.error('Error persisting message:', error);
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

### Step 4: Complete Implementation

Here's the full implementation with comments:

```typescript
import { tools } from '@/ai/tools';
import { upsertMessage, loadChat } from '@/lib/db/actions';
import { MyUIMessage } from '@/lib/message-type';
import { openai } from '@ai-sdk/openai';
import {
  streamText,
  createUIMessageStream,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStreamResponse,
  generateId,
  UIMessageStreamWriter,
} from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * POST /api/chat
 *
 * Handles chat message requests and streams AI responses.
 *
 * Flow:
 * 1. Receive user message and chatId
 * 2. Persist user message to database
 * 3. Load previous messages from database
 * 4. Stream AI response
 * 5. Persist AI response when complete
 */
export async function POST(req: Request) {
  // Parse request body
  const { message, chatId }: { message: MyUIMessage; chatId: string } =
    await req.json();

  // Step 1: Persist incoming message immediately
  // This ensures user messages are saved even if streaming fails
  await upsertMessage({ chatId, id: message.id, message });

  // Step 2: Load conversation history from database
  const messages = await loadChat(chatId);

  // Step 3: Create streaming response
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      // If this is a new user message, start a new assistant message
      if (message.role === 'user') {
        writer.write({
          type: 'start',
          messageId: generateId(),
        });
        writer.write({
          type: 'start-step',
        });
      }

      // Stream AI response using OpenAI
      const result = streamText({
        model: openai('gpt-4o-mini'),
        messages: convertToModelMessages(messages),
        stopWhen: stepCountIs(5), // Stop after 5 reasoning steps
        tools: tools(writer), // Pass writer for custom UI parts
      });

      // Consume the stream and merge with UI message stream
      result.consumeStream();
      writer.merge(result.toUIMessageStream({ sendStart: false }));
    },

    // Handle errors during streaming
    onError: (error) => {
      // Error messages are masked by default for security
      // Unmask if needed for debugging
      return error instanceof Error ? error.message : String(error);
    },

    // Provide original messages for context
    originalMessages: messages,

    // Step 4: Persist response when streaming completes
    onFinish: async ({ responseMessage }) => {
      try {
        await upsertMessage({
          id: responseMessage.id,
          chatId,
          message: responseMessage,
        });
      } catch (error) {
        console.error('Error persisting response message:', error);
        // Don't throw - streaming already completed
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

**Key Points:**

- User messages are persisted immediately
- Previous messages are loaded from database
- Streaming happens in real-time
- Response is persisted when stream completes
- Errors are handled gracefully

**Note:** The actual implementation includes a `randomlyWriteChunks()` function that randomly injects reasoning, source-url, and source-document parts for testing/demo purposes. This is optional and can be removed or made conditional in production.

**Checkpoint:** ✅ API route implemented

---

## Complete Data Flow Example

### End-to-End Flow

Here's how a complete message flow works from user input to persisted response:

1. **User sends message** (Frontend)

   ```typescript
   sendMessage({ parts: [{ text: "What's the weather?", type: 'text' }] });
   ```

2. **Transport sends request** (Frontend)

   - Only last message sent: `{ message: {...}, chatId: "chat-123" }`
   - Request goes to `/api/chat`

3. **API route receives** (Backend)

   ```typescript
   const { message, chatId } = await req.json();
   ```

4. **Persist user message** (Backend)

   ```typescript
   await upsertMessage({ chatId, id: message.id, message });
   ```

5. **Load conversation history** (Backend)

   ```typescript
   const messages = await loadChat(chatId);
   // Returns: [previous messages...]
   ```

6. **Stream AI response** (Backend)

   ```typescript
   const result = streamText({
     model: openai('gpt-4o-mini'),
     messages: convertToModelMessages(messages),
     tools: tools(writer),
   });
   ```

7. **Tool execution** (Backend, if tool called)

   ```typescript
   // Tool writes progressive updates
   writer.write({
     type: 'data-weather',
     data: { location: 'London', loading: true },
   });
   // ... more updates ...
   ```

8. **Stream to client** (Backend → Frontend)

   - Response streams in real-time
   - Frontend receives chunks via `useChat` hook

9. **Persist response** (Backend, on finish)

   ```typescript
   onFinish: async ({ responseMessage }) => {
     await upsertMessage({
       id: responseMessage.id,
       chatId,
       message: responseMessage,
     });
   };
   ```

10. **Render in UI** (Frontend)
    - Messages render as they stream
    - Parts render based on type
    - Custom components update progressively

**Key Insight:** The frontend only sends the new message. The backend loads the full history, ensuring consistency and reducing payload size.

---

## Testing & Validation

### Step 1: Test Database Connection

1. Start your development server:

```bash
pnpm dev
```

2. Check Supabase dashboard → **Table Editor** to verify tables exist

3. Verify connection by checking server logs for any database errors

### Step 2: Test Chat Creation

Create a test script or use your UI to create a chat:

```typescript
// Example: In your chat component
const chatId = await createChat();
console.log('Created chat:', chatId);
```

Verify in Supabase:

- Go to **Table Editor** → `chats`
- You should see a new row with the chat ID

### Step 3: Test Message Persistence

Send a message through your chat interface and verify:

1. **User message persists:**

   - Check `messages` table - should have a row with role "user"
   - Check `parts` table - should have corresponding part rows

2. **AI response persists:**
   - Wait for streaming to complete
   - Check `messages` table - should have a row with role "assistant"
   - Check `parts` table - should have parts for the response

### Step 4: Test Message Loading

Reload your chat page and verify:

- Previous messages load correctly
- Message order is preserved
- All part types are reconstructed properly

### Step 5: Test Edge Cases

1. **Empty chat:**

   - Create a new chat and verify it loads as empty

2. **Long messages:**

   - Send a very long message and verify it persists

3. **Multiple tool calls:**

   - Trigger multiple tool calls and verify all persist

4. **Error handling:**
   - Simulate a database error and verify graceful handling

### Step 6: Verify Data Integrity

Check constraints are working:

1. Try to insert invalid data (should fail):

   - Text part without `text_text`
   - Tool part without `tool_toolCallId`

2. Verify cascade deletes:
   - Delete a chat → messages and parts should be deleted
   - Delete a message → parts should be deleted

**Checkpoint:** ✅ All tests passing

---

## Troubleshooting

### Common Issues

#### Issue: "Connection refused" or "Connection timeout"

**Symptoms:** Database connection errors in server logs

**Solutions:**

1. Verify `DATABASE_URL` in `.env.local` is correct
2. Check Supabase project is active (not paused)
3. Verify database password is correct
4. Check if IP restrictions are enabled in Supabase (Settings → Database → Connection Pooling)

#### Issue: "Table does not exist"

**Symptoms:** Errors about missing tables

**Solutions:**

1. Run `pnpm db:push` to create tables
2. Verify schema file path in `drizzle.config.ts`
3. Check Supabase dashboard → Table Editor

#### Issue: "Check constraint violation"

**Symptoms:** Errors when inserting messages

**Solutions:**

1. Verify all required fields are provided for the part type
2. Check mapping functions are correctly setting fields
3. Review check constraints in schema

#### Issue: Messages not persisting

**Symptoms:** Messages appear in UI but not in database

**Solutions:**

1. Check server logs for errors
2. Verify `upsertMessage` is being called
3. Check transaction is completing successfully
4. Verify database connection is working

#### Issue: Messages load in wrong order

**Symptoms:** Messages appear out of sequence

**Solutions:**

1. Verify `orderBy` in `loadChat` function
2. Check `order` field is set correctly in mapping
3. Verify `createdAt` timestamps are correct

#### Issue: Tool calls not persisting correctly

**Symptoms:** Tool calls missing inputs/outputs

**Solutions:**

1. Verify tool state is set correctly
2. Check mapping functions handle all tool states
3. Verify JSONB columns are storing data correctly

### Debugging Tips

1. **Enable query logging:**

```typescript
// In lib/db/index.ts
export const db = drizzle(pool, {
  schema: { ...schema, ...relations },
  logger: true, // Enable query logging
});
```

2. **Check Supabase logs:**

   - Go to Supabase dashboard → Logs
   - Filter by "Database" to see queries

3. **Use Drizzle Studio:**

```bash
pnpm db:studio
```

- Opens a visual database browser
- Useful for inspecting data

4. **Add console logs:**

```typescript
console.log('Persisting message:', { id, chatId, role });
console.log('Message parts:', message.parts);
```

### Getting Help

If you're stuck:

1. Check Supabase documentation: [supabase.com/docs](https://supabase.com/docs)
2. Check Drizzle ORM documentation: [orm.drizzle.team](https://orm.drizzle.team)
3. Check AI SDK documentation: [sdk.vercel.ai](https://sdk.vercel.ai)
4. Review error messages carefully - they often point to the issue

---

## Summary

### What We Built

✅ **Database Schema**

- Three tables: `chats`, `messages`, `parts`
- Prefix-based column naming for type safety
- Check constraints for data integrity
- Indexes for performance
- Fixed type error: `tool_errorText` is `text()`, not a state type

✅ **Message Persistence**

- Bidirectional mapping between UI and database
- Support for all message part types
- Transaction-based operations for consistency
- Proper handling of optional fields (e.g., `file_filename`)

✅ **Tools Integration**

- Server-side tools with `UIMessageStreamWriter`
- Client-side tools pattern
- Custom data parts support
- Progressive UI updates

✅ **API Integration**

- Streaming responses with persistence
- Error handling
- Message history loading
- Tools function integration

### Key Takeaways

1. **Prefix-based columns** simplify schema while maintaining type safety
2. **Transactions** ensure data consistency
3. **Relational queries** simplify data loading
4. **Cascade deletes** handle cleanup automatically
5. **Type safety** is maintained throughout the stack

### Next Steps

After implementing backend persistence, continue with:

- **Frontend Integration** - See `persistence-frontend.md` for:
  - React components and `useChat` hook
  - Message rendering and UI patterns
  - Client-side tool handling
  - Message deletion UI

Additional features to consider:

- Add user authentication (see `plans/implement-auth.md`)
- Add message search functionality
- Implement message editing
- Add pagination for long conversations
- Add message export functionality

---

## Unresolved Questions

- Should we add soft deletes (marking messages as deleted instead of removing)?
- Do we need message versioning/history?
- Should we add message metadata (tags, labels)?
- Do we need full-text search capabilities?
- Should we add message attachments storage (files, images)?
- Should we document the `randomlyWriteChunks()` demo function in the API route?
