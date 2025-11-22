/**
 * Database server actions for chat message persistence
 *
 * Input data sources: Function parameters from client/server
 * Output destinations: Supabase Postgres via Drizzle ORM
 * Dependencies: drizzle-orm, schema, message-mapping utilities
 * Key exports: getChat, createChat, upsertMessage, loadChat, deleteMessage, deleteChat, getChats
 * Side effects: Database INSERT, SELECT, UPDATE, DELETE operations
 */

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
  chatId: string;
  message: UIMessage;
  id: string;
}): Promise<void> => {
  const messageId = id;

  // Map UI message parts to database format
  const mappedDBUIParts = mapUIMessagePartsToDBParts(message.parts, messageId);

  // Use transaction to ensure atomicity
  await db.transaction(async (tx) => {
    // Upsert message (insert or update if exists)
    await tx
      .insert(messages)
      .values({
        chatId,
        role: message.role,
        id: messageId,
      })
      .onConflictDoUpdate({
        target: messages.id,
        set: {
          chatId,
        },
      });

    // Delete existing parts (in case of update)
    await tx.delete(parts).where(eq(parts.messageId, messageId));

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
