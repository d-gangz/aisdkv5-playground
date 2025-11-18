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
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamObject,
  streamText,
  type ModelMessage,
  type UIMessage,
} from 'ai';
import { z } from 'zod';

export type MyMessage = UIMessage<never, { suggestions: string[] }>;

export async function POST(req: Request): Promise<Response> {
  const { messages }: { messages: MyMessage[] } = await req.json();

  //   // Log incoming UI messages (before conversion)
  //   console.log('\n=== INCOMING UI MESSAGES (MyMessage[]) ===');
  //   console.log('Total messages:', messages.length);
  //   console.log('Messages structure:', JSON.stringify(messages, null, 2));

  const modelMessages: ModelMessage[] = convertToModelMessages(messages);

  //   // Log converted model messages (after conversion)
  //   console.log('\n=== CONVERTED MODEL MESSAGES (ModelMessage[]) ===');
  //   console.log('Total messages:', modelMessages.length);
  //   console.log(
  //     'Model messages structure:',
  //     JSON.stringify(modelMessages, null, 2)
  //   );

  //   // Side-by-side comparison for easier debugging
  //   console.log('\n=== CONVERSION COMPARISON ===');
  //   messages.forEach((uiMsg, index) => {
  //     console.log(`\nMessage ${index + 1}:`);
  //     console.log('  UI Message:', {
  //       role: uiMsg.role,
  //       id: uiMsg.id,
  //       parts: uiMsg.parts?.map((p) => ({
  //         type: p.type,
  //         ...(p.type === 'text'
  //           ? { text: p.text?.substring(0, 50) + '...' }
  //           : {}),
  //       })),
  //     });
  //     if (modelMessages[index]) {
  //       console.log('  Model Message:', {
  //         role: modelMessages[index].role,
  //         content:
  //           typeof modelMessages[index].content === 'string'
  //             ? modelMessages[index].content.substring(0, 50) + '...'
  //             : modelMessages[index].content,
  //       });
  //     }
  //   });

  // createUIMessageStream gives us a writer to manually control what gets streamed
  // This allows us to combine multiple streams and add custom data
  const stream = createUIMessageStream<MyMessage>({
    execute: async ({ writer }) => {
      // ============================================================
      // PHASE 1: Stream the main chat response (text)
      // ============================================================

      // Start streaming text from the model (non-blocking - returns immediately)
      // The model will generate text incrementally
      const streamTextResult = await streamText({
        model: openai('gpt-4o'),
        messages: modelMessages,
      });

      // Merge the text stream into our main UI stream
      // This forwards all text events (text-start, text-delta, text-end) to the frontend
      // The frontend will receive these events and display the text as it streams
      writer.merge(streamTextResult.toUIMessageStream());

      // CRITICAL: Wait for the stream to fully complete before proceeding
      // Why we need consumeStream():
      // 1. Without this, the code would continue immediately and try to use streamTextResult.text
      //    before the stream finishes, which would be undefined or incomplete
      // 2. We need the COMPLETE text (see line 81) to include in the follow-up prompt
      // 3. This ensures the text stream is fully consumed and streamTextResult.text is available
      // 4. The frontend will have received all text-delta events by this point
      await streamTextResult.consumeStream();

      // ============================================================
      // PHASE 2: Generate and stream follow-up suggestions
      // ============================================================

      // Now that we have the complete text, generate suggestions based on it
      // streamObject() generates a structured object (with suggestions array) incrementally
      const followupSuggestionsResult = streamObject({
        model: openai('gpt-4o'),
        schema: z.object({
          suggestions: z.array(z.string()),
        }),
        messages: [
          ...modelMessages,
          {
            role: 'assistant',
            // This is why we needed consumeStream() - we need the complete text here
            content: await streamTextResult.text,
          },
          {
            role: 'user',
            content:
              'What question should I ask next? Return an array of 2-3 suggested questions.',
          },
        ],
      });

      // Generate a unique ID for this data part
      // All suggestion updates will share this same ID, so the frontend knows
      // they're updates to the same part (not separate parts)
      const dataPartId = crypto.randomUUID();

      // partialObjectStream emits chunks as the object is being built
      // Each chunk contains the CURRENT STATE of the object (not deltas)
      // Example progression:
      //   chunk 1: { suggestions: [] }
      //   chunk 2: { suggestions: [""] }
      //   chunk 3: { suggestions: ["What's"] }
      //   chunk 4: { suggestions: ["What's the"] }
      //   chunk 5: { suggestions: ["What's the latest", "How about"] }
      //   final:   { suggestions: ["What's the latest news?", "How about sports?", ...] }
      for await (const chunk of followupSuggestionsResult.partialObjectStream) {
        // Write the current state of suggestions to the stream
        // Each write() sends the FULL current state (not appending)
        // The frontend receives each update and replaces the previous state
        // Using the same ID means all writes update the same part
        writer.write({
          id: dataPartId, // Same ID for all updates = same part gets updated
          type: 'data-suggestions', // Custom type the frontend can recognize
          data:
            chunk.suggestions?.filter(
              (suggestion) => suggestion !== undefined
            ) ?? [],
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
