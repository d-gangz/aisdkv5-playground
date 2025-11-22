/**
 * Server component that loads chat messages from database
 *
 * Input data sources: Chat ID from URL params, database via loadChat
 * Output destinations: Passes messages to client component
 * Dependencies: loadChat action
 * Key exports: Default page component
 * Side effects: Database read
 */

import { loadChat } from '@/lib/db/actions';
import PersistChat from './chat';

export default async function PersistChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Load messages from database
  const initialMessages = await loadChat(id);

  return <PersistChat id={id} initialMessages={initialMessages} />;
}
