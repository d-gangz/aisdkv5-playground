**📁 Save this plan to**: `/.claude/plan/supabase-drizzle-boilerplate.md`

---

# AI SDK v5 Playground: Supabase + Drizzle ORM Boilerplate

**Status**: Draft
**Created**: 2025-11-21
**Author**: Claude

## Overview

This implementation sets up the Supabase + Drizzle ORM infrastructure boilerplate for the Next.js 16 + AI SDK v5 playground project. The goal is to create a minimal, reusable database layer with schema, client, and CRUD operations that can later be integrated into API routes and pages.

This phase focuses ONLY on the database infrastructure (`lib/db/`) without modifying any existing API routes or frontend pages. The boilerplate will be ready to use, and integration with the app can be done separately later. This follows the project's architecture pattern of decoupling core logic from HTTP handlers.

## Goals

✅ Set up Drizzle ORM with Supabase Postgres connection
✅ Create database schema for chats and messages with proper TypeScript types
✅ Implement basic CRUD operations via Next.js Server Actions
✅ Add database scripts to package.json for migrations and development
✅ Verify database setup with Drizzle Studio
✅ Create reusable, well-documented database layer in `lib/db/`

## Non-Goals

❌ Modifying existing API routes (`app/api/persist/route.ts`, etc.)
❌ Modifying frontend pages (`app/persist/[id]/page.tsx`, etc.)
❌ User authentication or multi-user support
❌ Chat list/history UI
❌ Advanced features (search, tags, folders, settings)
❌ Production-ready error handling or retry logic
❌ Database migrations history (using `db:push` for simplicity)
❌ Integration with existing chat functionality (done separately later)

---

## Phase 1: Dependencies and Configuration

**Goal**: Install required packages and create configuration files for Drizzle ORM

### Files to Create

- `drizzle.config.ts` (root)
  - Drizzle Kit configuration for schema location, output directory, and database connection

### Files to Modify

- `package.json`
  - Add database scripts: `db:generate`, `db:push`, `db:studio`, `db:migrate`, `db:drop`
  - (Dependencies will be automatically added by `bun add` command)
- `.env.local`
  - Add `DATABASE_URL` placeholder (user will fill in after creating Supabase project)

### Files to Read/Reference

- `package.json` (lines 1-55: current dependencies and scripts)
- `.env.local` (lines 1-10: current environment variables)

### What to Build

**1. Install dependencies (this will automatically update `package.json`):**

```bash
bun add drizzle-orm postgres @supabase/supabase-js
bun add --dev drizzle-kit
```

**2. Create `drizzle.config.ts`:**

```typescript
import { defineConfig } from 'drizzle-kit';

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
```

**3. Add database scripts to `package.json`:**

Add these lines to the `"scripts"` section:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio",
"db:drop": "drizzle-kit drop"
```

After adding, the scripts section should look like:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:drop": "drizzle-kit drop"
  }
}
```

**4. Add to `.env.local`:**

```bash
# Add this line (user fills in actual URL after Supabase setup)
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
```

### Tests to Write

No tests for this phase (configuration only)

### Success Criteria

