import type { ChatMessage } from "../types";
import type { ChatSummaryEntry } from "./types";

export const SUMMARY_TAIL_MESSAGES = { MIN: 0, DEFAULT: 10 } as const;

export function normalizeSummaryTailMessages(value: unknown): number {
  const { MIN, DEFAULT } = SUMMARY_TAIL_MESSAGES;
  if (value === undefined || value === null) return DEFAULT;
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < MIN) return MIN;
  return parsed;
}

export function isMessageHiddenFromPrompt(message: Pick<ChatMessage, "hidden_from_prompt">): boolean {
  return message.hidden_from_prompt === true;
}

/**
 * Which summarized message IDs should be hidden, protecting the most-recent
 * `tail` visible messages. `messages` must be chat-ordered (ascending).
 */
export function computeSummaryHideIds(args: {
  messages: Array<Pick<ChatMessage, "id" | "hidden_from_prompt">>;
  entryMessageIds: string[];
  tail: number;
}): string[] {
  const { messages, entryMessageIds, tail } = args;
  if (entryMessageIds.length === 0) return [];
  const { MIN } = SUMMARY_TAIL_MESSAGES;
  const clampedTail = Number.isFinite(tail) ? Math.max(MIN, Math.floor(tail)) : MIN;
  const visible = messages.filter((message) => !isMessageHiddenFromPrompt(message));
  const tailIdSet = new Set(
    clampedTail > 0 ? visible.slice(-clampedTail).map((message) => message.id) : [],
  );
  const entryIdSet = new Set(entryMessageIds);
  return messages
    .filter((message) => entryIdSet.has(message.id) && !tailIdSet.has(message.id))
    .map((message) => message.id);
}

export function setMessagesHiddenFromPrompt(
  messages: ChatMessage[],
  ids: Iterable<string>,
  hidden: boolean,
): ChatMessage[] {
  const idSet = new Set(ids);
  if (idSet.size === 0) return messages;
  return messages.map((message) =>
    idSet.has(message.id)
      ? { ...message, hidden_from_prompt: hidden ? true : undefined }
      : message,
  );
}

/** Message ids still covered by other enabled summary entries. */
export function messageIdsStillHiddenByEntries(
  entries: ChatSummaryEntry[],
  excludeEntryId: string,
): Set<string> {
  const still = new Set<string>();
  for (const entry of entries) {
    if (entry.id === excludeEntryId || !entry.enabled) continue;
    for (const id of entry.hidden_message_ids ?? entry.message_ids ?? []) {
      still.add(id);
    }
  }
  return still;
}

export function resolveEntryUnhideIds(
  target: ChatSummaryEntry,
  entries: ChatSummaryEntry[],
): string[] {
  const covered = target.hidden_message_ids ?? target.message_ids ?? [];
  const stillCovered = messageIdsStillHiddenByEntries(entries, target.id);
  return covered.filter((id) => !stillCovered.has(id));
}
