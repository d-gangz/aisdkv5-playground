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
export async function getChatWithMessages(chatId: string): Promise<
  (Chat & { messages: Message[] }) | null
> {
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