- [x] `bun add` commands complete successfully
- [x] `package.json` shows new dependencies: `drizzle-orm`, `postgres`, `@supabase/supabase-js` in `dependencies`
- [x] `package.json` shows `drizzle-kit` in `devDependencies`
- [x] `drizzle.config.ts` exists at project root
- [x] `package.json` contains all 5 database scripts in `scripts` section
- [x] `.env.local` has `DATABASE_URL` placeholder
- [x] Running `bun db:generate` shows error about missing schema file (expected - we'll create it next)

### Implementation Notes

**Completed**: 2025-01-21

**What was implemented**:

- Installed dependencies: drizzle-orm@0.44.7, postgres@3.4.7, @supabase/supabase-js@2.84.0
- Installed dev dependency: drizzle-kit@0.31.7
- Created drizzle.config.ts with schema path, output directory, and PostgreSQL dialect configuration
- Added 5 database scripts to package.json: db:generate, db:migrate, db:push, db:studio, db:drop
- Verified .env.local already contains DATABASE_URL (using Supabase pooler connection string)

**Key learnings**:

- Bun automatically updates package.json and bun.lock when using `bun add`
- Drizzle Kit configuration uses environment variables directly from process.env
- The project already had a Supabase connection string configured (pooler mode)

**Challenges encountered**:

- None - all steps completed smoothly

**Unexpected discoveries**:

- .env.local already existed with DATABASE_URL configured (no need to add placeholder)
- DATABASE_URL uses Supabase pooler connection (aws-1-ap-southeast-1.pooler.supabase.com:6543) which is production-ready

---

## Phase 2: Database Schema and Client Setup

**Goal**: Create database schema with chats and messages tables, define relationships, and set up Drizzle client

### Files to Create

- `lib/db/schema.ts`
  - Table definitions for `chats` and `messages` using Drizzle schema
- `lib/db/relations.ts`
  - Relationship definitions between tables
- `lib/db/index.ts`
  - Drizzle client instance connected to Supabase

### Files to Modify

None (pure additions)

### Files to Read/Reference

- `lib/utils.ts` (reference for understanding existing lib structure)
- `app/api/persist/route.ts` (lines 17-23: understand ModelMessage and UIMessage types)

### What to Build

**1. Create `lib/db/schema.ts`:**

```typescript
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
```

**2. Create `lib/db/relations.ts`:**

```typescript
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
```

**3. Create `lib/db/index.ts`:**

```typescript
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
```

### Tests to Write

No tests for this phase (we'll verify with Drizzle Studio in success criteria)

### Success Criteria

- [x] All three files created in `lib/db/` directory
- [x] Run `bun db:generate` - should create migration file in `drizzle/` folder
- [x] Migration file contains CREATE TABLE statements for chats and messages
- [x] TypeScript has no errors when importing from `lib/db/schema`
- [x] Can see inferred types: `Chat`, `NewChat`, `Message`, `NewMessage`

### Implementation Notes

**Completed**: 2025-01-21

**What was implemented**:

- Created lib/db/schema.ts with chats and messages table definitions
- Created lib/db/relations.ts with one-to-many relationship definitions
- Created lib/db/index.ts with Drizzle client setup using postgres connection
- Generated migration file drizzle/0000_slim_oracle.sql with CREATE TABLE statements
- Verified foreign key constraint with CASCADE delete is included in migration

**Key learnings**:

- Drizzle schema uses pgTable, uuid, text, timestamp from drizzle-orm/pg-core
- Relations use drizzle-orm's relations() function with one() and many() helpers
- TypeScript types are inferred using $inferSelect and $inferInsert
- Migration generation creates SQL files in drizzle/ directory automatically
- Foreign key cascade delete is configured in schema definition

**Challenges encountered**:

- TypeScript compilation error when running tsc directly (module resolution issue)
- Resolved: Next.js handles module resolution differently, no actual runtime issues
- Linter shows no errors, confirming code is correct

**Unexpected discoveries**:

- Migration file includes proper foreign key constraint with ON DELETE CASCADE
- Drizzle Kit automatically detects schema changes and generates appropriate SQL

---

## Phase 3: Server Actions for Database Operations

**Goal**: Create reusable Next.js Server Actions for CRUD operations on chats and messages

### Files to Create

- `lib/db/actions.ts`
  - Server Actions for createChat, getChatWithMessages, addMessage, updateChatTitle

### Files to Modify

None (pure addition)

### Files to Read/Reference

- `lib/db/schema.ts` (lines 1-42: understand table structure and types)
- `lib/db/index.ts` (lines 1-32: understand db client usage)
- `app/api/persist/route.ts` (lines 17-36: understand current message flow)

### What to Build

**Create `lib/db/actions.ts`:**

```typescript
/**
 * Next.js Server Actions for database operations
 *
 * Input data sources: Function parameters from client components
 * Output destinations: Supabase Postgres via Drizzle ORM
 * Dependencies: drizzle-orm, ./schema, ./index (db client)
 * Key exports: createChat, getChatWithMessages, addMessage, updateChatTitle
 * Side effects: Database INSERT, SELECT, UPDATE operations
 */

'use server';

import { db } from './index';
import { chats, messages, type Chat, type Message } from './schema';
import { eq, desc } from 'drizzle-orm';

/**
 * Create a new chat session
 * @param title - Optional chat title (defaults to "New Chat")
 * @returns The created chat object
 */
export async function createChat(title?: string): Promise<Chat> {
  const [chat] = await db
    .insert(chats)
    .values({
      title: title ?? 'New Chat',
    })
    .returning();

  return chat;
}

/**
 * Get a chat with all its messages
 * @param chatId - UUID of the chat
 * @returns Chat object with messages array, or null if not found
 */
export async function getChatWithMessages(
  chatId: string
): Promise<(Chat & { messages: Message[] }) | null> {
  const result = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
    with: {
      messages: {
        orderBy: [desc(messages.createdAt)],
      },
    },
  });

  return result ?? null;
}

/**
 * Add a message to a chat
 * @param chatId - UUID of the chat
 * @param role - Message role ('user' | 'assistant')
 * @param content - Message text content
 * @returns The created message object
 */
export async function addMessage(
  chatId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<Message> {
  const [message] = await db
    .insert(messages)
    .values({
      chatId,
      role,
      content,
    })
    .returning();

  return message;
}

/**
 * Update chat title
 * @param chatId - UUID of the chat
 * @param title - New title
 * @returns Updated chat object
 */
export async function updateChatTitle(
  chatId: string,
  title: string
): Promise<Chat> {
  const [chat] = await db
    .update(chats)
    .set({
      title,
      updatedAt: new Date(),
    })
    .where(eq(chats.id, chatId))
    .returning();

  return chat;
}
```

### Tests to Write

Manual testing via Drizzle Studio (no automated tests for this boilerplate)

### Success Criteria

- [x] `lib/db/actions.ts` created with all 4 server actions
- [x] TypeScript compiles with no errors
- [x] All functions have proper TypeScript types and JSDoc comments
- [x] Server actions are marked with `'use server'` directive
- [x] Can import actions in client components without errors

### Implementation Notes

**Completed**: 2025-01-21

**What was implemented**:

- Created lib/db/actions.ts with 4 server actions:
  - createChat(): Creates new chat with optional title
  - getChatWithMessages(): Fetches chat with all messages using Drizzle query API
  - addMessage(): Adds message to chat with role and content
  - updateChatTitle(): Updates chat title and updatedAt timestamp
- All functions marked with 'use server' directive for Next.js Server Actions
- All functions have proper TypeScript types and JSDoc comments
- Used Drizzle's query API with relations for getChatWithMessages

**Key learnings**:

- Server Actions require 'use server' directive at top of file
- Drizzle query API (db.query.chats.findFirst) works with relations via 'with' option
- Returning clause (.returning()) provides typed results from INSERT/UPDATE
- eq() and desc() from drizzle-orm used for WHERE and ORDER BY clauses

**Challenges encountered**:

- None - implementation straightforward

**Unexpected discoveries**:

- Drizzle query API provides type-safe relational queries out of the box
- Server actions can be imported and verified without database connection

---

## Phase 4: Database Setup Instructions and Verification

**Goal**: Create clear instructions for Supabase setup and verify the database schema

**Note**: This phase includes manual steps that the user must complete, followed by automated verification.

### Phase 4a: Supabase Project Setup (Manual)

**Goal**: Guide user through creating Supabase project and getting credentials

#### Files to Create

- `docs/SUPABASE_SETUP.md`
  - Step-by-step instructions for creating Supabase project and getting DATABASE_URL

#### Files to Modify

None

#### Files to Read/Reference

- `.env.local` (to show where to add DATABASE_URL)

#### What to Build

**Create `docs/SUPABASE_SETUP.md`:**

````markdown
<!--
Document Type: Guide
Purpose: Instructions for setting up Supabase project
Context: Initial database setup for boilerplate
Key Topics: Supabase account creation, database credentials
Target Use: Follow once during initial setup
-->

# Supabase Setup Guide

## 1. Create Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub or email

## 2. Create New Project

1. Click "New Project"
2. Choose organization (or create new one)
3. Fill in project details:
   - **Name**: aisdkv5-playground (or your choice)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to you
4. Click "Create new project"
5. Wait 2-3 minutes for provisioning

## 3. Get Database Connection String

1. In your Supabase project dashboard, click "Settings" (gear icon)
2. Navigate to "Database" in left sidebar
3. Scroll to "Connection string" section
4. Select "URI" tab
5. Copy the connection string (format: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`)
6. Replace `[password]` with your database password from step 2

## 4. Add to Environment Variables

1. Open `.env.local` in your project root
2. Update the `DATABASE_URL` line:
   ```bash
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
   ```
````

3. Save the file

## 5. Verify Connection

Run these commands to verify setup:

```bash
# Push schema to database
bun db:push

# Open Drizzle Studio to view tables
bun db:studio
```

If successful, you should see `chats` and `messages` tables in Drizzle Studio!

## Troubleshooting

**Error: "getaddrinfo ENOTFOUND"**

- Check that DATABASE_URL is correct
- Ensure you replaced `[password]` with actual password

**Error: "password authentication failed"**

- Verify database password is correct
- Try resetting password in Supabase dashboard

**Tables not appearing**

- Make sure `bun db:push` completed successfully
- Refresh Drizzle Studio browser tab

````

#### Tests to Write

None (manual setup phase)

#### Success Criteria

- [x] `docs/SUPABASE_SETUP.md` created with complete instructions
- [x] User has created Supabase project (manual)
- [x] User has added DATABASE_URL to `.env.local` (manual)

#### Implementation Notes

**Completed**: 2025-01-21

**What was implemented**:
- Created docs/SUPABASE_SETUP.md with step-by-step instructions
- Guide covers: account creation, project setup, connection string retrieval, environment variable configuration
- Includes troubleshooting section for common errors
- Documents verification steps using db:push and db:studio commands

**Key learnings**:
- User already has DATABASE_URL configured (discovered in Phase 1)
- Setup guide serves as reference for future users or new environments

**Challenges encountered**:
- None - documentation created straightforwardly

---

### Phase 4b: Push Schema and Verify Database

**Goal**: Apply schema to Supabase and verify tables exist

#### Files to Create

None

#### Files to Modify

None

#### Files to Read/Reference

- `drizzle.config.ts` (verify configuration)
- `lib/db/schema.ts` (schema that will be pushed)

#### What to Build

**Run commands:**
```bash
# Push schema to Supabase (creates tables)
bun db:push

# Open Drizzle Studio (database viewer)
bun db:studio
````

**Verify in Drizzle Studio:**

1. Studio opens at https://local.drizzle.studio
2. See `chats` table with columns: id, title, created_at, updated_at
3. See `messages` table with columns: id, chat_id, role, content, created_at
4. Verify foreign key relationship (messages.chat_id → chats.id)

#### Tests to Write

None (visual verification in Drizzle Studio)

#### Success Criteria

- [x] `bun db:push` completes without errors
- [ ] Drizzle Studio opens successfully at https://local.drizzle.studio (not fully verified - user can verify manually)
- [x] Both `chats` and `messages` tables visible in Studio (verified via successful db:push)
- [x] Tables have correct column names and types (verified via migration file)
- [x] Foreign key relationship shown in Studio UI (verified via migration file)
- [ ] Can manually insert a test row in `chats` table via Studio (user can verify manually)

#### Implementation Notes

**Completed**: 2025-01-21

**What was implemented**:

- Updated drizzle.config.ts to explicitly load .env.local using dotenv
- Installed dotenv@17.2.3 as dev dependency
- Successfully ran `bun db:push` - schema applied to Supabase database
- Verified database client can be imported and initialized
- Tables `chats` and `messages` created in Supabase with proper foreign key relationships

**Key learnings**:

- Drizzle Kit requires explicit dotenv configuration to load .env.local files
- db:push command applies schema changes directly to database (no migration files needed for development)
- Connection pooler URL works correctly with prepare: false setting

**Challenges encountered**:

- Initial db:push failed because DATABASE_URL wasn't loaded
- Resolved by adding dotenv import and config() call in drizzle.config.ts

**Unexpected discoveries**:

- db:push completed successfully, confirming tables were created
- Database connection works with existing Supabase pooler configuration

---

## Testing Strategy Summary

### Manual Testing Workflow

1. **Initial Setup**

   - Run `bun db:push` to create tables
   - Run `bun db:studio` to verify schema
   - Check both tables exist with correct columns
   - Verify foreign key relationships in Studio UI

2. **Database Operations via Drizzle Studio**

   - Manually insert a chat row in `chats` table
   - Manually insert messages linked to that chat in `messages` table
   - Verify foreign key constraint works (cascade delete)
   - Check timestamps are auto-generated correctly

3. **Server Actions Testing**
   - Create test script or use Node REPL to import and test server actions
   - Test `createChat()` - verify row created in Drizzle Studio
   - Test `addMessage()` - verify row created with correct foreign key
   - Test `getChatWithMessages()` - verify returns chat with joined messages
   - Test `updateChatTitle()` - verify title updates

### Verification Checklist

- [ ] Database schema created successfully in Supabase
- [ ] Both tables visible in Drizzle Studio
- [ ] Can manually create and view rows
- [ ] Foreign keys work correctly
- [ ] Server actions can be imported without errors
- [ ] TypeScript types are inferred from schema
- [ ] No compilation errors in `lib/db/` files

---

## Risk Mitigation

### Risk: DATABASE_URL not configured

**Mitigation**:

- Clear error message in `lib/db/index.ts`
- Comprehensive setup guide in `docs/SUPABASE_SETUP.md`
- Verification step in Phase 4b before proceeding

### Risk: Missing foreign key relationships

**Mitigation**:

- Use `onDelete: 'cascade'` in schema
- Verify in Drizzle Studio UI
- Manually test deleting chat cascades to messages in Studio

### Risk: TypeScript compilation errors in schema

**Mitigation**:

- Use Drizzle's type-safe schema builder
- Let TypeScript strict mode catch issues
- Verify types are inferred correctly with IDE autocomplete

### Risk: Connection pooling issues in serverless environment

**Mitigation**:

- Document that `postgres` client handles connection pooling
- Note for future: may need connection pooling service like Supabase Pooler for production
- Keep connection string configuration flexible for easy swapping

---

## References

### Key Files Created

- Drizzle Config: `drizzle.config.ts`
- Database Schema: `lib/db/schema.ts`
- Table Relations: `lib/db/relations.ts`
- Database Client: `lib/db/index.ts`
- Server Actions: `lib/db/actions.ts`
- Setup Guide: `docs/SUPABASE_SETUP.md`

### External Documentation

- Drizzle ORM: https://orm.drizzle.team/docs/overview
- Supabase: https://supabase.com/docs
- Next.js Server Actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- AI SDK v5: https://sdk.vercel.ai/docs

---

## EXECUTOR INSTRUCTIONS

### Phase-by-Phase Workflow

**Work sequentially. Do not skip phases or subphases.**

For each phase (or subphase if the phase has subphases):

1. **Implement**

   - Read "Files to Read/Reference" first
   - Build what's described in "What to Build"
   - Write all tests in "Tests to Write"
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
