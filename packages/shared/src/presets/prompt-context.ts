import type { Character } from "../characters/types";
import { applyConvoBehaviorToCharacterCard } from "../characters/defaults";
import type { Lorebook } from "../lorebooks/types";
import type { Persona } from "../personas/types";
import type { PresetMarkerContent, PresetVariableValues } from "./build-prompt";

function joinBlocks(
  blocks: Array<{ label: string; value: string | undefined | null }>,
): string {
  return blocks
    .map(({ label, value }) => {
      const trimmed = typeof value === "string" ? value.trim() : "";
      if (!trimmed) return null;
      return `${label}:\n${trimmed}`;
    })
    .filter((block): block is string => Boolean(block))
    .join("\n\n");
}

function formatListField(items: string[] | undefined | null): string {
  return (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

/** Text for the `character_info` marker section. */
export function formatCharacterInfoMarker(
  character: Pick<Character, "data">,
  options: {
    scenarioOverride?: string | null;
    /** When true, omit scenario (used for group cast + shared scenario). */
    omitScenario?: boolean;
    /**
     * Image presets: Appearance only (no description / personality / scenario).
     */
    forImage?: boolean;
    /**
     * Conversation DMs: personality/backstory only — no scenario/scene framing.
     */
    forConversation?: boolean;
  } = {},
): string {
  const { data } = character;
  const displayName =
    options.forConversation &&
    data.declare_convo_name_on_card &&
    data.convo_display_name.trim()
      ? data.convo_display_name.trim()
      : data.name;

  let card: string;
  if (options.forImage) {
    card = joinBlocks([
      { label: "Name", value: displayName },
      { label: "Appearance", value: data.appearance },
    ]);
  } else if (options.omitScenario || options.forConversation) {
    card = joinBlocks([
      { label: "Name", value: displayName },
      { label: "Description", value: data.description },
      { label: "Appearance", value: data.appearance },
      { label: "Personality", value: data.personality },
      { label: "Relationships", value: formatListField(data.relationships) },
    ]);
  } else {
    const override = options.scenarioOverride?.trim();
    card = joinBlocks([
      { label: "Name", value: displayName },
      { label: "Description", value: data.description },
      { label: "Appearance", value: data.appearance },
      { label: "Personality", value: data.personality },
      { label: "Relationships", value: formatListField(data.relationships) },
      {
        label: "Scenario",
        value: override || data.scenario,
      },
    ]);
  }

  if (!options.forConversation) return card;

  return applyConvoBehaviorToCharacterCard(card, data);
}

/** Text for the `dialogue_examples` marker section. */
export function formatDialogueExamplesMarker(
  character: Pick<Character, "data">,
): string {
  return (character.data.mes_example ?? "").trim();
}

/** Text for the `persona` marker section. */
export function formatPersonaMarker(
  persona: Pick<Persona, "name" | "description" | "appearance" | "personality">,
): string {
  return joinBlocks([
    { label: "Name", value: persona.name },
    { label: "Description", value: persona.description },
    { label: "Appearance", value: persona.appearance },
    { label: "Personality", value: persona.personality },
  ]);
}

/** Format one or more characters for the `reference_characters` marker. */
export function formatReferenceCharactersMarker(
  characters: Array<Pick<Character, "data">>,
  options: { scenarioOverride?: string | null } = {},
): string {
  return characters
    .map((character) => formatCharacterInfoMarker(character, options))
    .filter(Boolean)
    .join("\n\n---\n\n");
}

/** Format lorebook entries for lorebook_* markers. */
export function formatLorebookMarker(
  lorebooks: Array<
    Pick<Lorebook, "name" | "description" | "entries" | "enabled">
  >,
): string {
  const blocks: string[] = [];
  for (const book of lorebooks) {
    if (book.enabled === false) continue;
    const enabledEntries = (book.entries ?? []).filter(
      (entry) => entry.enabled !== false,
    );
    if (enabledEntries.length === 0 && !book.description?.trim()) continue;

    const header = [book.name?.trim() || "Lorebook", book.description?.trim()]
      .filter(Boolean)
      .join(" — ");
    const entryBlocks = enabledEntries.map((entry) => {
      const keys = (entry.keys ?? []).filter(Boolean).join(", ");
      const content = (entry.content ?? "").trim();
      if (!content) return null;
      return keys ? `[${keys}]\n${content}` : content;
    });
    blocks.push(
      [header, ...entryBlocks.filter((block): block is string => Boolean(block))]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
  return blocks.filter(Boolean).join("\n\n====\n\n");
}

export type BuildPresetPromptContextOptions = {
  /** Primary character (`{{char}}`, dialogue examples). Prefer `characters` for multi. */
  character?: Pick<Character, "data"> | null;
  /**
   * One or more characters. First is primary; all are merged into `character_info`.
   * Extra characters (after the first) also fill `reference_characters`.
   */
  characters?: Array<Pick<Character, "data">> | null;
  /**
   * Full group cast when the active prompt character is scoped to one speaker
   * (individual group mode). Fills {{characters}} / {{group}} and appends other
   * cast members' cards into `character_info` so the speaker knows they exist.
   */
  groupCharacters?: Array<Pick<Character, "data">> | null;
  persona?: Pick<
    Persona,
    "name" | "description" | "appearance" | "personality"
  > | null;
  /** Existing setup-variable values; `user` / `char` from persona/character win. */
  variables?: PresetVariableValues;
  /** Injected into `generator_brief` marker. */
  generatorBrief?: string | null;
  /** Injected into `generator_prompt` marker (from Generator Presets). */
  generatorPrompt?: string | null;
  /** Injected into `reference_characters` marker (preformatted or via characters). */
  referenceCharacters?: string | null;
  referenceCharacterList?: Array<Pick<Character, "data">> | null;
  /** Injected into lorebook markers. */
  lorebooks?: Array<
    Pick<Lorebook, "name" | "description" | "entries" | "enabled">
  > | null;
  /** Injected into `chat_history` marker. */
  chatHistory?: string | null;
  /** Injected into `chat_summary` marker. */
  chatSummary?: string | null;
  /**
   * When set, replaces each character's card scenario in character_info /
   * reference_characters markers.
   */
  scenarioOverride?: string | null;
  /**
   * How to format Character Info / Persona for image prompt presets.
   * Appearance only — expose {{char_appearance}} / {{user_appearance}}.
   */
  characterInfoMode?: "default" | "image" | "conversation";
};

const CONVERSATION_CHARACTER_INFO_PREAMBLE = `[Texting context — Character Info is background personality, NOT a live scene. You and {{userName || the user}} are messaging on your phones remotely. Do not write as if anyone is physically present (no "you came here", "standing in front of me", etc.) unless chat history clearly established that.]`;

/**
 * Merge setup variables with `{{user}}` / `{{char}}` and marker payloads.
 */
export function buildPresetPromptContext(
  options: BuildPresetPromptContextOptions = {},
): {
  variables: PresetVariableValues;
  markers: PresetMarkerContent;
} {
  const variables: PresetVariableValues = { ...(options.variables ?? {}) };
  const markers: PresetMarkerContent = {};
  const forImage = options.characterInfoMode === "image";
  const forConversation = options.characterInfoMode === "conversation";
  const scenarioOpts = {
    scenarioOverride: forConversation ? null : options.scenarioOverride,
    forImage,
    forConversation,
  };

  if (options.persona) {
    const name = options.persona.name.trim();
    if (name) variables.user = name;
    if (name) variables.userName = name;
    const appearance = options.persona.appearance?.trim() || "";
    if (appearance) variables.user_appearance = appearance;
    const personaText = forImage
      ? joinBlocks([
          { label: "Name", value: options.persona.name },
          { label: "Appearance", value: appearance },
        ])
      : formatPersonaMarker(options.persona);
    if (personaText) markers.persona = personaText;
  }

  const characterList =
    options.characters?.length
      ? options.characters
      : options.character
        ? [options.character]
        : [];
  const groupCharacterList =
    options.groupCharacters?.length ? options.groupCharacters : characterList;
  const primary = characterList[0] ?? null;
  const extras = characterList.slice(1);

  if (primary) {
    const name = primary.data.name.trim();
    if (name) variables.char = name;
    if (name) variables.charName = name;
    const appearance = primary.data.appearance?.trim() || "";
    if (appearance) variables.char_appearance = appearance;
    const examples = formatDialogueExamplesMarker(primary);
    if (examples && !forConversation) markers.dialogue_examples = examples;
    const convoBehavior = primary.data.convo_behavior?.trim() || "";
    if (convoBehavior) variables.convo_behavior = convoBehavior;
  }

  const allNames = groupCharacterList
    .map((character) => character.data.name.trim())
    .filter(Boolean);
  if (allNames.length > 0) {
    variables.characters = allNames.join(", ");
    const responder = (variables.char as string | undefined)?.trim();
    const others = responder
      ? allNames.filter((name) => name !== responder)
      : allNames.slice(1);
    if (others.length > 0) variables.group = others.join(", ");
  }

  const groupScenario = options.scenarioOverride?.trim();
  if (characterList.length === 1 && primary) {
    const blocks: string[] = [];
    const info = formatCharacterInfoMarker(primary, scenarioOpts);
    if (info) blocks.push(info);

    // Individual group turns scope `characters` to the speaker; still inject
    // the rest of the cast so {{char}} knows who else is present.
    const others = groupCharacterList.filter((character) => character !== primary);
    if (others.length > 0) {
      const otherBlocks = others
        .map((character) =>
          formatCharacterInfoMarker(character, {
            omitScenario: true,
            forConversation,
          }),
        )
        .filter(Boolean);
      if (otherBlocks.length > 0) {
        blocks.push(
          [
            "Other cast members (present in this chat — you know they exist; do not speak or narrate as them):",
            "",
            otherBlocks.join("\n\n---\n\n"),
          ].join("\n"),
        );
      }
    }

    if (blocks.length > 0) {
      markers.character_info = forConversation
        ? `${CONVERSATION_CHARACTER_INFO_PREAMBLE}\n\n${blocks.join("\n\n---\n\n")}`
        : blocks.join("\n\n---\n\n");
    }
  } else if (characterList.length > 1) {
    const charOpts = groupScenario
      ? { omitScenario: true as const, forConversation }
      : scenarioOpts;
    const blocks = characterList
      .map((character) => formatCharacterInfoMarker(character, charOpts))
      .filter(Boolean);
    if (groupScenario && !forConversation) {
      blocks.push(`Scenario:\n${groupScenario}`);
    }
    if (blocks.length > 0) {
      markers.character_info = forConversation
        ? `${CONVERSATION_CHARACTER_INFO_PREAMBLE}\n\n${blocks.join("\n\n---\n\n")}`
        : blocks.join("\n\n---\n\n");
    }
  }

  const brief = options.generatorBrief?.trim();
  if (brief) markers.generator_brief = brief;

  const generatorPrompt = options.generatorPrompt?.trim();
  if (generatorPrompt) markers.generator_prompt = generatorPrompt;

  const referenceFromExtras = extras.length
    ? formatReferenceCharactersMarker(extras, scenarioOpts)
    : "";
  const referenceFromList = options.referenceCharacterList?.length
    ? formatReferenceCharactersMarker(
        options.referenceCharacterList,
        scenarioOpts,
      )
    : "";
  const reference =
    options.referenceCharacters?.trim() ||
    referenceFromList.trim() ||
    referenceFromExtras.trim();
  if (reference) markers.reference_characters = reference;

  if (options.lorebooks?.length) {
    const loreText = formatLorebookMarker(options.lorebooks);
    if (loreText) {
      markers.lorebook_all = loreText;
      markers.lorebook_before = loreText;
      markers.lorebook_after = loreText;
    }
  }

  const history = options.chatHistory?.trim();
  if (history) markers.chat_history = history;

  const summary = options.chatSummary?.trim();
  if (summary) markers.chat_summary = summary;

  return { variables, markers };
}
