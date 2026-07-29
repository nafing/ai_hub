import {
  CHARA_CARD_SPEC,
  CHARA_CARD_SPEC_VERSION,
  type Character,
  type CharacterBook,
  type CharacterBookEntry,
  type CharacterCardData,
  type CharacterConvoBehaviorInsertion,
} from "./types";
import type { CreateCharacterInput } from "./api";
import {
  DEFAULT_TALKATIVENESS,
  normalizeTalkativeness,
} from "./talkativeness";

const CONVO_BEHAVIOR_INSERTIONS = new Set<CharacterConvoBehaviorInsertion>([
  "constant_after_card",
  "constant_before_card",
  "append_to_post_history",
  "prepend_to_post_history",
  "replace_post_history",
  "marker_only",
]);

export function normalizeConvoBehaviorInsertion(
  value: unknown,
): CharacterConvoBehaviorInsertion {
  if (value === "disabled") return "marker_only";
  if (
    typeof value === "string" &&
    CONVO_BEHAVIOR_INSERTIONS.has(value as CharacterConvoBehaviorInsertion)
  ) {
    return value as CharacterConvoBehaviorInsertion;
  }
  return "constant_after_card";
}

/** Card-relative injection for conversation Character Info. */
export function applyConvoBehaviorToCharacterCard(
  card: string,
  data: Pick<CharacterCardData, "convo_behavior" | "convo_behavior_insertion">,
): string {
  const behavior = data.convo_behavior?.trim() ?? "";
  const insertion = normalizeConvoBehaviorInsertion(
    data.convo_behavior_insertion,
  );
  if (
    !behavior ||
    (insertion !== "constant_after_card" &&
      insertion !== "constant_before_card")
  ) {
    return card;
  }
  const behaviorBlock = `Convo Behavior:\n${behavior}`;
  if (!card) return behaviorBlock;
  if (insertion === "constant_before_card") {
    return `${behaviorBlock}\n\n${card}`;
  }
  return `${card}\n\n${behaviorBlock}`;
}

/**
 * Effective post-history text when insertion targets post-history.
 * Returns null when this insertion mode should not inject a post-history block.
 */
export function resolveConvoPostHistoryBlock(
  data: Pick<
    CharacterCardData,
    | "convo_behavior"
    | "convo_behavior_insertion"
    | "post_history_instructions"
  >,
): string | null {
  const behavior = data.convo_behavior?.trim() ?? "";
  const base = data.post_history_instructions?.trim() ?? "";
  const insertion = normalizeConvoBehaviorInsertion(
    data.convo_behavior_insertion,
  );

  if (insertion === "append_to_post_history") {
    const merged = [base, behavior].filter(Boolean).join("\n\n");
    return merged || null;
  }
  if (insertion === "prepend_to_post_history") {
    const merged = [behavior, base].filter(Boolean).join("\n\n");
    return merged || null;
  }
  if (insertion === "replace_post_history") {
    return behavior || null;
  }
  return null;
}

/** Blank character book entry. */
export function defaultCharacterBookEntry(): CharacterBookEntry {
  return {
    keys: [],
    content: "",
    extensions: {},
    enabled: true,
    insertion_order: 100,
  };
}

/** Blank `data` payload for a new card. */
export function defaultCharacterCardData(
  overrides: Partial<CharacterCardData> = {},
): CharacterCardData {
  const { talkativeness: talkOverride, ...rest } = overrides;
  return {
    name: "",
    description: "",
    appearance: "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    alternate_greetings: [],
    tags: [],
    creator: "",
    character_version: "",
    about_me: typeof rest.about_me === "string" ? rest.about_me : "",
    name_color: typeof rest.name_color === "string" ? rest.name_color : null,
    dialogue_color:
      typeof rest.dialogue_color === "string" ? rest.dialogue_color : null,
    message_box_color:
      typeof rest.message_box_color === "string"
        ? rest.message_box_color
        : null,
    convo_display_name:
      typeof rest.convo_display_name === "string" ? rest.convo_display_name : "",
    declare_convo_name_on_card:
      typeof rest.declare_convo_name_on_card === "boolean"
        ? rest.declare_convo_name_on_card
        : false,
    convo_behavior:
      typeof rest.convo_behavior === "string" ? rest.convo_behavior : "",
    convo_behavior_insertion: normalizeConvoBehaviorInsertion(
      rest.convo_behavior_insertion,
    ),
    ...rest,
    talkativeness: normalizeTalkativeness(
      talkOverride ?? DEFAULT_TALKATIVENESS,
    ),
  };
}

/** Blank character for user-created entries. */
export function defaultCharacter(
  overrides: Omit<Partial<Omit<Character, "id">>, "data" | "avatar"> & {
    data?: Partial<CharacterCardData>;
  } = {},
): CreateCharacterInput {
  const { data: dataOverrides, ...rest } = overrides;
  return {
    spec: CHARA_CARD_SPEC,
    spec_version: CHARA_CARD_SPEC_VERSION,
    ...rest,
    data: defaultCharacterCardData(dataOverrides),
  };
}

/**
 * Normalize imported / partial card data so all required v2 fields exist.
 * Talkativeness is a hub field on the card; legacy `extensions.talkativeness` is migrated.
 * Optional book fields and book/entry extensions are preserved.
 */
