<!--
Document Type: Process Documentation
Purpose: Frontend implementation guide for chat message persistence with Vercel AI SDK
Context: Created to guide junior engineers through client-side chat integration
Key Topics: useChat hook, DefaultChatTransport, message rendering, client-side tools, UI components
Target Use: Follow sequentially after completing persistence.md (backend). Check off completed steps, reference code examples.
-->

# Frontend Message Persistence Implementation Plan

This document provides a step-by-step guide for implementing the **frontend** components of chat message persistence using Vercel AI SDK with React. This covers React components, the `useChat` hook, message rendering, client-side tool handling, and UI patterns.

> **📘 Prerequisites:** Complete the backend implementation in [`persistence.md`](./persistence.md) first. This document assumes the backend API route (`/api/chat`) is working and messages are being persisted to the database.

Follow each section sequentially and check off completed steps.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setting Up useChat Hook](#setting-up-usechat-hook)
4. [DefaultChatTransport Configuration](#defaultchattransport-configuration)
5. [Rendering Message Parts](#rendering-message-parts)
6. [Custom Data Part Components](#custom-data-part-components)
7. [Client-Side Tool Handling](#client-side-tool-handling)
8. [Message Deletion UI](#message-deletion-ui)
9. [Performance Optimizations](#performance-optimizations)
10. [Complete Chat Component](#complete-chat-component)
11. [Testing & Validation](#testing--validation)
12. [Troubleshooting](#troubleshooting)

---

## Overview

### What We're Building

A complete chat UI that:

- Connects to the backend API route (`/api/chat`)
- Streams AI responses in real-time
- Renders all message part types (text, reasoning, tools, data parts, sources)
- Handles client-side tools (like `getLocation`)
- Supports message deletion
- Optimizes rendering performance

### Architecture Overview

```
┌─────────────────┐
│  Chat Component │
│   (chat.tsx)     │
└────────┬────────┘
         │
         │ useChat Hook
         ▼
┌─────────────────┐
│ DefaultChat     │
│ Transport       │
└────────┬────────┘
         │
         │ HTTP POST
         │ (only last message)
         ▼
┌─────────────────┐
│  /api/chat      │
│  (Backend)      │
└─────────────────┘
```

**Key Concept:** The frontend only sends the **last message** to the API. The backend loads the full conversation history from the database, ensuring consistency and reducing payload size.

---

## Prerequisites

Before starting, ensure you have:

- [ ] Completed backend implementation (`persistence.md`)
- [ ] Backend API route working (`/api/chat`)
- [ ] React and Next.js installed
- [ ] `@ai-sdk/react` package installed
- [ ] Basic understanding of:
  - React hooks (`useState`, `useEffect`, `useRef`)
  - Next.js App Router
  - TypeScript
  - Tailwind CSS (for styling)

**Estimated Time:** 2-3 hours

---

## Setting Up useChat Hook

### Step 1: Install Dependencies

Ensure these packages are installed:

```bash
pnpm add @ai-sdk/react ai
pnpm add react-markdown marked
```

### Step 2: Basic useChat Setup

Create `app/chat/[id]/chat.tsx`:

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { MyUIMessage } from '@/lib/message-type';

export default function Chat({
  id,
  initialMessages,
}: {
  id?: string;
  initialMessages?: MyUIMessage[];
}) {
  const { messages, sendMessage, status } = useChat<MyUIMessage>({
    id, // Chat ID for persistence
    messages: initialMessages, // Loaded from database
  });

  return <div>{/* Chat UI will go here */}</div>;
}
```

**Key Points:**

- `"use client"` directive is required (React hooks)
- `useChat` is typed with `MyUIMessage` for type safety
- `id` links the chat to the database
- `initialMessages` are loaded server-side (see Step 3)

### Step 3: Load Initial Messages Server-Side

Create `app/chat/[id]/page.tsx`:

```typescript
import { loadChat } from '@/lib/db/actions';
import Chat from './chat';

export default async function ChatPage({ params }: { params: { id: string } }) {
  const messages = await loadChat(params.id);

  return <Chat id={params.id} initialMessages={messages} />;
}
```

**Key Points:**

- Server component loads messages from database
- Passes messages as props to client component
- Ensures messages are available on initial render

**Checkpoint:** ✅ Basic useChat hook set up

---

## DefaultChatTransport Configuration

### Step 1: Why DefaultChatTransport?

By default, `useChat` sends **all messages** to the API on each request. However, we customize this to send only the **last message** for several important reasons:

#### 1. **Single Source of Truth (Database)**

The database is the authoritative source of truth for conversation history. If we send all messages from frontend memory:

- **Risk of inconsistency**: Frontend state might be out of sync with database
- **Partial failures**: If a previous message failed to persist, sending from memory would include it
- **Multi-device issues**: Another session might have updated the conversation
- **Reliability**: Backend always loads the complete, persisted history

#### 2. **Payload Size Optimization**

- **Long conversations**: Sending 50+ messages creates large HTTP requests
- **Network efficiency**: Only sending the new message reduces bandwidth
- **Faster requests**: Smaller payloads mean faster API calls

#### 3. **Consistency Guarantee**

When the backend loads messages from the database:

- It gets the **exact** conversation state that was persisted
- No risk of frontend state corruption affecting the conversation
- Ensures the AI model receives the correct, complete history

#### 4. **Architecture Pattern**

This follows a common pattern:

- **Frontend**: UI state (for rendering)
- **Backend**: Persistent state (for processing)
- **API**: Bridge between them (loads from database, not frontend)

**Solution:** Use `DefaultChatTransport` to customize the request payload to send only the last message.

### Step 2: Configure Transport

Update `chat.tsx`:

```typescript
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';

export default function Chat({
  id,
  initialMessages,
}: {
  id?: string;
  initialMessages?: MyUIMessage[];
}) {
  const { messages, sendMessage, status } = useChat<MyUIMessage>({
    id,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages }) => {
        // Send only the last message and chat ID
        // Backend will load full history from database
        const lastMessage = messages[messages.length - 1];
        return {
          body: {
            message: lastMessage,
            chatId: id,
          },
        };
      },
    }),
  });

  // ... rest of component
}
```

**Key Points:**

- `prepareSendMessagesRequest` customizes the request body
- Only the last message is sent (the new user message)
- `chatId` tells the backend which chat to load history for
- Backend loads full history and appends the new message

### Step 3: How It Works

**Flow:**

1. User sends message → Frontend sends only last message
2. Backend receives request → Loads full chat history from database
3. Backend appends new message → Sends to AI model
4. Backend streams response → Frontend receives stream
5. Backend persists response → Saves to database

**Why Not Send All Messages from Memory?**

Even though `messages` in React state contains the full conversation history, we don't send it because:

```typescript
// Frontend has this in memory:
const { messages } = useChat();
// messages = [msg1, msg2, msg3, ..., msg50] // Full history

// But we only send:
const lastMessage = messages[messages.length - 1];
// lastMessage = msg50 // Just the new one
```

**Reasoning:**

- **Frontend state is for UI only**: It's optimized for rendering, not for being the source of truth
- **Database is authoritative**: The backend loads from database, ensuring it has the complete, persisted history
- **Prevents inconsistencies**: If frontend state is corrupted or incomplete, backend still works correctly
- **Handles edge cases**: If a previous message failed to persist, sending from memory would include it incorrectly

**Benefits:**

- Smaller request payloads
- Single source of truth (database)
- Consistent conversation history
- Better performance
- More reliable (database is always correct)

**Checkpoint:** ✅ Transport configured to send only last message

---

## Rendering Message Parts

### Step 1: Message Structure

Messages contain multiple "parts" that need different rendering:

```typescript
{
  id: "msg-123",
  role: "assistant",
  parts: [
    { type: "text", text: "Hello!" },
    { type: "reasoning", text: "Thinking..." },
    { type: "tool-getWeatherInformation", ... },
    { type: "data-weather", ... },
    { type: "source-url", ... },
  ]
}
```

### Step 2: Create Part Renderer

Add a function to render parts based on type:

```typescript
import { MyUIMessage } from '@/lib/message-type';
import { getToolName } from 'ai';
import { MemoizedMarkdown } from './memoized-markdown';
import { Weather } from './weather';

function renderPart(
  part: MyUIMessage['parts'][0],
  messageId: string,
  index: number
) {
  switch (part.type) {
    case 'text':
      return (
        <div
          key={`${messageId}-part-${index}`}
          className="prose dark:text-zinc-300"
        >
          <MemoizedMarkdown id={messageId} content={part.text} />
        </div>
      );

    case 'reasoning':
      return (
        <div key={`${messageId}-part-${index}`} className="text-zinc-400">
          <label>Reasoning:</label>
          <MemoizedMarkdown id={messageId} content={part.text} />
        </div>
      );

    case 'data-weather':
      return <Weather key={`${messageId}-part-${index}`} data={part.data} />;

    case 'tool-getWeatherInformation':
      return (
        <details
          key={`tool-${part.toolCallId}`}
          className="relative p-2 rounded-lg bg-zinc-100 group"
        >
          <summary className="list-none cursor-pointer select-none flex justify-between items-center pr-2">
            <span className="inline-flex items-center px-1 py-0.5 text-xs font-medium rounded-md font-mono text-zinc-900">
              {getToolName(part)}
            </span>
            {part.state === 'output-available' ? (
              <span className="text-xs text-zinc-500 ml-2">
                Click to expand
              </span>
            ) : (
              <span className="text-xs text-zinc-400 animate-pulse">
                calling...
              </span>
            )}
          </summary>
          {part.state === 'output-available' ? (
            <div className="mt-4 bg-zinc-50 p-2">
              <pre className="font-mono text-xs">
                {JSON.stringify(part.output, null, 2)}
              </pre>
            </div>
          ) : null}
        </details>
      );

    case 'source-url':
      return (
        <div
          key={`${messageId}-part-${index}`}
          className="bg-blue-50 p-2 rounded border-l-4 border-blue-400"
        >
          <span className="text-xs text-blue-600 font-medium">Source URL:</span>
          <a
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-blue-600 hover:text-blue-800 underline text-sm mt-1"
          >
            {part.url}
          </a>
        </div>
      );

    case 'source-document':
      return (
        <div
          key={`${messageId}-part-${index}`}
          className="bg-blue-50 p-2 rounded border-l-4 border-blue-400"
        >
          <span className="text-xs text-blue-600 font-medium">
            Source Document:
          </span>
          <div className="text-sm mt-1 text-blue-800">
            {part.title || 'Document'}
          </div>
        </div>
      );

    default:
      return null;
  }
}
```

### Step 3: Render Messages

In your component:

```typescript
<div className="space-y-8">
  {messages.map((m) => (
    <div key={m.id} className="whitespace-pre-wrap">
      <span className="font-semibold text-sm">
        {m.role === 'user' ? 'User: ' : 'AI: '}
      </span>
      <div className="space-y-4">
        {m.parts.map((part, i) => renderPart(part, m.id, i))}
      </div>
    </div>
  ))}
</div>
```

**Key Points:**

- Each part type has its own rendering logic
- Use `getToolName()` from AI SDK for tool names
- Handle loading states (e.g., `part.state === "output-available"`)
- Style consistently with your design system

**Checkpoint:** ✅ Message parts rendering implemented

---

## Custom Data Part Components

### Step 1: Weather Component

Create `app/chat/[id]/weather.tsx`:

```typescript
import { MyDataPart } from '@/lib/message-type';

const getWeatherStyles = (weather: string | undefined) => {
  if (!weather) return 'from-gray-400 to-gray-600';

  switch (weather.toLowerCase()) {
    case 'sunny':
      return 'from-yellow-400 to-orange-500';
    case 'cloudy':
      return 'from-gray-400 to-gray-600';
    case 'rainy':
      return 'from-blue-600 to-indigo-700';
    case 'snowy':
      return 'from-blue-200 to-blue-400';
    case 'windy':
      return 'from-teal-400 to-cyan-600';
    default:
      return 'from-blue-400 to-blue-600';
  }
};

const getWeatherEmoji = (weather: string | undefined) => {
  if (!weather) return '⏳';
  // ... emoji mapping
};

const getTextColors = (weather: string | undefined) => {
  // ... color mapping based on weather
};

export const Weather = ({ data }: { data: MyDataPart['weather'] }) => {
  const weatherStyle = getWeatherStyles(data.weather);
  const weatherEmoji = getWeatherEmoji(data.weather);
  const textColors = getTextColors(data.weather);
  const isLoading = data.loading;

  return (
    <div
      className={`bg-gradient-to-br ${weatherStyle} rounded-2xl p-6 shadow-lg w-full transition-all duration-500 ease-in-out ${
        isLoading ? 'animate-pulse' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${textColors.primary}`}>
            {data.location !== undefined ? data.location : 'Loading...'}
          </h3>
          <p className={`text-sm capitalize ${textColors.secondary}`}>
            {data.weather !== undefined ? data.weather : 'Loading...'}
          </p>
        </div>
        <div className="text-right flex items-center gap-3">
          <div className="text-2xl">{weatherEmoji}</div>
          <div className={`text-3xl font-light ${textColors.primary}`}>
            {data.temperature !== undefined ? `${data.temperature}°` : '...'}
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Key Points:**

- Component receives `data` prop matching `MyDataPart["weather"]`
- Handles loading states with conditional rendering
- Progressive updates as data arrives (location → weather → temperature)
- Uses Tailwind classes for styling

### Step 2: Progressive Updates

The Weather component automatically updates as the backend writes new data parts:

1. **Initial state:** `{ location: "London", loading: true }`
2. **Weather added:** `{ weather: "sunny", loading: true }`
3. **Temperature added:** `{ temperature: 25, loading: false }`

Each update triggers a re-render with new data.

**Checkpoint:** ✅ Custom data part component created

---

## Client-Side Tool Handling

### Step 1: Understanding Client-Side Tools

Client-side tools (like `getLocation`) don't have an `execute` function on the server. Instead:

1. AI requests the tool
2. Frontend receives tool call
3. Frontend executes the tool (e.g., browser geolocation API)
4. Frontend sends result back using `addToolResult()`

### Step 2: Access addToolResult

Update `useChat` to include `addToolResult`:

```typescript
const {
  messages,
  sendMessage,
  status,
  addToolResult, // Add this
} = useChat<MyUIMessage>({
  // ... config
});
```

### Step 3: Render Client-Side Tool

Add rendering for `tool-getLocation`:

```typescript
case "tool-getLocation":
  return (
    <div key={part.toolCallId}>
      {part.state === "output-available" ? (
        // Tool completed - show result
        <div className="font-mono text-sm bg-zinc-200 dark:bg-zinc-800 w-fit px-1 rounded-sm">
          Result: {part.output.location}
        </div>
      ) : (
        // Tool pending - show button to execute
        <button
          onClick={() =>
            addToolResult({
              toolCallId: part.toolCallId,
              output: { location: "London" }, // Or use actual geolocation API
            })
          }
        >
          Get location
        </button>
      )}
    </div>
  );
```

### Step 4: Real Geolocation Example

For actual geolocation:

```typescript
<button
  onClick={async () => {
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        }
      );

      const location = `${position.coords.latitude},${position.coords.longitude}`;

      addToolResult({
        toolCallId: part.toolCallId,
        output: { location },
      });
    } catch (error) {
      console.error('Geolocation error:', error);
    }
  }}
>
  Get location
</button>
```

**Key Points:**

- Check `part.state` to determine if tool is pending or completed
- Call `addToolResult()` with the tool result
- Result is sent to backend and persisted
- AI receives the result and continues processing

**Checkpoint:** ✅ Client-side tool handling implemented

---

## Message Deletion UI

### Step 1: Import Delete Action

```typescript
import { deleteMessage } from '@/lib/db/actions';
```

### Step 2: Add Delete Button

Add delete button for user messages:

```typescript
{
  m.role === 'user' && (
    <div className="flex space-x-2 mt-2">
      <button
        onClick={async () => {
          if (
            confirm(
              'Are you sure you want to proceed? This will delete all subsequent messages.'
            )
          ) {
            try {
              await deleteMessage(m.id);
              // Find the index of the current message
              const messageIndex = messages.findIndex((msg) => msg.id === m.id);
              // Remove this message and all subsequent ones
              setMessages((prev) => prev.slice(0, messageIndex));
            } catch (error) {
              console.error('Error deleting message:', error);
            }
          }
        }}
        className="text-xs text-red-500 hover:text-red-700 disabled:cursor-not-allowed"
        disabled={status === 'streaming' || status === 'submitted'}
      >
        Delete
      </button>
    </div>
  );
}
```

### Step 3: How It Works

**Flow:**

1. User clicks "Delete" → Confirmation dialog
2. Frontend calls `deleteMessage(m.id)` → Server action
3. Backend deletes message and all subsequent messages
4. Frontend updates local state → Removes messages from UI

**Key Points:**

- Disable button during streaming/submission
- Show confirmation dialog
- Update local state after deletion
- Backend handles cascade deletion

**Checkpoint:** ✅ Message deletion UI implemented

---

## Performance Optimizations

### Step 1: Memoized Markdown Component

Create `app/chat/[id]/memoized-markdown.tsx`:

```typescript
import { marked } from 'marked';
import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => {
    return <ReactMarkdown>{content}</ReactMarkdown>;
  },
  (prevProps, nextProps) => {
    if (prevProps.content !== nextProps.content) return false;
    return true;
  }
);

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    return blocks.map((block, index) => (
      <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />
    ));
  }
);

MemoizedMarkdown.displayName = 'MemoizedMarkdown';
```

**Why This Matters:**

- Markdown parsing is expensive
- Streaming updates cause frequent re-renders
- Block-level memoization prevents unnecessary parsing
- Only re-renders blocks that actually changed

### Step 2: Input Focus Management

```typescript
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (status === 'ready') {
    inputRef?.current?.focus();
  }
}, [status]);
```

**Key Points:**

- Focus input when chat is ready
- Improves UX for continuous conversation

**Checkpoint:** ✅ Performance optimizations implemented

---

## Complete Chat Component

### Step 1: Full Component Structure

Here's the complete `chat.tsx` component:

```typescript
'use client';

import { deleteChat, deleteMessage } from '@/lib/db/actions';
import { DefaultChatTransport, getToolName } from 'ai';
import { useChat } from '@ai-sdk/react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MemoizedMarkdown } from './memoized-markdown';
import { useEffect, useRef, useState } from 'react';
import { MyUIMessage } from '@/lib/message-type';
import { Weather } from './weather';

export default function Chat({
  id,
  initialMessages,
}: { id?: string | undefined; initialMessages?: MyUIMessage[] } = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');

  const { status, messages, setMessages, sendMessage, addToolResult } =
    useChat<MyUIMessage>({
      id,
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages }) => {
          const lastMessage = messages[messages.length - 1];
          return {
            body: {
              message: lastMessage,
              chatId: id,
            },
          };
        },
      }),
    });

  useEffect(() => {
    if (status === 'ready') {
      inputRef?.current?.focus();
    }
  }, [status]);

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <div className="">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          Back
        </Link>
        <button
          onClick={async () => {
            if (id) {
              await deleteChat(id);
              redirect('/');
            }
          }}
          className="text-red-600 hover:text-red-800 ml-4"
        >
          Delete Chat
        </button>
      </div>

      <div className="space-y-8">
        {messages.map((m) => (
          <div key={m.id} className="whitespace-pre-wrap">
            <span className="font-semibold text-sm">
              {m.role === 'user' ? 'User: ' : 'AI: '}
            </span>
            <div className="space-y-4">
              {m.parts.map((part, i) => {
                switch (part.type) {
                  case 'reasoning':
                    return (
                      <div key={m.id + '-part-' + i} className="text-zinc-400">
                        <label>Reasoning:</label>
                        <MemoizedMarkdown id={m.id} content={part.text} />
                      </div>
                    );
                  case 'text':
                    return (
                      <div
                        key={m.id + '-part-' + i}
                        className="prose dark:text-zinc-300"
                      >
                        <MemoizedMarkdown id={m.id} content={part.text} />
                      </div>
                    );
                  case 'data-weather':
                    return (
                      <Weather key={m.id + '-part-' + i} data={part.data} />
                    );
                  case 'tool-getWeatherInformation':
                    return (
                      <details
                        key={`tool-${part.toolCallId}`}
                        className="relative p-2 rounded-lg bg-zinc-100 group"
                      >
                        <summary className="list-none cursor-pointer select-none flex justify-between items-center pr-2">
                          <span className="inline-flex items-center px-1 py-0.5 text-xs font-medium rounded-md font-mono text-zinc-900">
                            {getToolName(part)}
                          </span>
                          {part.state === 'output-available' ? (
                            <span className="text-xs text-zinc-500 ml-2">
                              Click to expand
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400 animate-pulse">
                              calling...
                            </span>
                          )}
                        </summary>
                        {part.state === 'output-available' ? (
                          <div className="mt-4 bg-zinc-50 p-2">
                            <pre className="font-mono text-xs">
                              {JSON.stringify(part.output, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                      </details>
                    );
                  case 'tool-getLocation':
                    return (
                      <div key={part.toolCallId}>
                        {part.state === 'output-available' ? (
                          <div className="font-mono text-sm bg-zinc-200 dark:bg-zinc-800 w-fit px-1 rounded-sm">
                            Result: {part.output.location}
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              addToolResult({
                                toolCallId: part.toolCallId,
                                output: { location: 'London' },
                              })
                            }
                          >
                            Get location
                          </button>
                        )}
                      </div>
                    );
                  case 'source-url':
                    return (
                      <div
                        key={m.id + '-part-' + i}
                        className="bg-blue-50 p-2 rounded border-l-4 border-blue-400"
                      >
                        <span className="text-xs text-blue-600 font-medium">
                          Source URL:
                        </span>
                        <a
                          href={part.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-600 hover:text-blue-800 underline text-sm mt-1"
                        >
                          {part.url}
                        </a>
                      </div>
                    );
                  case 'source-document':
                    return (
                      <div
                        key={m.id + '-part-' + i}
                        className="bg-blue-50 p-2 rounded border-l-4 border-blue-400"
                      >
                        <span className="text-xs text-blue-600 font-medium">
                          Source Document:
                        </span>
                        <div className="text-sm mt-1 text-blue-800">
                          {part.title || 'Document'}
                        </div>
                      </div>
                    );
                  default:
                    return null;
                }
              })}
            </div>
            {m.role === 'user' && (
              <div className="flex space-x-2 mt-2">
                <button
                  onClick={async () => {
                    if (
                      confirm(
                        'Are you sure you want to proceed? This will delete all subsequent messages.'
                      )
                    ) {
                      try {
                        await deleteMessage(m.id);
                        const messageIndex = messages.findIndex(
                          (msg) => msg.id === m.id
                        );
                        setMessages((prev) => prev.slice(0, messageIndex));
                      } catch (error) {
                        console.error('Error deleting chat:', error);
                      }
                    }
                  }}
                  className="text-xs text-red-500 hover:text-red-700 disabled:cursor-not-allowed"
                  disabled={status === 'streaming' || status === 'submitted'}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ parts: [{ text: input, type: 'text' }] });
            setInput('');
          }
        }}
      >
        <input
          ref={inputRef}
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 dark:border-zinc-800 dark:bg-zinc-900 rounded shadow-xl"
          value={input}
          placeholder="Say something..."
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== 'ready'}
        />
      </form>
    </div>
  );
}
```

**Checkpoint:** ✅ Complete chat component implemented

---

## Testing & Validation

### Step 1: Test Basic Chat Flow

1. **Create a new chat**

   - Navigate to `/chat/[new-id]`
   - Verify empty state

2. **Send a message**

   - Type message and submit
   - Verify message appears immediately
   - Verify AI response streams in

3. **Reload page**
   - Refresh browser
   - Verify messages persist and load correctly

### Step 2: Test Message Parts

1. **Text parts**

   - Send message with markdown
   - Verify rendering

2. **Reasoning parts**

   - Trigger reasoning (if enabled)
   - Verify styled rendering

3. **Tool calls**

   - Trigger weather tool
   - Verify tool UI appears
   - Verify progressive updates

4. **Data parts**
   - Trigger weather data part
   - Verify Weather component renders
   - Verify loading states

### Step 3: Test Client-Side Tools

1. **Trigger getLocation**
   - AI requests location
   - Verify button appears
   - Click button
   - Verify result appears
   - Verify AI continues with result

### Step 4: Test Message Deletion

1. **Delete user message**
   - Click delete button
   - Confirm deletion
   - Verify message and subsequent messages removed
   - Verify database updated

### Step 5: Test Edge Cases

1. **Streaming interruption**

   - Send message
   - Refresh during streaming
   - Verify partial message persisted

2. **Long conversations**
   - Send many messages
   - Verify performance
   - Verify all messages load

**Checkpoint:** ✅ All tests passing

---

## Troubleshooting

### Common Issues

#### Issue: Messages not streaming

**Symptoms:** Messages appear but don't stream in real-time

**Solutions:**

1. Check API route is returning stream
2. Verify `createUIMessageStreamResponse` is used
3. Check browser console for errors
4. Verify transport configuration

#### Issue: Only last message sent, but backend doesn't load history

**Symptoms:** AI doesn't have context from previous messages

**Why This Happens:**
The frontend intentionally only sends the last message. The backend **must** load the full history from the database. If it doesn't, the AI won't have context.

**Solutions:**

1. Verify `loadChat(chatId)` is called in API route before `streamText()`
2. Check `chatId` is being passed correctly in the request body
3. Verify database has messages (check Supabase dashboard)
4. Check server logs for errors in `loadChat()` function
5. Verify the API route looks like this:
   ```typescript
   const { message, chatId } = await req.json();
   await upsertMessage({ chatId, id: message.id, message });
   const messages = await loadChat(chatId); // ← This is critical!
   ```

#### Issue: Client-side tool not working

**Symptoms:** Tool button appears but nothing happens

**Solutions:**

1. Verify `addToolResult` is imported from `useChat`
2. Check `toolCallId` matches
3. Verify `output` matches `outputSchema`
4. Check browser console for errors

#### Issue: Performance issues with long messages

**Symptoms:** UI lags during streaming

**Solutions:**

1. Verify `MemoizedMarkdown` is used
2. Check block-level memoization is working
3. Consider pagination for very long conversations
4. Profile React DevTools for re-renders

#### Issue: Weather component not updating

**Symptoms:** Weather shows loading state but never updates

**Solutions:**

1. Verify backend is writing progressive updates
2. Check `id` matches between updates
3. Verify `data` prop structure matches schema
4. Check React DevTools for prop updates

### Debugging Tips

1. **Enable React DevTools:**

   - Install React DevTools browser extension
   - Inspect component props and state
   - Profile re-renders

2. **Check Network Tab:**

   - Verify API requests
   - Check request/response payloads
   - Monitor streaming responses

3. **Add Console Logs:**

```typescript
useEffect(() => {
  console.log('Messages updated:', messages);
}, [messages]);
```

4. **Check Server Logs:**
   - Monitor API route logs
   - Check for database errors
   - Verify persistence is working

### Getting Help

If you're stuck:

1. Check AI SDK documentation: [sdk.vercel.ai](https://sdk.vercel.ai)
2. Review React hooks documentation
3. Check backend implementation (`persistence.md`)
4. Review error messages carefully

---

## Summary

### What We Built

✅ **Chat UI Component**

- `useChat` hook integration
- `DefaultChatTransport` configuration
- Message rendering for all part types

✅ **Custom Components**

- Weather data part component
- Memoized markdown renderer
- Tool call UI components

✅ **Client-Side Features**

- Client-side tool handling
- Message deletion UI
- Input focus management

✅ **Performance**

- Block-level markdown memoization
- Optimized re-renders
- Efficient streaming updates

### Key Takeaways

1. **Transport Configuration** - Only send last message, backend loads history
2. **Part Rendering** - Switch statement handles all part types
3. **Client-Side Tools** - Use `addToolResult()` for browser APIs
4. **Progressive Updates** - Components update as data streams in
5. **Performance** - Memoization prevents unnecessary re-renders

### Next Steps

After implementing frontend, you might want to:

- Add message editing functionality
- Implement message search
- Add file upload support
- Create custom data part components
- Add keyboard shortcuts
- Implement message reactions

---

## Unresolved Questions

- Should we add message editing UI?
- Do we need message search/filtering?
- Should we add file upload UI?
- Do we need keyboard shortcuts?
- Should we add message reactions/feedback?
