<!--
Document Type: Learning Notes
Purpose: Documents how to configure useChat hook to use custom API routes in AI SDK 5.0, and explains message format conversion
Context: Created while setting up custom API routes for different chat endpoints (e.g., /api/suggestions)
Key Topics: useChat, DefaultChatTransport, custom API endpoints, transport configuration, UIMessage vs ModelMessage, convertToModelMessages
Target Use: Reference guide for connecting useChat to custom API routes and understanding message format transformations
-->

# AI SDK 5.0 - Using Custom API Routes with useChat

## Overview

In AI SDK 5.0, `useChat` uses a transport-based architecture. By default, it connects to `/api/chat`. To use a custom API endpoint, configure `DefaultChatTransport`.

## How to Use Custom API Routes

### Import and Configure

```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/suggestions' }),
  });

  // ... rest of component
}
```

### Complete Example

```typescript:app/suggestions/page.tsx
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Chat() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/suggestions' })
  });

  // ... rest of component
}
```

## Additional Transport Options

`DefaultChatTransport` accepts additional configuration options:

```typescript
new DefaultChatTransport({
  api: '/api/suggestions', // Required: API endpoint
  credentials: 'same-origin', // Optional: Request credentials mode
  headers: {
    // Optional: Custom headers
    'X-Custom-Header': 'value',
  },
  body: {
    // Optional: Extra body data
    sessionId: '123',
  },
});
```

---

# UI Messages vs Model Messages

## Overview

AI SDK 5.0 uses two different message formats:

- **UIMessage**: UI-specific format used by the frontend (has `parts` array, `id`, custom data types)
- **ModelMessage**: Standard format expected by AI models (simple `role` + `content` structure)

The `convertToModelMessages()` function transforms UI messages into model messages by extracting text content and removing UI-specific metadata.

## Message Format Flow

```
Frontend → UIMessage[] → convertToModelMessages() → ModelMessage[] → streamText()/generateText()
```

## Key Differences

### 1. Structure: `parts` → `content`

**UI Message (UIMessage):**

```json
{
  "id": "NCID8h0rbvoblGJX",
  "role": "user",
  "parts": [
    {
      "type": "text",
      "text": "hello how are you?"
    }
  ]
}
```

**Model Message (ModelMessage):**

```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "hello how are you?"
    }
  ]
}
```

**What changed:**

- `parts` array renamed to `content` array
- `id` field removed (UI-only identifier)

### 2. Filtered Out: Non-Text Parts

UI messages can contain multiple part types, but only `text` parts are converted to model messages.

**UI Message Example (Assistant with multiple parts):**

```json
{
  "id": "5SVWLSTCUomdQpzH",
  "role": "assistant",
  "parts": [
    {
      "type": "step-start" // ❌ Removed - UI metadata
    },
    {
      "type": "text", // ✅ Kept - Text content
      "text": "Hello! I'm here and ready to help...",
      "providerMetadata": {
        "openai": {
          "itemId": "msg_0fdadaf2..."
        }
      },
      "state": "done"
    },
    {
      "type": "data-suggestions", // ❌ Removed - Custom UI data
      "id": "3244bb82-7676-441e-88c5-c9bbf4094043",
      "data": [
        "What's the weather like today?",
        "Can you recommend a good book to read?"
        // ... more suggestions
      ]
    }
  ]
}
```

**Converted Model Message:**

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! I'm here and ready to help...",
      "providerOptions": {
        "openai": {
          "itemId": "msg_0fdadaf2..."
        }
      }
    }
  ]
}
```

**What was removed:**

- `step-start` part (UI metadata for rendering steps)
- `data-suggestions` part (custom UI data for follow-up suggestions)
- `id` field (UI-specific identifier)
- `state` field (UI rendering state)

**What was kept:**

- `text` content blocks only
- `role` field
- Provider metadata (renamed from `providerMetadata` to `providerOptions`)

### 3. Metadata Transformation

**UI Message:**

```json
{
  "parts": [
    {
      "type": "text",
      "text": "Hello!",
      "providerMetadata": {
        // ← UI format
        "openai": {
          "itemId": "msg_..."
        }
      },
      "state": "done" // ← UI rendering state
    }
  ]
}
```

**Model Message:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Hello!",
      "providerOptions": {
        // ← Renamed for model format
        "openai": {
          "itemId": "msg_..."
        }
      }
      // state field removed
    }
  ]
}
```

