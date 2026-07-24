import type { CharacterBook } from "../characters/types";
import type { CreateLorebookInput } from "./api";
import type {
  Lorebook,
  LorebookCategory,
  LorebookEntry,
  LorebookEntryPosition,
} from "./types";

export const LOREBOOK_ENTRY_POSITIONS = [
  "before_char",
  "after_char",
] as const satisfies readonly LorebookEntryPosition[];

export const LOREBOOK_CATEGORIES = [
  "world",
  "character",
  "npc",
  "spellbook",
  "uncategorized",
] as const satisfies readonly LorebookCategory[];

export const LOREBOOK_CATEGORY_LABELS: Record<LorebookCategory, string> = {
  world: "World",
  character: "Character",
  npc: "NPC",
  spellbook: "Spellbook",
  uncategorized: "Uncategorized",
};

export const DEFAULT_LOREBOOK_SCAN_DEPTH = 2;
export const DEFAULT_LOREBOOK_TOKEN_BUDGET = 2048;

/** Blank lorebook entry. */
export function defaultLorebookEntry(
  overrides: Partial<LorebookEntry> = {},
): LorebookEntry {
  return {
    keys: [],
    content: "",
    extensions: {},
    enabled: true,
    insertion_order: 100,
    case_sensitive: false,
    selective: false,
    secondary_keys: [],
    constant: false,
    position: "before_char",
    ...overrides,
  };
}

/** Blank lorebook for user-created entries. */
export function defaultLorebook(
  overrides: Partial<CreateLorebookInput> = {},
): CreateLorebookInput {
  const { entries, extensions, ...rest } = overrides;
  return {
    name: "",
    description: "",
    enabled: true,
    global: false,
    category: "uncategorized",
    linked_characters: [],
    linked_personas: [],
    scan_depth: DEFAULT_LOREBOOK_SCAN_DEPTH,
    token_budget: DEFAULT_LOREBOOK_TOKEN_BUDGET,
    recursive_scanning: false,
    ...rest,
    extensions:
      extensions && typeof extensions === "object" && !Array.isArray(extensions)
        ? extensions
        : {},
    entries: Array.isArray(entries)
      ? entries.map((entry) => normalizeLorebookEntry(entry))
      : [],
  };
}

export function normalizeLorebookEntry(
  input: Partial<LorebookEntry> & Record<string, unknown>,
): LorebookEntry {
  const base = defaultLorebookEntry();
  const keys = coerceStringArray(input.keys ?? input.key);
  const secondary = coerceStringArray(
    input.secondary_keys ?? input.keysecondary,
  );
  const position =
    input.position === "before_char" || input.position === "after_char"
      ? input.position
      : base.position;

  return {
    ...base,
    keys,
    content: typeof input.content === "string" ? input.content : base.content,
    extensions:
      input.extensions &&
      typeof input.extensions === "object" &&
      !Array.isArray(input.extensions)
        ? (input.extensions as Record<string, unknown>)
        : {},
    enabled:
      typeof input.enabled === "boolean"
        ? input.enabled
        : typeof input.disable === "boolean"
          ? !input.disable
          : base.enabled,
    insertion_order:
      typeof input.insertion_order === "number"
        ? input.insertion_order
        : typeof input.order === "number"
          ? input.order
          : base.insertion_order,
    case_sensitive:
      typeof input.case_sensitive === "boolean"
        ? input.case_sensitive
        : base.case_sensitive,
    name: typeof input.name === "string" ? input.name : undefined,
    priority: typeof input.priority === "number" ? input.priority : undefined,
    id: typeof input.id === "number" ? input.id : undefined,
    comment: typeof input.comment === "string" ? input.comment : undefined,
    selective:
      typeof input.selective === "boolean" ? input.selective : base.selective,
    secondary_keys: secondary,
    constant:
      typeof input.constant === "boolean" ? input.constant : base.constant,
    position,
  };
}

export function normalizeLorebookCategory(
  value: unknown,
): LorebookCategory {
  if (
    typeof value === "string" &&
    (LOREBOOK_CATEGORIES as readonly string[]).includes(value)
  ) {
    return value as LorebookCategory;
  }
  return "uncategorized";
}

export function normalizeLorebook(
  input: Partial<Lorebook> & Record<string, unknown>,
): CreateLorebookInput {
  const entriesRaw = input.entries;
  let entries: LorebookEntry[] = [];
  if (Array.isArray(entriesRaw)) {
    entries = entriesRaw.map((entry) =>
      normalizeLorebookEntry(
        (entry ?? {}) as Partial<LorebookEntry> & Record<string, unknown>,
      ),
    );
  } else if (
    entriesRaw &&
    typeof entriesRaw === "object" &&
    !Array.isArray(entriesRaw)
  ) {
    // SillyTavern World Info: entries keyed by uid
    entries = Object.values(entriesRaw as Record<string, unknown>).map(
      (entry) =>
        normalizeLorebookEntry(
          (entry ?? {}) as Partial<LorebookEntry> & Record<string, unknown>,
        ),
    );
  }

  return defaultLorebook({
    name: typeof input.name === "string" ? input.name : "",
    description:
      typeof input.description === "string" ? input.description : "",
    enabled: typeof input.enabled === "boolean" ? input.enabled : true,
    global: typeof input.global === "boolean" ? input.global : false,
    category: normalizeLorebookCategory(input.category),
    linked_characters: coerceStringArray(
      input.linked_characters ?? input.linked_character,
    ),
    linked_personas: coerceStringArray(input.linked_personas),
    scan_depth:
      typeof input.scan_depth === "number"
        ? input.scan_depth
        : DEFAULT_LOREBOOK_SCAN_DEPTH,
    token_budget:
      typeof input.token_budget === "number"
        ? input.token_budget
        : DEFAULT_LOREBOOK_TOKEN_BUDGET,
    recursive_scanning: Boolean(input.recursive_scanning),
    extensions:
      input.extensions &&
      typeof input.extensions === "object" &&
      !Array.isArray(input.extensions)
        ? (input.extensions as Record<string, unknown>)
        : {},
    entries,
  });
}

/**
 * Convert an embedded V2 `character_book` into a hub lorebook draft.
 * Use when extracting a book from a character card import.
 */
export function lorebookFromCharacterBook(
  book: CharacterBook | Record<string, unknown>,
  overrides: Partial<CreateLorebookInput> = {},
): CreateLorebookInput {
  const normalized = normalizeLorebook({
    ...(book as Record<string, unknown>),
    ...overrides,
    entries: overrides.entries ?? (book as CharacterBook).entries,
  });
  if (!normalized.name.trim()) {
    normalized.name =
      typeof overrides.name === "string" && overrides.name.trim()
        ? overrides.name
        : "Character lorebook";
  }
  return normalized;
}

/** Portable character_book / world-book document (no hub id). */
export function toCharacterBook(
  lorebook: Pick<
    Lorebook,
    | "name"
    | "description"
    | "scan_depth"
    | "token_budget"
    | "recursive_scanning"
    | "extensions"
    | "entries"
  >,
): CharacterBook {
  const book: CharacterBook = {
    name: lorebook.name,
    description: lorebook.description,
    extensions: lorebook.extensions ?? {},
    entries: lorebook.entries.map((entry) => normalizeLorebookEntry(entry)),
  };
  if (lorebook.scan_depth != null) book.scan_depth = lorebook.scan_depth;
  if (lorebook.token_budget != null) book.token_budget = lorebook.token_budget;
  if (lorebook.recursive_scanning) {
    book.recursive_scanning = true;
  }
  return book;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}
