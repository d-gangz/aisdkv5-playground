<!--
Document Type: Process Documentation
Purpose: Documents the architecture decisions for building AI API routes that support both production use and evaluation/testing
Context: Created during initial setup of AI SDK V5 playground to establish patterns for route handlers and eval integration
Key Topics: Route naming, function decoupling, message formats, file organization, eval architecture
Target Use: Reference guide for creating new AI API routes and setting up evals
-->

# Evals Architecture - Supporting Production and Eval Use Cases

## Overview

This document outlines the architectural decisions made to ensure AI API routes can satisfy both:
1. **Production use cases** - Streaming responses to frontend via HTTP
2. **Eval use cases** - Direct function calls for testing with production datasets

## Goal

Create a standardized format where:
- AI calls are in route handlers (for streaming to frontend)
- Core logic is decoupled and reusable
- Same function can be used for both production and evals
- Evals can run directly on functions without HTTP overhead

## Route Naming Conventions

### Next.js Route Naming

Next.js App Router supports flexible naming for route folders:

- ✅ **Kebab-case** (recommended): `simple-chat`, `tool-chat`, `streaming-demo`
- ✅ **CamelCase**: `simpleChat`, `toolChat`
- ✅ **Snake_case**: `simple_chat`, `tool_chat`

**Best Practice**: Use **kebab-case** for route folders (e.g., `tool-chat/`) as it's:
- Standard for URLs
- SEO-friendly
- Consistent with web conventions

### File and Function Naming

**Pattern**: File name matches route name, function name is camelCase

```
app/api/tool-chat/
  ├── route.ts          → HTTP handler
  └── tool-chat.ts      → File: matches route (kebab-case)
                         → Function: toolChat() (camelCase)
```

