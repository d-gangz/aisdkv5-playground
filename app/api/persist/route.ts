/**
 * API route that streams a chat response followed by follow-up question suggestions.
 *
 * Flow Overview:
 * 1. Stream the main chat response (text) to the frontend
 * 2. Wait for the text stream to complete
 * 3. Generate follow-up suggestions based on the completed response
 * 4. Stream the suggestions as they're being built
 *
 * Input data sources: POST request with messages array
 * Output destinations: Streaming response to frontend
 * Dependencies: OpenAI API, AI SDK streaming functions
 * Key exports: POST handler
 * Side effects: Makes API calls to OpenAI, streams data to client
 */

import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  streamText,
  type ModelMessage,
  type UIMessage,
} from 'ai';

export async function POST(req: Request): Promise<Response> {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const modelMessages: ModelMessage[] = convertToModelMessages(messages);

  const streamTextResult = await streamText({
    model: openai('gpt-4o'),
    messages: modelMessages,
  });

  return streamTextResult.toUIMessageStreamResponse();
}
