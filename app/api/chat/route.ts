import { chat } from './chat';
import { convertToModelMessages, UIMessage } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const modelMessages = convertToModelMessages(messages);
  
  const result = await chat(modelMessages);

  return result.toUIMessageStreamResponse();
}