export function normalizeCharacterCardData(
  input: Partial<CharacterCardData> & Record<string, unknown>,
): CharacterCardData {
  const base = defaultCharacterCardData();
  const legacyExtensions =
    input.extensions &&
    typeof input.extensions === "object" &&
    !Array.isArray(input.extensions)
      ? (input.extensions as Record<string, unknown>)
      : null;
  const legacyTalk =
    legacyExtensions && "talkativeness" in legacyExtensions
      ? legacyExtensions.talkativeness
      : undefined;

  const data: CharacterCardData = {
    ...base,
    name: typeof input.name === "string" ? input.name : base.name,
    description:
      typeof input.description === "string"
        ? input.description
        : base.description,
    appearance:
      typeof input.appearance === "string"
        ? input.appearance
        : typeof legacyExtensions?.appearance === "string"
          ? (legacyExtensions.appearance as string)
          : base.appearance,
    personality:
      typeof input.personality === "string"
        ? input.personality
        : base.personality,
    scenario:
      typeof input.scenario === "string" ? input.scenario : base.scenario,
    first_mes:
      typeof input.first_mes === "string" ? input.first_mes : base.first_mes,
    mes_example:
      typeof input.mes_example === "string"
        ? input.mes_example
        : base.mes_example,
    creator_notes:
      typeof input.creator_notes === "string"
        ? input.creator_notes
        : base.creator_notes,
    system_prompt:
      typeof input.system_prompt === "string"
        ? input.system_prompt
        : base.system_prompt,
    post_history_instructions:
      typeof input.post_history_instructions === "string"
        ? input.post_history_instructions
        : base.post_history_instructions,
    alternate_greetings: normalizeAlternateGreetings(
      input.alternate_greetings,
      base.alternate_greetings,
    ),
    tags: Array.isArray(input.tags)
      ? input.tags.filter((item): item is string => typeof item === "string")
      : base.tags,
    creator: typeof input.creator === "string" ? input.creator : base.creator,
    character_version:
      typeof input.character_version === "string"
        ? input.character_version
        : base.character_version,
    talkativeness: normalizeTalkativeness(
      input.talkativeness !== undefined ? input.talkativeness : legacyTalk,
    ),
    about_me:
      typeof input.about_me === "string"
        ? input.about_me
        : typeof legacyExtensions?.aboutMe === "string"
          ? (legacyExtensions.aboutMe as string)
          : base.about_me,
    name_color:
      typeof input.name_color === "string"
        ? input.name_color
        : typeof legacyExtensions?.nameColor === "string"
          ? (legacyExtensions.nameColor as string)
          : null,
    dialogue_color:
      typeof input.dialogue_color === "string"
        ? input.dialogue_color
        : typeof legacyExtensions?.dialogueColor === "string"
          ? (legacyExtensions.dialogueColor as string)
          : null,
    message_box_color:
      typeof input.message_box_color === "string"
        ? input.message_box_color
        : typeof legacyExtensions?.messageBoxColor === "string"
          ? (legacyExtensions.messageBoxColor as string)
          : null,
    convo_display_name:
      typeof input.convo_display_name === "string"
        ? input.convo_display_name
        : typeof legacyExtensions?.convoDisplayName === "string"
          ? (legacyExtensions.convoDisplayName as string)
          : "",
    declare_convo_name_on_card:
      typeof input.declare_convo_name_on_card === "boolean"
        ? input.declare_convo_name_on_card
        : typeof legacyExtensions?.declareConvoNameOnCard === "boolean"
          ? (legacyExtensions.declareConvoNameOnCard as boolean)
          : false,
    convo_behavior:
      typeof input.convo_behavior === "string"
        ? input.convo_behavior
        : typeof legacyExtensions?.convoBehavior === "string"
          ? (legacyExtensions.convoBehavior as string)
          : "",
    convo_behavior_insertion: normalizeConvoBehaviorInsertion(
      input.convo_behavior_insertion ?? legacyExtensions?.convoBehaviorInsertion,
    ),
  };

  if (
    input.character_book &&
    typeof input.character_book === "object" &&
    !Array.isArray(input.character_book)
  ) {
    data.character_book = normalizeCharacterBook(
      input.character_book as CharacterBook,
    );
  }

  return data;
}

/**
 * Coerce alternate greetings to `string[]`.
 * Accepts a legacy single string joined with `---` separators.
 */
export function normalizeAlternateGreetings(
  input: unknown,
  fallback: string[] = [],
): string[] {
  if (Array.isArray(input)) {
    return input.filter((item): item is string => typeof item === "string");
  }
  if (typeof input === "string" && input.trim()) {
    return input
      .split(/\n-{3,}\n/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
  return fallback;
}

function normalizeCharacterBook(book: CharacterBook): CharacterBook {
  return {
    ...book,
    extensions:
      book.extensions &&
      typeof book.extensions === "object" &&
      !Array.isArray(book.extensions)
        ? book.extensions
        : {},
    entries: Array.isArray(book.entries)
      ? book.entries.map((entry) => ({
          ...entry,
          keys: Array.isArray(entry.keys) ? entry.keys : [],
          content: typeof entry.content === "string" ? entry.content : "",
          extensions:
            entry.extensions &&
            typeof entry.extensions === "object" &&
            !Array.isArray(entry.extensions)
              ? entry.extensions
              : {},
          enabled: Boolean(entry.enabled),
          insertion_order:
            typeof entry.insertion_order === "number"
              ? entry.insertion_order
              : 100,
        }))
      : [],
  };
}

/** Build a portable chara_card_v2 JSON document from a hub character. */
export function toCharacterCardV2(
  character: Pick<Character, "spec" | "spec_version" | "data">,
) {
  const data = normalizeCharacterCardData(character.data);
  const { talkativeness, ...cardFields } = data;
  return {
    spec: CHARA_CARD_SPEC,
    spec_version: CHARA_CARD_SPEC_VERSION,
    data: {
      ...cardFields,
      // Spec requires `data.extensions`; map hub talkativeness for ST compatibility.
      extensions: { talkativeness },
    },
  };
}
