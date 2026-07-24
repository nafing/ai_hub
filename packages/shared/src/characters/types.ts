/**
 * Character Card V2 (`chara_card_v2`) — Tavern / SillyTavern compatible.
 * Spec: https://github.com/malfoyslastname/character-card-spec-v2
 */

export const CHARA_CARD_SPEC = "chara_card_v2" as const;
export const CHARA_CARD_SPEC_VERSION = "2.0" as const;

export type CharacterBookEntryPosition = "before_char" | "after_char";

/**
 * One lorebook entry inside a character book.
 * Optional fields MUST be preserved if present (never destroyed on edit/import).
 */
export type CharacterBookEntry = {
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  /** Lower insertion_order = inserted higher when both match. */
  insertion_order: number;
  case_sensitive?: boolean;
  name?: string;
  /** If token budget reached, lower priority = discarded first. */
  priority?: number;
  id?: number;
  comment?: string;
  /** When true, require a key from both `keys` and `secondary_keys`. */
  selective?: boolean;
  secondary_keys?: string[];
  /** When true, always inserted (within budget). */
  constant?: boolean;
  position?: CharacterBookEntryPosition;
};

/** Character-specific lorebook embedded in the card. */
export type CharacterBook = {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions: Record<string, unknown>;
  entries: CharacterBookEntry[];
};

/** Payload under `data` for chara_card_v2. */
export type CharacterCardData = {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  character_book?: CharacterBook;
  tags: string[];
  creator: string;
  character_version: string;
  /**
   * How often this character should speak in Smart group chat (0–1).
   * Hub field (not part of official chara_card_v2).
   */
  talkativeness: number;
};

/**
 * Full Character Card V2 document.
 */
export type CharacterCardV2 = {
  spec: typeof CHARA_CARD_SPEC;
  spec_version: typeof CHARA_CARD_SPEC_VERSION;
  data: CharacterCardData;
};

/**
 * Persisted hub character: card v2 + hub metadata.
 * `avatar` is an API path to the stored PNG (e.g. `/characters/{id}/avatar`), or null.
 */
export type Character = CharacterCardV2 & {
  id: string;
  /** Public API path for the avatar image, or null when none. */
  avatar: string | null;
};