**Changes:**

- `providerMetadata` → `providerOptions`
- `state` field removed (UI-only)

## Real-World Example

Here's a complete conversion example from actual terminal output:

### Before Conversion (UI Message)

```json
{
  "id": "DFgJral0s9EDeBAW",
  "role": "assistant",
  "parts": [
    {
      "type": "step-start"
    },
    {
      "type": "text",
      "text": "I can't provide real-time weather updates. However, you can check a reliable weather website or use a weather app for the latest information.",
      "providerMetadata": {
        "openai": {
          "itemId": "msg_0fdadaf2b76b2c5400691c30e7b18081979b1dfe0ab4a858ae"
        }
      },
      "state": "done"
    },
    {
      "type": "data-suggestions",
      "id": "f56dea29-071e-4bc8-aa54-d5be9387198b",
      "data": [
        "What's the latest news today?",
        "Can you recommend a book for me to read?",
        "How do I improve my productivity?"
      ]
    }
  ]
}
```

### After Conversion (Model Message)

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "I can't provide real-time weather updates. However, you can check a reliable weather website or use a weather app for the latest information.",
      "providerOptions": {
        "openai": {
          "itemId": "msg_0fdadaf2b76b2c5400691c30e7b18081979b1dfe0ab4a858ae"
        }
      }
    }
  ]
}
```

## Usage in API Routes

```typescript
import { convertToModelMessages, type UIMessage, type ModelMessage } from 'ai';

export async function POST(req: Request) {
  // Frontend sends UIMessage[] format
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Convert to ModelMessage[] for AI SDK functions
  const modelMessages: ModelMessage[] = convertToModelMessages(messages);

  // Now you can use modelMessages with streamText() or generateText()
  const result = await streamText({
    model: openai('gpt-4o'),
    messages: modelMessages, // ✅ Expects ModelMessage[]
  });

  return result.toUIMessageStreamResponse();
}
```

## Summary

| Aspect         | UI Message (UIMessage)                                 | Model Message (ModelMessage)           |
| -------------- | ------------------------------------------------------ | -------------------------------------- |
| **Structure**  | `parts` array                                          | `content` array                        |
| **ID Field**   | ✅ Has `id`                                            | ❌ No `id`                             |
| **Part Types** | `text`, `step-start`, `data-suggestions`, custom types | Only `text` content blocks             |
| **Metadata**   | `providerMetadata`, `state`                            | `providerOptions` (renamed)            |
| **Purpose**    | UI rendering, custom data                              | Model API calls                        |
| **Used By**    | Frontend (`useChat` hook)                              | Backend (`streamText`, `generateText`) |

**Key Takeaway:** `convertToModelMessages()` extracts only the text content needed by AI models, stripping away all UI-specific metadata and custom data types.

## Important Note: Custom Data Parts

**Custom data parts (e.g., `data-suggestions`) are automatically stripped** when converting `UIMessage[]` → `ModelMessage[]`. This is correct for UI-only data.

**If you need custom data parts to influence the model** (e.g., include previous suggestions in the prompt, or store them in conversation history), you'll need to:

1. **Extract custom parts before conversion:**

   ```typescript
   const customParts = messages.flatMap(
     (msg) => msg.parts?.filter((p) => p.type === 'data-suggestions') || []
   );
   ```

2. **Transform or include them in model messages:**

   ```typescript
   const modelMessages = convertToModelMessages(messages);
   // Add custom context to model messages if needed
   const enhancedMessages = addCustomContext(modelMessages, customParts);
   ```

3. **Or preserve them separately** for storage/processing outside the model call.

**Default behavior:** Custom parts persist on the frontend and are added back in responses via `writer.write()`, but they don't reach the model unless explicitly transformed.
