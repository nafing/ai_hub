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
  /** Physical look / visual presentation (hub field; useful for image prompts). */
  appearance: string;
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
  /** Conversation bio shown as About Me (hub field). */
  about_me: string;
  /**
   * CSS color or gradient for speaker name labels in conversation.
   * Gradients use background-clip:text in the client.
   */
  name_color: string | null;
  /**
   * CSS color for quoted dialogue spans in chat messages
   * ("", '', «», 「」, 『』).
   */
  dialogue_color: string | null;
  /**
   * Background color for this character's chat message bubbles
   * (prefer semi-transparent rgba).
   */
  message_box_color: string | null;
  /** Optional display alias for conversation grouping / About Me labels. */
  convo_display_name: string;
  /**
   * When true, Character Info in conversation prompts uses `convo_display_name`
   * instead of `name` (falls back to `name` when empty).
   */
  declare_convo_name_on_card: boolean;
  /** How this character should text in conversation mode (hub field). */
  convo_behavior: string;
  /** Where to inject `convo_behavior` relative to the character card. */
  convo_behavior_insertion: CharacterConvoBehaviorInsertion;
  /**
   * Botbooru post id when this character was imported from Botbooru (hub field).
   */
  botbooru_post_id: number | null;
};

/** Insertion mode for conversation behavior text. */
export type CharacterConvoBehaviorInsertion =
  | "constant_after_card"
  | "constant_before_card"
  | "append_to_post_history"
  | "prepend_to_post_history"
  | "replace_post_history"
  | "marker_only";

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
 * `gallery` holds extra images (imports / generations) for backgrounds and reuse.
 * `data` always mirrors the active version snapshot (used by chats / export).
 */
export type CharacterGalleryImageSource = "upload" | "generated" | "import";

/** One image in a character's gallery (not the primary avatar). */
export type CharacterGalleryImage = {
  id: string;
  /** Public API path, e.g. `/characters/{id}/gallery/{imageId}`. */
  url: string;
  mime: string;
  name: string;
  size: number;
  source: CharacterGalleryImageSource;
  created_at: string;
  /** Generation prompt when `source` is `generated`. */
  prompt?: string;
};

export type CharacterVersion = {
  id: string;
  /** Label shown in the version Select (also written to data.character_version). */
  label: string;
  created_at: string;
  updated_at: string;
  data: CharacterCardData;
};

export type Character = CharacterCardV2 & {
  id: string;
  /** Public API path for the avatar image, or null when none. */
  avatar: string | null;
  /** Extra images available for chat backgrounds and reuse. */
  gallery: CharacterGalleryImage[];
  active_version_id: string;
  versions: CharacterVersion[];
};
