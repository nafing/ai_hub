import { createHash } from "node:crypto";
import {
  activeMessageText,
  estimateChatSummaryTokens,
  type ChatMessage,
  type Lorebook,
  type LorebookEntry,
} from "@ai-hub/shared";

export type LoreSearchResultEntry = {
  lorebook_id: string;
  lorebook_name: string;
  entry: LorebookEntry;
  source: "constant" | "keyword";
  score: number;
};

export function loreEntryUid(entry: LorebookEntry, index: number): string {
  if (typeof entry.id === "number" && Number.isFinite(entry.id)) {
    return String(entry.id);
  }
  const basis = [
    entry.name ?? "",
    (entry.keys ?? []).join("|"),
    entry.content ?? "",
    String(index),
  ].join("\0");
  return createHash("sha1").update(basis).digest("hex").slice(0, 16);
}

export function estimateLoreTokens(text: string): number {
  const estimate = estimateChatSummaryTokens(text);
  return estimate === 0 ? 1 : estimate;
}

function normalizeHaystack(text: string, caseSensitive: boolean): string {
  return caseSensitive ? text : text.toLowerCase();
}

function keyHits(
  haystack: string,
  keys: string[],
  caseSensitive: boolean,
): boolean {
  if (!keys.length) return false;
  const text = normalizeHaystack(haystack, caseSensitive);
  return keys.some((key) => {
    const needle = key.trim();
    if (!needle) return false;
    return text.includes(
      caseSensitive ? needle : needle.toLowerCase(),
    );
  });
}

export function entryMatchesKeywords(
  entry: LorebookEntry,
  haystack: string,
): boolean {
  const caseSensitive = Boolean(entry.case_sensitive);
  const primary = keyHits(haystack, entry.keys ?? [], caseSensitive);
  if (!primary) return false;
  if (entry.selective && (entry.secondary_keys?.length ?? 0) > 0) {
    return keyHits(haystack, entry.secondary_keys ?? [], caseSensitive);
  }
  return true;
}

export function buildLoreScanText(
  messages: ChatMessage[],
  scanDepth: number,
): string {
  const depth = Math.max(0, scanDepth);
  if (depth === 0) return "";
  const recent = messages.slice(-depth);
  return recent
    .map((message) => activeMessageText(message).trim())
    .filter(Boolean)
    .join("\n");
}

export function searchLoreEntries(input: {
  lorebooks: Lorebook[];
  query: string;
  category?: string;
}): LoreSearchResultEntry[] {
  const books = input.lorebooks.filter((book) => {
    if (book.enabled === false) return false;
    if (input.category && book.category !== input.category) return false;
    return true;
  });
  if (books.length === 0) return [];

  const query = input.query.trim();
  const results = new Map<string, LoreSearchResultEntry>();

  for (const book of books) {
    (book.entries ?? []).forEach((entry, index) => {
      if (entry.enabled === false) return;
      if (!(entry.content ?? "").trim()) return;
      const uid = loreEntryUid(entry, index);
      const key = `${book.id}:${uid}`;

      if (entry.constant) {
        results.set(key, {
          lorebook_id: book.id,
          lorebook_name: book.name,
          entry,
          source: "constant",
          score: 0,
        });
        return;
      }

      if (query && entryMatchesKeywords(entry, query)) {
        results.set(key, {
          lorebook_id: book.id,
          lorebook_name: book.name,
          entry,
          source: "keyword",
          score: 1,
        });
      }
    });
  }

  return [...results.values()].sort((a, b) => {
    const rank = (source: LoreSearchResultEntry["source"]) =>
      source === "constant" ? 0 : 1;
    const bySource = rank(a.source) - rank(b.source);
    if (bySource !== 0) return bySource;
    return (a.entry.insertion_order ?? 100) - (b.entry.insertion_order ?? 100);
  });
}

export function filterLorebooksToTokenBudget(
  books: Lorebook[],
  selected: LoreSearchResultEntry[],
  tokenBudget: number,
): {
  lorebooks: Lorebook[];
  hits: LoreSearchResultEntry[];
  tokenEstimate: number;
} {
  let used = 0;
  const keptHits: LoreSearchResultEntry[] = [];
  const kept = new Map<string, LorebookEntry[]>();

  for (const hit of selected) {
    const cost = estimateLoreTokens(hit.entry.content ?? "");
    if (used + cost > tokenBudget && keptHits.length > 0) continue;
    used += cost;
    keptHits.push(hit);
    const list = kept.get(hit.lorebook_id) ?? [];
    list.push(hit.entry);
    kept.set(hit.lorebook_id, list);
  }

  const lorebooks = books
    .map((book) => {
      const entries = kept.get(book.id);
      if (!entries?.length) {
        return {
          ...book,
          entries: (book.entries ?? []).filter((entry) => entry.constant),
        };
      }
      const constants = (book.entries ?? []).filter(
        (entry) => entry.constant && entry.enabled !== false,
      );
      const merged = [...constants];
      for (const entry of entries) {
        if (!merged.includes(entry)) merged.push(entry);
      }
      return { ...book, entries: merged };
    })
    .filter(
      (book) =>
        (book.entries ?? []).some(
          (entry) => entry.enabled !== false && (entry.content ?? "").trim(),
        ) || Boolean(book.description?.trim()),
    );

  return {
    lorebooks,
    hits: keptHits,
    tokenEstimate: used,
  };
}

export function formatLoreSearchHits(hits: LoreSearchResultEntry[]): string {
  if (hits.length === 0) {
    return "No relevant lorebook entries found.";
  }
  return hits
    .slice(0, 12)
    .map((hit, index) => {
      const title =
        hit.entry.name?.trim() ||
        hit.entry.keys?.[0] ||
        `Entry ${index + 1}`;
      return `### ${title} (${hit.lorebook_name}, ${hit.source})\n${hit.entry.content.trim()}`;
    })
    .join("\n\n---\n\n");
}
