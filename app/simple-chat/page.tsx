'use client';

/**
 * Simple chat interface using AI Elements components
 *
 * Input data sources: User input via PromptInput
 * Output destinations: Displays messages in Conversation component
 * Dependencies: @ai-sdk/react, AI Elements components
 * Key exports: Chat component
 * Side effects: Sends messages to /api/chat endpoint
 */

import { useChat } from '@ai-sdk/react';
import { Fragment } from 'react';
import { MessageSquare } from 'lucide-react';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputProvider,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';

export default function Chat() {
  const { messages, sendMessage, status } = useChat();

  const handleSubmit = (
    message: PromptInputMessage,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _event: React.FormEvent<HTMLFormElement>
  ) => {
    if (message.text.trim()) {
      sendMessage({ text: message.text });
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto p-6 h-screen">
      <div className="flex flex-col h-full">
        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageSquare className="size-12" />}
                title="Start a conversation"
                description="Type a message below to begin chatting"
              />
            ) : (
              messages.map((message) => (
                <Fragment key={message.id}>
                  {message.parts.map((part, i) => {
                    switch (part.type) {
                      case 'text':
                        return (
                          <Message from={message.role} key={`${message.id}-${i}`}>
                            <MessageContent>
                              <MessageResponse>{part.text}</MessageResponse>
                            </MessageContent>
                          </Message>
                        );
                      default:
                        return null;
                    }
                  })}
                </Fragment>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInputProvider>
          <PromptInput
            onSubmit={handleSubmit}
            className="mt-4 w-full px-4 relative"
          >
            <PromptInputTextarea
              placeholder="Say something..."
              className="pr-12"
            />
            <PromptInputSubmit
              status={status === 'streaming' ? 'streaming' : 'ready'}
              className="absolute bottom-1 right-1"
            />
          </PromptInput>
        </PromptInputProvider>
      </div>
    </div>
  );
}