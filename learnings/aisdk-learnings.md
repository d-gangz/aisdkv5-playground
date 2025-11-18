<!--
Document Type: Learning Notes
Purpose: Documents how to configure useChat hook to use custom API routes in AI SDK 5.0
Context: Created while setting up custom API routes for different chat endpoints (e.g., /api/suggestions)
Key Topics: useChat, DefaultChatTransport, custom API endpoints, transport configuration
Target Use: Reference guide for connecting useChat to custom API routes
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
    transport: new DefaultChatTransport({ api: '/api/suggestions' })
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
  api: '/api/suggestions',           // Required: API endpoint
  credentials: 'same-origin',        // Optional: Request credentials mode
  headers: {                         // Optional: Custom headers
    'X-Custom-Header': 'value'
  },
  body: {                            // Optional: Extra body data
    sessionId: '123'
  }
})
```
