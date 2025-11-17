# AI SDK V5 Playground

A playground project for learning and experimenting with [AI SDK V5](https://ai-sdk.dev/) by Vercel. This project serves as a sandbox to familiarize myself with the AI SDK's features, patterns, and best practices.

## About AI SDK V5

The AI SDK is a TypeScript toolkit designed to help developers build AI-powered applications and agents with React, Next.js, Vue, Svelte, Node.js, and more. It provides:

- **AI SDK Core:** A unified API for generating text, structured objects, tool calls, and building agents with LLMs
- **AI SDK UI:** Framework-agnostic hooks for quickly building chat and generative user interfaces

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **AI SDK:** [AI SDK V5](https://ai-sdk.dev/) (`ai@^5.0.93`)
- **React:** React 19
- **Styling:** Tailwind CSS v4
- **UI Components:** shadcn/ui (via `components.json`)
- **Package Manager:** Bun

## Getting Started

First, install dependencies:

```bash
bun install
```

Then, run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learning Resources

### Official Documentation

- [AI SDK Documentation](https://ai-sdk.dev/docs/introduction) - Complete guide to AI SDK V5
- [AI SDK Cookbook](https://ai-sdk.dev/cookbook) - Recipes and examples
- [AI SDK Providers](https://ai-sdk.dev/providers) - Supported model providers

### Key Concepts to Explore

- **Text Generation** - Using `generateText()` and `streamText()`
- **Structured Outputs** - Generating structured data with Zod schemas
- **Tool Calling** - Building AI agents with function calling
- **Chat Interfaces** - Using `useChat()` hook for conversational UIs
- **Streaming** - Real-time streaming responses
- **Agents** - Building multi-step AI agents
- **Model Providers** - Working with OpenAI, Anthropic, Google, and more

## Project Structure

```
aisdkv5-playground/
├── app/              # Next.js App Router pages
├── lib/              # Utility functions and helpers
├── components/       # React components (if using shadcn/ui)
└── public/           # Static assets
```

## Documentation Reference

For the complete AI SDK documentation in Markdown format, visit [ai-sdk.dev/llms.txt](https://ai-sdk.dev/llms.txt) - useful for LLM-assisted development with Cursor, Windsurf, Copilot, or Claude.
