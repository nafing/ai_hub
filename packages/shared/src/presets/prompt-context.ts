import type { Character } from "../characters/types";
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

/** Text for the `character_info` marker section. */
export function formatCharacterInfoMarker(
  character: Pick<Character, "data">,
  options: { scenarioOverride?: string | null } = {},
): string {
  const { data } = character;
  const override = options.scenarioOverride?.trim();
  return joinBlocks([
    { label: "Name", value: data.name },
    { label: "Description", value: data.description },
    { label: "Personality", value: data.personality },
    {
      label: "Scenario",
      value: override || data.scenario,
    },
  ]);
}

/** Text for the `dialogue_examples` marker section. */
export function formatDialogueExamplesMarker(
  character: Pick<Character, "data">,
): string {
  return (character.data.mes_example ?? "").trim();
}

/** Text for the `persona` marker section. */
export function formatPersonaMarker(
  persona: Pick<Persona, "name" | "description" | "personality">,
): string {
  return joinBlocks([
    { label: "Name", value: persona.name },
    { label: "Description", value: persona.description },
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
  persona?: Pick<Persona, "name" | "description" | "personality"> | null;
  /** Existing setup-variable values; `user` / `char` from persona/character win. */
  variables?: PresetVariableValues;
  /** Injected into `generator_brief` marker. */
  generatorBrief?: string | null;
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
};

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
  const scenarioOpts = {
    scenarioOverride: options.scenarioOverride,
  };

  if (options.persona) {
    const name = options.persona.name.trim();
    if (name) variables.user = name;
    const personaText = formatPersonaMarker(options.persona);
    if (personaText) markers.persona = personaText;
  }

  const characterList =
    options.characters?.length
      ? options.characters
      : options.character
        ? [options.character]
        : [];
  const primary = characterList[0] ?? null;
  const extras = characterList.slice(1);

  if (primary) {
    const name = primary.data.name.trim();
    if (name) variables.char = name;
    const examples = formatDialogueExamplesMarker(primary);
    if (examples) markers.dialogue_examples = examples;
  }

  if (characterList.length === 1 && primary) {
    const info = formatCharacterInfoMarker(primary, scenarioOpts);
    if (info) markers.character_info = info;
  } else if (characterList.length > 1) {
    const info = formatReferenceCharactersMarker(characterList, scenarioOpts);
    if (info) markers.character_info = info;
  }

  const brief = options.generatorBrief?.trim();
  if (brief) markers.generator_brief = brief;

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
