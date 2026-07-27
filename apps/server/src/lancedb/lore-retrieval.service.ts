import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  activeMessageText,
  type ChatMessage,
  type Lorebook,
  type LorebookEntry,
} from "@ai-hub/shared";
import { EmbeddingsService } from "./embeddings.service";
import {
  LancedbService,
  loreEntryUid,
  type LoreSearchHit,
} from "./lancedb.service";

export type LoreSearchResultEntry = {
  lorebook_id: string;
  lorebook_name: string;
  entry: LorebookEntry;
  source: "constant" | "keyword" | "vector";
  score: number;
};

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
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

function entryMatchesKeywords(
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

function buildScanText(
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

@Injectable()
export class LoreRetrievalService {
  private readonly logger = new Logger(LoreRetrievalService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly lancedb: LancedbService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  vectorTopK(): number {
    const raw = Number(this.config.get<string>("SERVER_LORE_VECTOR_TOP_K"));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 12;
  }

  /**
   * Hybrid retrieval: constant + keyword hits + vector neighbors,
   * trimmed to the strictest token budget across books.
   */
  async filterLorebooksForPrompt(input: {
    lorebooks: Lorebook[];
    historyMessages: ChatMessage[];
  }): Promise<{
    lorebooks: Lorebook[];
    hits: LoreSearchResultEntry[];
    tokenEstimate: number;
  }> {
    const books = input.lorebooks.filter((book) => book.enabled !== false);
    if (books.length === 0) {
      return { lorebooks: [], hits: [], tokenEstimate: 0 };
    }

    const scanDepth = Math.max(
      ...books.map((book) => book.scan_depth ?? 2),
      2,
    );
    const queryText = buildScanText(input.historyMessages, scanDepth);
    const tokenBudget = Math.min(
      ...books.map((book) => book.token_budget ?? 2048),
    );

    const selected = await this.searchEntries({
      lorebooks: books,
      query: queryText,
      topK: this.vectorTopK(),
    });

    const { lorebooks, hits, tokenEstimate } = this.toFilteredLorebooks(
      books,
      selected,
      tokenBudget,
    );
    return { lorebooks, hits, tokenEstimate };
  }

  async searchEntries(input: {
    lorebooks: Lorebook[];
    query: string;
    topK?: number;
    category?: string;
  }): Promise<LoreSearchResultEntry[]> {
    const books = input.lorebooks.filter((book) => {
      if (book.enabled === false) return false;
      if (input.category && book.category !== input.category) return false;
      return true;
    });
    if (books.length === 0) return [];

    const byId = new Map(books.map((book) => [book.id, book]));
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

    if (query) {
      try {
        const vector = await this.embeddings.embedQuery(query);
        const hits = await this.lancedb.search({
          queryVector: vector,
          lorebookIds: books.map((book) => book.id),
          topK: input.topK ?? this.vectorTopK(),
        });
        this.mergeVectorHits(results, hits, byId);
      } catch (error) {
        this.logger.warn(
          `Vector lore search skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return [...results.values()].sort((a, b) => {
      const rank = (source: LoreSearchResultEntry["source"]) =>
        source === "constant" ? 0 : source === "keyword" ? 1 : 2;
      const bySource = rank(a.source) - rank(b.source);
      if (bySource !== 0) return bySource;
      if (a.source === "vector" && b.source === "vector") {
        return a.score - b.score;
      }
      return (a.entry.insertion_order ?? 100) - (b.entry.insertion_order ?? 100);
    });
  }

  /** Tool-facing search used by `search_lorebook`. */
  async searchLorebookTool(input: {
    lorebooks: Lorebook[];
    query: string;
    category?: string;
  }): Promise<string> {
    const hits = await this.searchEntries({
      lorebooks: input.lorebooks,
      query: input.query,
      category: input.category,
      topK: this.vectorTopK(),
    });
    if (hits.length === 0) {
      return "No relevant lorebook entries found.";
    }
    return hits
      .slice(0, this.vectorTopK())
      .map((hit, index) => {
        const title =
          hit.entry.name?.trim() ||
          hit.entry.keys?.[0] ||
          `Entry ${index + 1}`;
        return `### ${title} (${hit.lorebook_name}, ${hit.source})\n${hit.entry.content.trim()}`;
      })
      .join("\n\n---\n\n");
  }

  private mergeVectorHits(
    results: Map<string, LoreSearchResultEntry>,
    hits: LoreSearchHit[],
    byId: Map<string, Lorebook>,
  ) {
    for (const hit of hits) {
      const book = byId.get(hit.lorebook_id);
      if (!book) continue;
      const entry = (book.entries ?? []).find((item, index) => {
        return loreEntryUid(item, index) === hit.entry_uid;
      });
      if (!entry || entry.enabled === false) continue;
      const key = `${hit.lorebook_id}:${hit.entry_uid}`;
      if (results.has(key)) continue;
      results.set(key, {
        lorebook_id: hit.lorebook_id,
        lorebook_name: book.name,
        entry,
        source: "vector",
        score: typeof hit._distance === "number" ? hit._distance : 99,
      });
    }
  }

  private toFilteredLorebooks(
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
      const cost = estimateTokens(hit.entry.content ?? "");
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
        // Preserve constants even if budget trimmed them earlier.
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
}
