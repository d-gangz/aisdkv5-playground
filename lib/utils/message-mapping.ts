/**
 * Message mapping utilities for bidirectional conversion between UI and database formats
 *
 * Simplified for core message part types (text, reasoning, file, source-url, source-document).
 * No tools or custom data parts.
 *
 * Input data sources: UI messages from AI SDK, database rows from Drizzle
 * Output destinations: Database inserts, UI message reconstruction
 * Dependencies: ai package, db/schema
 * Key exports: mapUIMessagePartsToDBParts, mapDBPartToUIMessagePart
 * Side effects: None (pure functions)
 */

import { UIMessage } from 'ai';
import { NewPart, Part } from '@/lib/db/schema';

type UIMessagePart = UIMessage['parts'][0];

/**
 * Convert UI message parts to database format
 */
export const mapUIMessagePartsToDBParts = (
  messageParts: UIMessagePart[],
  messageId: string
): NewPart[] => {
  return messageParts.map((part, index) => {
    switch (part.type) {
      case 'text':
        return {
          messageId,
          order: index,
          type: part.type,
          text_text: part.text,
        };

      case 'reasoning':
        return {
          messageId,
          order: index,
          type: part.type,
          reasoning_text: part.text,
          providerMetadata: part.providerMetadata,
        };

      case 'file':
        return {
          messageId,
          order: index,
          type: part.type,
          file_mediaType: part.mediaType,
          file_filename: part.filename ?? undefined,
          file_url: part.url,
        };

      case 'source-document':
        return {
          messageId,
          order: index,
          type: part.type,
          source_document_sourceId: part.sourceId,
          source_document_mediaType: part.mediaType,
          source_document_title: part.title,
          source_document_filename: part.filename,
          providerMetadata: part.providerMetadata,
        };

      case 'source-url':
        return {
          messageId,
          order: index,
          type: part.type,
          source_url_sourceId: part.sourceId,
          source_url_url: part.url,
          source_url_title: part.title,
          providerMetadata: part.providerMetadata,
        };

      case 'step-start':
        return {
          messageId,
          order: index,
          type: part.type,
        };

      default:
        // Fail fast - don't silently store incomplete data
        throw new Error(
          `Unsupported part type: ${part.type}. Supported types: text, reasoning, file, source-url, source-document, step-start`
        );
    }
  });
};

/**
 * Convert database parts back to UI message parts
 */
export const mapDBPartToUIMessagePart = (part: Part): UIMessagePart => {
  switch (part.type) {
    case 'text':
      return {
        type: part.type,
        text: part.text_text!,
      };

    case 'reasoning':
      return {
        type: part.type,
        text: part.reasoning_text!,
        providerMetadata: part.providerMetadata ?? undefined,
      };

    case 'file':
      return {
        type: part.type,
        mediaType: part.file_mediaType!,
        filename: part.file_filename!,
        url: part.file_url!,
      };

    case 'source-document':
      return {
        type: part.type,
        sourceId: part.source_document_sourceId!,
        mediaType: part.source_document_mediaType!,
        title: part.source_document_title!,
        filename: part.source_document_filename!,
        providerMetadata: part.providerMetadata ?? undefined,
      };

    case 'source-url':
      return {
        type: part.type,
        sourceId: part.source_url_sourceId!,
        url: part.source_url_url!,
        title: part.source_url_title!,
        providerMetadata: part.providerMetadata ?? undefined,
      };

    case 'step-start':
      return {
        type: part.type,
      };

    default:
      throw new Error(`Unsupported part type: ${part.type}`);
  }
};
