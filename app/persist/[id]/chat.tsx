'use client';

/**
 * Client component for persistent chat with custom transport
 *
 * Chat ID is provided by parent component (generated at /persist landing page).
 * Uses existing AI Elements components with database persistence.
 * Custom transport sends only last message to API, backend loads full history.
 *
 * Input data sources: Initial messages from server, user input via form
 * Output destinations: API route at /api/persist, displays in UI
 * Dependencies: @ai-sdk/react, AI Elements components
 * Key exports: PersistChat component
 * Side effects: Sends messages to API, updates UI
 */

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { Fragment, startTransition } from 'react';
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
  PromptInputHeader,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input';
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';

function ConditionalHeader() {
  const attachments = usePromptInputAttachments();

  if (!attachments.files.length) {
    return null;
  }

  return (
    <PromptInputHeader>
      <PromptInputAttachments>
        {(attachment) => <PromptInputAttachment data={attachment} />}
      </PromptInputAttachments>
    </PromptInputHeader>
  );
}

interface PersistChatProps {
  id: string;
  initialMessages?: UIMessage[];
}

export default function PersistChat({ id, initialMessages }: PersistChatProps) {
  // Chat ID is always the id param now (no 'new' route handling needed)
  const chatId = id;

  const { messages, sendMessage, status } = useChat<UIMessage>({
    id: chatId, // Chat ID for tracking
    messages: initialMessages, // Pre-loaded from database
    transport: new DefaultChatTransport({
      api: '/api/persist',
      prepareSendMessagesRequest: ({ messages }) => {
        // Only send the last message - backend loads full history from DB
        const lastMessage = messages[messages.length - 1];
        return {
          body: {
            message: lastMessage,
            chatId: chatId,
          },
        };
      },
    }),
  });

  const handleSubmit = (
    message: PromptInputMessage,
    _event: React.FormEvent<HTMLFormElement>
  ) => {
    void _event;

    const hasText = Boolean(message.text?.trim());
    const hasAttachments = Boolean(message.files?.length);

    if (hasText || hasAttachments) {
      startTransition(() => {
        sendMessage({
          text: message.text || 'Sent with attachments',
          files: message.files,
        });
      });
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
                          <Message
                            from={message.role}
                            key={`${message.id}-${i}`}
                          >
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
            className="mt-4 w-full px-4"
            multiple
          >
            <ConditionalHeader />
            <PromptInputBody>
              <PromptInputTextarea placeholder="Say something..." />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
              </PromptInputTools>
              <PromptInputSubmit
                status={status === 'streaming' ? 'streaming' : 'ready'}
              />
            </PromptInputFooter>
          </PromptInput>
        </PromptInputProvider>
      </div>
    </div>
  );
}
