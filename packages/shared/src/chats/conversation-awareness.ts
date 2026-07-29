import { activeMessageText } from "./history";
import { compileChatSummaryEntries } from "./summary/entries";
import type { Chat, ChatMessage } from "./types";

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const TOKEN_BUDGET = 1500;
const PARENT_RECENT_MESSAGE_LIMIT = 20;
const PARENT_MESSAGE_CHAR_LIMIT = 500;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function windowFromUserText(text: string, now = Date.now()): number {
  const lower = text.toLowerCase();
  if (/\byesterday\b/.test(lower)) return 36 * 60 * 60 * 1000;
  if (/\btoday\b/.test(lower)) return 18 * 60 * 60 * 1000;
  if (/\blast\s+week\b|\bpast\s+week\b/.test(lower)) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  return DEFAULT_WINDOW_MS;
}

/**
 * Marinara-style connected parent context for Character DMs.
 * Injects recent parent roleplay (or conversation) messages so the DM
 * character knows what is happening in the originating chat.
 */
export function buildConnectedParentChatBlock(input: {
  parentChat: Chat;
  personaName?: string;
  nameByCharacterId?: Map<string, string>;
  recentLimit?: number;
}): string | null {
  const parent = input.parentChat;
  const title = (parent.title || "Parent chat").replace(/"/g, "'");
  const tag =
    parent.mode === "roleplay"
      ? "ConnectedRoleplay"
      : parent.mode === "conversation"
        ? "ConnectedConversation"
        : "ConnectedChat";

  const summary =
    parent.summary?.trim() ||
    compileChatSummaryEntries(parent.summary_entries ?? []).trim() ||
    "";

  const recent = parent.messages
    .filter((message) => !message.hidden_from_prompt)
    .slice(-(input.recentLimit ?? PARENT_RECENT_MESSAGE_LIMIT));

  const lines: string[] = [];
  for (const message of recent) {
    const speaker =
      message.role === "user"
        ? input.personaName?.trim() || "User"
        : message.character_id
          ? (input.nameByCharacterId?.get(message.character_id) ??
            message.character_id)
          : message.role === "system"
            ? "System"
            : "Narrator";
    const text = activeMessageText(message)
      .trim()
      .slice(0, PARENT_MESSAGE_CHAR_LIMIT);
    if (!text) continue;
    lines.push(`[${speaker}]: ${text}`);
  }

  if (!summary && !lines.length) return null;

  const parts = [
    `<${tag} title="${title}">`,
    `You have access to context from the linked ${parent.mode} chat "${title}".`,
    `Use it so you naturally remember and can discuss what is happening there. Do not narrate as if you are inside that chat unless the user asks — this is a private DM.`,
  ];
  if (summary) {
    parts.push("<Summary>", summary, "</Summary>");
  }
  if (lines.length) {
    parts.push("<RecentMessages>", ...lines, "</RecentMessages>");
  }
  parts.push(`</${tag}>`);
  return parts.join("\n");
}

/**
 * Build a cross-chat awareness block from other conversation chats
 * that share characters with the current chat.
 */
export function buildAwarenessBlock(input: {
  currentChatId: string;
  characterIds: string[];
  otherChats: Chat[];
  latestUserText?: string;
  characterMemories?: Record<string, string[]>;
  nameByCharacterId?: Map<string, string>;
}): string | null {
  const sharedIds = new Set(input.characterIds);
  const windowMs = windowFromUserText(input.latestUserText ?? "");
  const cutoff = Date.now() - windowMs;
  const sections: string[] = [];
  let tokens = 0;

  for (const chat of input.otherChats) {
    if (chat.id === input.currentChatId) continue;
    if (chat.mode !== "conversation") continue;
    const overlap = chat.settings.character_ids.filter((id) =>
      sharedIds.has(id),
    );
    if (!overlap.length) continue;

    const recent = chat.messages
      .filter((message) => {
        if (message.hidden_from_prompt) return false;
        const at = Date.parse(message.created_at);
        return Number.isFinite(at) && at >= cutoff;
      })
      .slice(-40);

    if (!recent.length) continue;

    const lines: string[] = [];
    for (const message of recent) {
      const speaker =
        message.role === "user"
          ? "User"
          : message.character_id
            ? (input.nameByCharacterId?.get(message.character_id) ??
              message.character_id)
            : "Assistant";
      const text = activeMessageText(message).trim();
      if (!text) continue;
      lines.push(`${speaker}: ${text}`);
    }
    if (!lines.length) continue;

    const block = [
      `<Conversation title="${chat.title.replace(/"/g, "'")}">`,
      ...lines,
      `</Conversation>`,
    ].join("\n");
    const cost = estimateTokens(block);
    if (tokens + cost > TOKEN_BUDGET) break;
    tokens += cost;
    sections.push(block);
  }

  const memoryLines: string[] = [];
  for (const [characterId, facts] of Object.entries(
    input.characterMemories ?? {},
  )) {
    if (!sharedIds.has(characterId) || !facts?.length) continue;
    const name =
      input.nameByCharacterId?.get(characterId) ?? characterId;
    for (const fact of facts.slice(-8)) {
      memoryLines.push(`${name}: ${fact}`);
    }
  }
  if (memoryLines.length) {
    sections.push(
      ["<Memories>", ...memoryLines, "</Memories>"].join("\n"),
    );
  }

  if (!sections.length) return null;
  return ["<Awareness>", ...sections, "</Awareness>"].join("\n");
}

/** Lightweight lexical memory recall (no embeddings). */
export function recallLexicalMemories(input: {
  query: string;
  messages: ChatMessage[];
  limit?: number;
  /**
   * Skip the newest N prompt messages when scoring (avoids echoing the live
   * turn — e.g. the latest "to wysyłaj" — back into `<Memories>`).
   */
  excludeRecent?: number;
}): string | null {
  const query = input.query.trim().toLowerCase();
  if (!query) return null;
  const terms = query
    .split(/\W+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);
  if (!terms.length) return null;

  const excludeRecent = Math.max(0, Math.floor(input.excludeRecent ?? 0));
  const candidates =
    excludeRecent > 0 && input.messages.length > excludeRecent
      ? input.messages.slice(0, input.messages.length - excludeRecent)
      : excludeRecent > 0
        ? []
        : input.messages;

  const scored = candidates
    .map((message, index) => {
      const text = activeMessageText(message).trim();
      if (!text) return { text, score: 0, created_at: message.created_at, index };
      const lower = text.toLowerCase();
      // Exact echo of a short live user line inside the query is noise.
      if (
        lower === query ||
        (lower.length <= 40 && query.includes(lower))
      ) {
        return { text, score: 0, created_at: message.created_at, index };
      }
      let score = 0;
      for (const term of terms) {
        if (lower.includes(term)) score += 1;
      }
      // Light recency bias so older keyword spam does not dominate.
      const recency = index / Math.max(candidates.length, 1);
      return {
        text,
        score: score > 0 ? score + recency * 0.25 : 0,
        created_at: message.created_at,
        index,
      };
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || b.created_at.localeCompare(a.created_at),
    )
    .slice(0, input.limit ?? 6);

  if (!scored.length) return null;
  return [
    "<Memories>",
    ...scored.map((item) => item.text.slice(0, 400)),
    "</Memories>",
  ].join("\n");
}
