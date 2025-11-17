## Rules
1. Use bun instead of npm

## API Route Decoupling

**Structure**: Decouple core functions from route handlers for production + evals reuse for the AI.

```
app/api/{route-name}/
  ├── route.ts          → HTTP handler (converts UIMessage[] → ModelMessage[])
  └── {route-name}.ts   → Core function (uses ModelMessage[], reusable)
```

**Rules**:
- Core function uses `ModelMessage[]` (not `UIMessage[]`) - pure AI SDK layer
- Route handler handles `UIMessage[]` → `ModelMessage[]` conversion at HTTP boundary
- Function name: camelCase (e.g., `toolChat()`)
- File name: matches route name (kebab-case OK, e.g., `tool-chat.ts`)