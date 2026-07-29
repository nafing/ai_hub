import { activeMessageText } from "./history";
import type { ChatMemoryChunk, ChatMessage } from "./types";

export type { ChatMemoryChunk };

/** Messages per durable memory chunk (Marinara-compatible). */
export const MEMORY_CHUNK_SIZE = 5;

export function normalizeChatMemoryChunks(value: unknown): ChatMemoryChunk[] {
  if (!Array.isArray(value)) return [];
  const out: ChatMemoryChunk[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const content =
      typeof record.content === "string" ? record.content.trim() : "";
    if (!id || !content) continue;
    const messageCount = Number(record.message_count);
    const first =
      typeof record.first_message_at === "string" ? record.first_message_at : "";
    const last =
      typeof record.last_message_at === "string" ? record.last_message_at : "";
    const created =
      typeof record.created_at === "string" ? record.created_at : first || last;
    if (!first || !last) continue;
    out.push({
      id,
      content,
      message_count:
        Number.isFinite(messageCount) && messageCount >= 0
          ? Math.floor(messageCount)
          : 0,
      first_message_at: first,
      last_message_at: last,
      created_at: created || new Date().toISOString(),
      source_chat_id:
        typeof record.source_chat_id === "string" && record.source_chat_id.trim()
          ? record.source_chat_id.trim()
          : null,
    });
  }
  return out.sort((a, b) =>
    a.first_message_at.localeCompare(b.first_message_at),
  );
}

function formatMessageLine(
  message: ChatMessage,
  nameByCharacterId?: Map<string, string>,
  userName = "User",
): string | null {
  const text = activeMessageText(message).trim();
  if (!text) return null;
  if (message.role === "user") return `${userName}: ${text}`;
  if (message.role === "system") return `Narrator: ${text}`;
  const name =
    (message.character_id && nameByCharacterId?.get(message.character_id)) ||
    "Character";
  return `${name}: ${text}`;
}

/**
 * Append complete groups of MEMORY_CHUNK_SIZE messages that are not yet
 * covered by native (non-imported) chunks. Keeps the newest
 * `readBehindMessageCount` messages out of durable storage.
 */
export function appendPendingMemoryChunks(input: {
  messages: ChatMessage[];
  existing: ChatMemoryChunk[];
  readBehindMessageCount?: number;
  nameByCharacterId?: Map<string, string>;
  userName?: string;
  createId: () => string;
  now?: string;
}): ChatMemoryChunk[] {
  const readBehind = Math.max(
    0,
    Math.floor(input.readBehindMessageCount ?? 0),
  );
  const eligible =
    readBehind > 0
      ? input.messages.slice(0, Math.max(0, input.messages.length - readBehind))
      : input.messages;

  const native = input.existing.filter((chunk) => !chunk.source_chat_id);
  const imported = input.existing.filter((chunk) =>
    Boolean(chunk.source_chat_id),
  );
  const lastCovered = native.reduce(
    (latest, chunk) =>
      chunk.last_message_at > latest ? chunk.last_message_at : latest,
    "",
  );

  const unchunked = lastCovered
    ? eligible.filter((message) => message.created_at > lastCovered)
    : eligible;

  if (unchunked.length < MEMORY_CHUNK_SIZE) {
    return [...native, ...imported].sort((a, b) =>
      a.first_message_at.localeCompare(b.first_message_at),
    );
  }

  const now = input.now ?? new Date().toISOString();
  const next = [...native];
  const completeCount =
    Math.floor(unchunked.length / MEMORY_CHUNK_SIZE) * MEMORY_CHUNK_SIZE;

  for (let i = 0; i < completeCount; i += MEMORY_CHUNK_SIZE) {
    const group = unchunked.slice(i, i + MEMORY_CHUNK_SIZE);
    const lines = group
      .map((message) =>
        formatMessageLine(message, input.nameByCharacterId, input.userName),
      )
      .filter((line): line is string => Boolean(line));
    if (!lines.length) continue;
    next.push({
      id: input.createId(),
      content: lines.join("\n\n"),
      message_count: group.length,
      first_message_at: group[0]!.created_at,
      last_message_at: group[group.length - 1]!.created_at,
      created_at: now,
      source_chat_id: null,
    });
  }

  return [...next, ...imported].sort((a, b) =>
    a.first_message_at.localeCompare(b.first_message_at),
  );
}

/** Rebuild native chunks from the full message log (keeps imported chunks). */
export function rebuildMemoryChunks(input: {
  messages: ChatMessage[];
  existing?: ChatMemoryChunk[];
  readBehindMessageCount?: number;
  nameByCharacterId?: Map<string, string>;
  userName?: string;
  createId: () => string;
  now?: string;
}): ChatMemoryChunk[] {
  const imported = (input.existing ?? []).filter((chunk) =>
    Boolean(chunk.source_chat_id),
  );
  return appendPendingMemoryChunks({
    ...input,
    existing: imported,
  });
}

function scoreChunk(content: string, terms: string[]): number {
  const lower = content.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += 1;
  }
  return score;
}

/** Lexical recall over durable chunks (no embeddings required). */
export function recallMemoryChunks(input: {
  query: string;
  chunks: ChatMemoryChunk[];
  limit?: number;
}): string | null {
  const query = input.query.trim().toLowerCase();
  if (!query || !input.chunks.length) return null;
  const terms = query
    .split(/\W+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);
  if (!terms.length) return null;

  const scored = input.chunks
    .map((chunk, index) => {
      const score = scoreChunk(chunk.content, terms);
      const recency = index / Math.max(input.chunks.length, 1);
      return {
        chunk,
        score: score > 0 ? score + recency * 0.15 : 0,
      };
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.chunk.last_message_at.localeCompare(a.chunk.last_message_at),
    )
    .slice(0, input.limit ?? 6);

  if (!scored.length) return null;
  return formatMemoryRecallBlock(scored.map((item) => item.chunk.content));
}

export function formatMemoryRecallBlock(contents: string[]): string {
  const lines = contents
    .map((content) => content.trim())
    .filter(Boolean)
    .map(
      (content, index) =>
        `--- Memory ${index + 1} ---\n${content.slice(0, 1200)}`,
    );
  if (!lines.length) return "";
  return [
    "<Memories>",
    'The following are recalled fragments from earlier in this conversation. Use them to maintain continuity, remember past events, and stay in character — but do not explicitly reference "remembering" unless it\'s natural.',
    ...lines,
    "</Memories>",
  ].join("\n");
}