**Rules**:
- **File name**: Matches route folder name (can be kebab-case)
- **Function name**: camelCase (JavaScript identifiers can't have hyphens)

**Examples**:
- Route: `/api/chat` → File: `chat.ts` → Function: `chat()`
- Route: `/api/tool-chat` → File: `tool-chat.ts` → Function: `toolChat()`
- Route: `/api/streaming-demo` → File: `streaming-demo.ts` → Function: `streamingDemo()`

## Architecture: Decoupling Approach

### Structure

```
app/api/{route-name}/
  ├── route.ts      → HTTP handler (production)
  └── {route-name}.ts → Core function (production + evals)
```

### Why Decouple?

**Benefits**:
1. **Same function for production & evals** - Ensures identical behavior
2. **Direct testing** - Evals can call function directly (no HTTP overhead)
3. **Reusability** - Function can be imported by other routes/scripts
4. **Separation of concerns** - HTTP handling vs AI logic
5. **Faster iteration** - Easier debugging and testing

### Comparison

**Without decoupling** (everything in `route.ts`):
- ❌ Can't easily test without HTTP
- ❌ Can't reuse logic
- ❌ Harder to debug
- ❌ Tied to HTTP layer

**With decoupling** (extracted function):
- ✅ Same function for production & evals
- ✅ Direct function calls for testing
- ✅ Reusable across contexts
- ✅ Clear separation of concerns

## Message Format Considerations

### Message Format Flow

```
Frontend → UIMessage[] → convertToModelMessages() → ModelMessage[] → streamText()
```

### UIMessage vs ModelMessage

- **UIMessage**: UI-specific format (has `parts` array, etc.) - used by frontend
- **ModelMessage**: Standard format - what `streamText()`/`generateText()` expect
- **Conversion**: `convertToModelMessages()` converts UIMessage → ModelMessage

### Decision: Use ModelMessage[] in Core Function

**Why ModelMessage[] for core function?**

1. **Clean separation of concerns** - Core function represents raw AI SDK layer
2. **Framework-agnostic** - No UI-specific types in core logic
3. **More reusable** - Can be used outside Next.js/HTTP contexts
4. **Matches AI SDK expectations** - Uses what `streamText()`/`generateText()` expect directly

**Architecture Benefits**:
- Core function = pure AI SDK layer (`ModelMessage[]`)
- Route handler = HTTP/UI layer (handles `UIMessage[]` conversion)
- UI conversion stays at the HTTP boundary where it belongs

### Implementation Pattern

```typescript
// app/api/chat/chat.ts - Core function uses ModelMessage[] (raw AI SDK layer)
import { openai } from '@ai-sdk/openai';
import { streamText, generateText, ModelMessage } from 'ai';

export async function chat(options: {
  messages: ModelMessage[]; // What AI SDK expects
  stream?: boolean; // For evals: false (non-streaming), for production: true (streaming)
}) {
  const { messages, stream = true } = options;
  
  if (stream) {
    // For API routes - streaming
    return streamText({
      model: openai('gpt-4o'),
      messages, // Already in ModelMessage format
    });
  } else {
    // For evals - non-streaming, returns full result
    return generateText({
      model: openai('gpt-4o'),
      messages, // Already in ModelMessage format
    });
  }
}
```

```typescript
// app/api/chat/route.ts - HTTP handler handles UI conversion
import { chat } from './chat';
import { UIMessage, convertToModelMessages } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  
  // UI conversion happens here (HTTP/UI concern)
  const modelMessages = convertToModelMessages(messages);
  
  const result = await chat({ messages: modelMessages, stream: true });
  return result.toUIMessageStreamResponse();
}
```

## Cross-Language Eval Patterns

### TypeScript + Python Pattern (Recommended)

When you need Python for analysis but want to use the same TypeScript function as production, use a **two-phase approach**:

1. **TypeScript**: Run AI calls using the same function as production, export results to JSON
2. **Python**: Load results and perform analysis, visualization, statistics

### Why This Approach?

✅ **Same function as production** - Direct function calls, ensures identical behavior  
✅ **Python strengths** - Leverage pandas, scikit-learn, matplotlib for analysis  
✅ **Simple data exchange** - JSON/CSV between languages  
✅ **Easy to parallelize** - Run evals, then analyze separately  
✅ **Reproducible** - Results saved, can re-analyze later  

### General Pattern

- **TypeScript eval script**: Import core function, run AI calls, collect metrics (latency, tokens, outputs), export to JSON
- **Python analysis script**: Load JSON results, perform statistical analysis, create visualizations, export insights

### Alternative Approaches (Not Recommended)

**❌ HTTP API calls from Python**
- Tests via HTTP (not same as direct function calls)
- Requires server running
- Network overhead
- Less control

**❌ Node.js subprocess from Python**
- More complex setup
- Subprocess overhead
- Harder to debug

**✅ Recommended: TypeScript evals + Python analysis**
- Best of both worlds
- Clean separation of concerns
- Leverages each language's strengths

## Key Principles

1. **Co-location** - Core function lives in same folder as route handler
2. **Contextual clarity** - Easy to see which function serves which route
3. **Same code path** - Production and evals use identical function
4. **Direct imports** - Evals can import function directly (no HTTP)
5. **Clean separation** - Core function uses `ModelMessage[]` (raw AI SDK), route handler handles UI conversion
6. **Framework-agnostic core** - Core function has no UI-specific dependencies
7. **Cross-language support** - Use TypeScript for AI calls, Python for analysis

## Benefits Summary

✅ **Production**: Route handler converts UI format, calls core function, streams to frontend  
✅ **Evals**: Direct function calls with `ModelMessage[]` (convert once or use directly)  
✅ **Same function**: Identical behavior in both contexts  
✅ **No HTTP overhead**: Evals run faster without network layer  
✅ **Easy testing**: Direct function calls simplify debugging  
✅ **Reusable**: Function can be imported by other routes/scripts  
✅ **Clean architecture**: Core function = pure AI SDK layer, route handler = HTTP/UI layer  
✅ **Framework-agnostic**: Core function has no UI-specific types  

## Example: Complete Pattern

```
app/api/chat/
  ├── route.ts          → POST handler, calls chat()
  └── chat.ts           → export function chat()

app/api/tool-chat/
  ├── route.ts          → POST handler, calls toolChat()
  └── tool-chat.ts      → export function toolChat()

evals/
  └── chat-eval.ts      → import { chat } from '@/app/api/chat/chat'
```

## Notes

- **Core function** (`chat.ts`): Uses `ModelMessage[]` only - represents raw AI SDK layer
- **Route handler** (`route.ts`): Handles `UIMessage[]` → `ModelMessage[]` conversion (HTTP/UI concern)
- **Evals**: Convert `UIMessage[]` → `ModelMessage[]` once per item, or structure datasets as `ModelMessage[]`
- **Streaming**: Evals use `stream: false` for non-streaming results, production uses `stream: true`
- **Function naming**: camelCase (JavaScript requirement)
- **File naming**: Matches route name (kebab-case OK)
- **Architecture**: Clean separation - UI conversion stays at HTTP boundary, core function is pure AI logic
- **Cross-language evals**: Use TypeScript for AI calls (same function as production), Python for analysis
- **Data exchange**: Export results to JSON from TypeScript, import in Python for analysis

