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
import { streamText, convertToModelMessages, UIMessage, generateId } from 'ai';

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
    // Generate ID if message doesn't have one
    const userMessageId = message.id || generateId();
    await upsertMessage({ chatId, id: userMessageId, message });

    // Step 3: Load conversation history from database
    const messages = await loadChat(chatId);

    // Step 4: Stream AI response using streamText
    const result = streamText({
      model: openai('gpt-4o'),
      messages: convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse({
      onFinish: async ({ responseMessage }) => {
        // Generate ID if responseMessage doesn't have one
        const messageId = responseMessage.id || generateId();
        await upsertMessage({
          chatId,
          id: messageId,
          message: responseMessage,
        });
      },
    });
  } catch (error) {
    console.error('API route error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
