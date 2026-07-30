import { Injectable } from "@nestjs/common";
import type { ChatMessage, Lorebook } from "@ai-hub/shared";
import {
  buildLoreScanText,
  filterLorebooksToTokenBudget,
  formatLoreSearchHits,
  searchLoreEntries,
  type LoreSearchResultEntry,
} from "../../utils/lore/retrieval";

export type { LoreSearchResultEntry };

@Injectable()
export class LoreRetrievalService {
  /**
   * Keyword + constant lore retrieval, trimmed to the strictest token budget.
   */
  async filterLorebooksForPrompt(input: {
    lorebooks: Lorebook[];
    historyMessages: ChatMessage[];
    /** Chat-level budget; 0 = unlimited. */
    tokenBudget?: number;
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
    const queryText = buildLoreScanText(input.historyMessages, scanDepth);
    const chatBudget =
      typeof input.tokenBudget === "number" && Number.isFinite(input.tokenBudget)
        ? Math.max(0, Math.floor(input.tokenBudget))
        : null;
    const bookBudget = Math.min(
      ...books.map((book) => book.token_budget ?? 2048),
    );
    const tokenBudget =
      chatBudget === 0
        ? Number.MAX_SAFE_INTEGER
        : chatBudget != null
          ? Math.min(chatBudget, bookBudget)
          : bookBudget;

    const selected = searchLoreEntries({
      lorebooks: books,
      query: queryText,
    });

    return filterLorebooksToTokenBudget(books, selected, tokenBudget);
  }

  async searchEntries(input: {
    lorebooks: Lorebook[];
    query: string;
    category?: string;
  }): Promise<LoreSearchResultEntry[]> {
    return searchLoreEntries(input);
  }

  /** Tool-facing search used by `search_lorebook`. */
  async searchLorebookTool(input: {
    lorebooks: Lorebook[];
    query: string;
    category?: string;
  }): Promise<string> {
    const hits = searchLoreEntries(input);
    return formatLoreSearchHits(hits);
  }
}
