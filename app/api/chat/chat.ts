import { openai } from '@ai-sdk/openai';
import { streamText, ModelMessage } from 'ai';

export async function chat(messages: ModelMessage[]) {
  const result = streamText({
    model: openai('gpt-4o'),
    messages: messages,
  });

  return result;
}