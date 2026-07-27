import type {
  CharacterBookEntry,
  CharacterBookEntryPosition,
} from "../characters/types";

/** Same shape as chara_card_v2 `character_book` entries. */
export type LorebookEntry = CharacterBookEntry;

export type LorebookEntryPosition = CharacterBookEntryPosition;

export type LorebookCategory =
  | "world"
  | "character"
  | "npc"
  | "spellbook"
  | "uncategorized";

/**
 * Standalone lorebook / world book.
 * Field layout matches Character Card V2 `character_book` (+ hub metadata).
 */
export type Lorebook = {
  id: string;
  name: string;
  description: string;
  /** When false, the book is skipped in the prompt pipeline. */
  enabled: boolean;
  /** When true, applies to all chats; otherwise chat/character scoped later. */
  global: boolean;
  /** Hub grouping for the lorebook library. */
  category: LorebookCategory;
  /** Optional linked character ids. */
  linked_characters: string[];
  /** Optional linked persona ids. */
  linked_personas: string[];
  scan_depth: number | null;
  token_budget: number | null;
  recursive_scanning: boolean;
  extensions: Record<string, unknown>;
  entries: LorebookEntry[];
  /**
   * True when the LanceDB vector index may be out of date for this book
   * (failed embed, pending reindex). Server-owned; not client-writable.
   */
  index_dirty: boolean;
};
