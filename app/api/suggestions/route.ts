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

  const modelMessages: ModelMessage[] = convertToModelMessages(messages);

  const stream = createUIMessageStream<MyMessage>({
    execute: async ({ writer }) => {
      const streamTextResult = await streamText({
        model: openai('gpt-4o'),
        messages: modelMessages,
      });

      writer.merge(streamTextResult.toUIMessageStream());

      await streamTextResult.consumeStream();

      const followupSuggestionsResult = streamObject({
        model: openai('gpt-4o'),
        schema: z.object({
          suggestions: z.array(z.string()),
        }),
        messages: [
          ...modelMessages,
          {
            role: 'assistant',
            content: await streamTextResult.text,
          },
          {
            role: 'user',
            content:
              'What question should I ask next? Return an array of 2-3 suggested questions.',
          },
        ],
      });

      const dataPartId = crypto.randomUUID();

      for await (const chunk of followupSuggestionsResult.partialObjectStream) {
        writer.write({
          id: dataPartId,
          type: 'data-suggestions',
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
