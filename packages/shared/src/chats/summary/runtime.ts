import type { ChatMessage } from "../types";
import { isMessageHiddenFromPrompt } from "./hide";
import {
  CHAT_SUMMARY_OUTPUT_TOKENS,
  DEFAULT_SUMMARY_CONTEXT_SIZE,
  DEFAULT_SUMMARY_RUN_INTERVAL,
} from "./constants";
import type { ChatSummaryEntry } from "./types";

export const MIN_SUMMARY_RUN_INTERVAL = 1;
export const MAX_SUMMARY_RUN_INTERVAL = 200;
export const MIN_SUMMARY_CONTEXT_SIZE = 5;
export const MAX_SUMMARY_CONTEXT_SIZE = 500;

export function clampSummaryRunInterval(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SUMMARY_RUN_INTERVAL;
  return Math.max(
    MIN_SUMMARY_RUN_INTERVAL,
    Math.min(MAX_SUMMARY_RUN_INTERVAL, Math.trunc(parsed)),
  );
}

export function clampSummaryContextSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SUMMARY_CONTEXT_SIZE;
  return Math.max(
    MIN_SUMMARY_CONTEXT_SIZE,
    Math.min(MAX_SUMMARY_CONTEXT_SIZE, Math.trunc(parsed)),
  );
}

export function clampSummaryMaxTokens(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return CHAT_SUMMARY_OUTPUT_TOKENS.DEFAULT;
  }
  return Math.max(
    CHAT_SUMMARY_OUTPUT_TOKENS.MIN,
    Math.min(CHAT_SUMMARY_OUTPUT_TOKENS.MAX, Math.trunc(parsed)),
  );
}

export function parseChatSummaryText(rawContent: string): string {
  const cleaned = rawContent
    .trim()
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "");
  try {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const parsed = JSON.parse(cleaned.slice(first, last + 1)) as {
        summary?: unknown;
      };
      return typeof parsed.summary === "string" ? parsed.summary.trim() : cleaned.trim();
    }
  } catch {
    // Fall through to raw text.
  }
  return cleaned.trim();
}

export function formatRoleplaySummaryChatLog(
  messages: ChatMessage[],
  speakerName: (message: ChatMessage) => string,
): string {
  return messages
    .map((message) => {
      const content = message.swipes[message.swipe_id]?.trim() ?? "";
      if (!content) return null;
      return `[${speakerName(message)}]: ${content}`;
    })
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}

export function countUserMessagesAfterSummaryAnchor(
  messages: ChatMessage[],
  anchorMessageId: string | null,
): number {
  if (!anchorMessageId) {
    return messages.filter((message) => message.role === "user").length;
  }
  const anchorIndex = messages.findIndex((message) => message.id === anchorMessageId);
  if (anchorIndex === -1) {
    return messages.filter((message) => message.role === "user").length;
  }
  return messages
    .slice(anchorIndex + 1)
    .filter((message) => message.role === "user").length;
}

export function selectRollingSummaryMessages(
  messages: ChatMessage[],
  contextSize: number,
  summaryEntries?: ChatSummaryEntry[],
): ChatMessage[] {
  const size = Number.isFinite(contextSize) ? Math.max(0, Math.floor(contextSize)) : 0;
  if (size <= 0) return [];
  const visible = messages.filter((message) => !isMessageHiddenFromPrompt(message));
  if (visible.length <= size) return visible;

  const summaryOwned = new Set<string>();
  for (const entry of summaryEntries ?? []) {
    if (entry.enabled === false) continue;
    for (const id of entry.hidden_message_ids ?? []) summaryOwned.add(id);
    for (const id of entry.message_ids ?? []) summaryOwned.add(id);
  }
  if (summaryOwned.size === 0) return visible.slice(-size);

  let lastBoundaryIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (
      isMessageHiddenFromPrompt(message) &&
      summaryOwned.has(message.id)
    ) {
      lastBoundaryIndex = i;
      break;
    }
  }
  if (lastBoundaryIndex < 0) return visible.slice(-size);

  const sinceBoundary = messages
    .slice(lastBoundaryIndex + 1)
    .filter((message) => !isMessageHiddenFromPrompt(message)).length;
  return visible.slice(-Math.max(size, sinceBoundary));
}

export function roleplaySummaryEnabled(mode: string): boolean {
  return mode === "roleplay";
}
