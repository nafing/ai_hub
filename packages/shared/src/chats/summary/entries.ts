import { MAX_AUTOMATED_CHAT_SUMMARY_ENTRIES } from "./constants";
import type {
  ChatSummaryEntry,
  ChatSummaryEntryInput,
  ChatSummaryEntryOrigin,
  ChatSummaryEntrySource,
} from "./types";

const VALID_ORIGINS = new Set<ChatSummaryEntryOrigin>([
  "manual",
  "automated",
  "legacy",
]);
const VALID_SOURCES = new Set<ChatSummaryEntrySource>(["last", "range", "agent"]);

export type ChatSummaryEntryNormalizeOptions = {
  legacy_summary?: string | null;
  create_id?: () => string;
  now?: string;
};

function defaultNow(): string {
  return new Date().toISOString();
}

function fallbackId(prefix: string, seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIsoTimestamp(value: unknown, fallback: string): string {
  const text = trimString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : fallback;
}

function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function normalizeMessageIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = Array.from(
    new Set(
      value.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      ),
    ),
  );
  return ids.length > 0 ? ids : undefined;
}

function sourceFromOrigin(origin: ChatSummaryEntryOrigin): ChatSummaryEntrySource {
  return origin === "automated" ? "agent" : "last";
}

export function estimateChatSummaryTokens(content: string): number {
  const normalized = content.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

export function generateChatSummaryEntryTitle(
  entry: Pick<
    ChatSummaryEntry,
    "origin" | "source_mode" | "message_count" | "range_start_index" | "range_end_index"
  >,
): string {
  if (entry.origin === "legacy") return "Legacy summary";
  if (entry.origin === "automated") return "Automated summary";
  if (
    entry.source_mode === "range" &&
    entry.range_start_index &&
    entry.range_end_index
  ) {
    return `Summary messages ${entry.range_start_index}-${entry.range_end_index}`;
  }
  if (entry.message_count) return `Summary of ${entry.message_count} messages`;
  return "Manual summary";
}

export function createLegacyChatSummaryEntry(
  summary: string | null | undefined,
  options: ChatSummaryEntryNormalizeOptions = {},
): ChatSummaryEntry | null {
  const content = trimString(summary);
  if (!content) return null;
  const now = options.now ?? defaultNow();
  const id = options.create_id?.() ?? fallbackId("summary-legacy", content);
  return {
    id,
    kind: "rolling",
    origin: "legacy",
    title: "Legacy summary",
    content,
    enabled: true,
    source_mode: "last",
    token_estimate: estimateChatSummaryTokens(content),
    created_at: now,
    updated_at: now,
  };
}

export function normalizeChatSummaryEntry(
  raw: unknown,
  options: ChatSummaryEntryNormalizeOptions = {},
): ChatSummaryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const content = trimString(value.content);
  if (!content) return null;

  const now = options.now ?? defaultNow();
  const origin = VALID_ORIGINS.has(value.origin as ChatSummaryEntryOrigin)
    ? (value.origin as ChatSummaryEntryOrigin)
    : "legacy";
  const sourceMode = VALID_SOURCES.has(value.source_mode as ChatSummaryEntrySource)
    ? (value.source_mode as ChatSummaryEntrySource)
    : sourceFromOrigin(origin);

  const entry: ChatSummaryEntry = {
    id:
      trimString(value.id) ||
      options.create_id?.() ||
      fallbackId("summary", `${origin}:${content}:${now}`),
    kind: "rolling",
    origin,
    title: trimString(value.title),
    content,
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    source_mode: sourceMode,
    token_estimate:
      typeof value.token_estimate === "number" &&
      Number.isFinite(value.token_estimate) &&
      value.token_estimate >= 0
        ? Math.round(value.token_estimate)
        : estimateChatSummaryTokens(content),
    created_at: normalizeIsoTimestamp(value.created_at, now),
    updated_at: normalizeIsoTimestamp(value.updated_at, now),
  };

  const messageCount = normalizePositiveInteger(value.message_count);
  if (messageCount !== undefined) entry.message_count = messageCount;
  const rangeStartIndex = normalizePositiveInteger(value.range_start_index);
  if (rangeStartIndex !== undefined) entry.range_start_index = rangeStartIndex;
  const rangeEndIndex = normalizePositiveInteger(value.range_end_index);
  if (rangeEndIndex !== undefined) entry.range_end_index = rangeEndIndex;
  const messageIds = normalizeMessageIds(value.message_ids);
  if (messageIds) entry.message_ids = messageIds;
  const hiddenMessageIds = normalizeMessageIds(value.hidden_message_ids);
  if (hiddenMessageIds) entry.hidden_message_ids = hiddenMessageIds;
  if (typeof value.prompt_template_id === "string") {
    entry.prompt_template_id = value.prompt_template_id.trim() || null;
  } else if (value.prompt_template_id === null) {
    entry.prompt_template_id = null;
  }

  if (!entry.title) entry.title = generateChatSummaryEntryTitle(entry);
  return entry;
}

