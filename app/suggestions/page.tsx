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
import { DefaultChatTransport } from 'ai';
import { Fragment, useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import type { MyMessage } from '@/app/api/suggestions/route';
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
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';

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

export default function Chat() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/suggestions' }),
  });

  const handleSubmit = (
    message: PromptInputMessage,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _event: React.FormEvent<HTMLFormElement>
  ) => {
    const hasText = Boolean(message.text?.trim());
    const hasAttachments = Boolean(message.files?.length);

    if (hasText || hasAttachments) {
      sendMessage({
        text: message.text || 'Sent with attachments',
        files: message.files,
      });
    }
  };

  // Extract suggestions from the latest assistant message
  // Using MyMessage type from backend for type safety
  const suggestions: string[] = useMemo(() => {
    // Type assertion: messages from useChat should match MyMessage type
    const typedMessages = messages as MyMessage[];

    // Find the latest assistant message
    const latestAssistantMessage = [...typedMessages]
      .reverse()
      .find((msg) => msg.role === 'assistant');

    if (!latestAssistantMessage) {
      return [];
    }

    // Find the data-suggestions part
    const suggestionsPart = latestAssistantMessage.parts.find(
      (part) => part.type === 'data-suggestions'
    );

    if (!suggestionsPart || suggestionsPart.type !== 'data-suggestions') {
      return [];
    }

    // Type guard: ensure data is an array of strings
    const data = suggestionsPart.data;
    if (Array.isArray(data) && data.every((item) => typeof item === 'string')) {
      return data;
    }

    return [];
  }, [messages]);

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
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

        {suggestions.length > 0 && (
          <div className="mt-4 px-4">
            <Suggestions>
              {suggestions.map((suggestion, index) => (
                <Suggestion
                  key={index}
                  suggestion={suggestion}
                  onClick={handleSuggestionClick}
                />
              ))}
            </Suggestions>
          </div>
        )}

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
