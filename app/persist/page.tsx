/**
 * Landing page for new persistent chats
 *
 * Immediately redirects to a new chat with a generated UUID.
 * This approach avoids URL changes mid-conversation that cause remounting.
 *
 * Input data sources: None
 * Output destinations: Redirects to /persist/[id]
 * Dependencies: Next.js router, crypto API
 * Key exports: Default page component
 * Side effects: Client-side navigation
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewPersistChatPage() {
  const router = useRouter();

  useEffect(() => {
    // Generate chat ID and navigate immediately
    const chatId = crypto.randomUUID();
    router.replace(`/persist/${chatId}`);
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-muted-foreground">Starting new chat...</div>
    </div>
  );
}