export function createChatSummaryEntry(
  input: ChatSummaryEntryInput,
  options: ChatSummaryEntryNormalizeOptions = {},
): ChatSummaryEntry {
  const entry = normalizeChatSummaryEntry(
    {
      ...input,
      id: input.id || options.create_id?.(),
      created_at: input.created_at ?? options.now,
      updated_at: input.updated_at ?? options.now,
    },
    options,
  );
  if (!entry) {
    throw new Error("Chat summary entry content is required");
  }
  return entry;
}

export function sortChatSummaryEntries(
  entries: ChatSummaryEntry[],
): ChatSummaryEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const aRange = a.entry.range_start_index ?? Number.MAX_SAFE_INTEGER;
      const bRange = b.entry.range_start_index ?? Number.MAX_SAFE_INTEGER;
      if (aRange !== bRange) return aRange - bRange;
      const created =
        Date.parse(a.entry.created_at) - Date.parse(b.entry.created_at);
      if (created !== 0) return created;
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}

function pruneAutomatedChatSummaryEntries(
  entries: ChatSummaryEntry[],
): ChatSummaryEntry[] {
  let prunableAutomatedCount = 0;
  for (const entry of entries) {
    if (
      entry.origin === "automated" &&
      entry.enabled &&
      !(entry.hidden_message_ids && entry.hidden_message_ids.length > 0)
    ) {
      prunableAutomatedCount += 1;
    }
  }
  let removable = prunableAutomatedCount - MAX_AUTOMATED_CHAT_SUMMARY_ENTRIES;
  if (removable <= 0) return entries;

  const pruned: ChatSummaryEntry[] = [];
  for (const entry of entries) {
    if (
      removable > 0 &&
      entry.origin === "automated" &&
      entry.enabled &&
      !(entry.hidden_message_ids && entry.hidden_message_ids.length > 0)
    ) {
      removable -= 1;
      continue;
    }
    pruned.push(entry);
  }
  return pruned;
}

export function normalizeChatSummaryEntries(
  rawEntries: unknown,
  options: ChatSummaryEntryNormalizeOptions = {},
): ChatSummaryEntry[] {
  const seen = new Set<string>();
  const entries = (Array.isArray(rawEntries) ? rawEntries : [])
    .map((entry) => normalizeChatSummaryEntry(entry, options))
    .filter((entry): entry is ChatSummaryEntry => Boolean(entry))
    .map((entry) => {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        return entry;
      }
      const replacementId =
        options.create_id?.() ??
        fallbackId("summary", `${entry.id}:${entry.content}:${seen.size}`);
      seen.add(replacementId);
      return { ...entry, id: replacementId };
    });

  if (entries.length === 0) {
    const legacy = createLegacyChatSummaryEntry(options.legacy_summary, options);
    if (legacy) entries.push(legacy);
  }

  return sortChatSummaryEntries(entries);
}

export function compileChatSummaryEntries(
  entries: ChatSummaryEntry[],
): string {
  return sortChatSummaryEntries(entries)
    .filter((entry) => entry.enabled)
    .map((entry) => entry.content.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function appendChatSummaryEntry(
  entries: ChatSummaryEntry[],
  legacySummary: string | null | undefined,
  input: ChatSummaryEntryInput,
  options: ChatSummaryEntryNormalizeOptions = {},
): { entry: ChatSummaryEntry; entries: ChatSummaryEntry[]; summary: string } {
  const normalized = normalizeChatSummaryEntries(entries, {
    ...options,
    legacy_summary: legacySummary,
  });
  const entry = createChatSummaryEntry(input, options);
  const nextEntries = pruneAutomatedChatSummaryEntries(
    sortChatSummaryEntries([...normalized, entry]),
  );
  return {
    entry,
    entries: nextEntries,
    summary: compileChatSummaryEntries(nextEntries),
  };
}
