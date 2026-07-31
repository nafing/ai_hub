import type { PresetCategory, SectionKind } from "./types";

export const WRAP_FORMATS = ["xml", "markdown", "none"] as const;

export const PRESET_CATEGORIES = [
  "roleplay",
  "conversation",
  "character_generator",
  "persona_generator",
  "lorebook_generator",
  "twatter_refresh",
  "chat_summary",
  "image",
] as const;

/** Chat preset categories (1:1 and group share the same templates). */
export const CHAT_PRESET_CATEGORIES = [
  "roleplay",
  "conversation",
] as const satisfies readonly PresetCategory[];

/** Categories that run through the `/generators` API (not chat presets). */
export const GENERATOR_CATEGORIES = [
  "character_generator",
  "persona_generator",
  "lorebook_generator",
  "twatter_refresh",
  "image",
] as const satisfies readonly PresetCategory[];

export type GeneratorCategory = (typeof GENERATOR_CATEGORIES)[number];

/** Presets that drive rolling roleplay chat summaries. */
export const CHAT_SUMMARY_PRESET_CATEGORIES = [
  "chat_summary",
] as const satisfies readonly PresetCategory[];

export const PRESET_CATEGORY_LABELS: Record<PresetCategory, string> = {
  roleplay: "Roleplay",
  conversation: "Conversation",
  character_generator: "Character Generator",
  persona_generator: "Persona Generator",
  lorebook_generator: "Lorebook Generator",
  twatter_refresh: "Twatter Refresh",
  chat_summary: "Chat Summary",
  image: "Image",
};

export const SECTION_ROLES = ["system", "user", "assistant"] as const;

export const SECTION_KINDS = [
  "prompt_block",
  "character_info",
  "lorebook_all",
  "persona",
  "chat_history",
  "chat_summary",
  "lorebook_before",
  "lorebook_after",
  "dialogue_examples",
  "generator_brief",
  "generator_prompt",
  "reference_characters",
] as const;

export const VARIABLE_PRESENTATIONS = ["auto", "radios", "dropdown"] as const;

export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  prompt_block: "Prompt Block",
  character_info: "Character Info",
  lorebook_all: "Lorebook Marker (All)",
  persona: "Persona",
  chat_history: "Chat History",
  chat_summary: "Chat Summary",
  lorebook_before: "Lorebook Marker (Before)",
  lorebook_after: "Lorebook Marker (After)",
  dialogue_examples: "Dialogue Examples",
  generator_brief: "Generator Brief",
  generator_prompt: "Generator Prompt",
  reference_characters: "Reference Characters",
};

/** Marker kinds shown under the "Markers" group in the add-section menu. */
export const SECTION_MARKER_KINDS = [
  "character_info",
  "lorebook_all",
  "persona",
  "chat_history",
  "chat_summary",
  "lorebook_before",
  "lorebook_after",
  "dialogue_examples",
  "generator_brief",
  "generator_prompt",
  "reference_characters",
] as const satisfies readonly SectionKind[];

export function isSectionMarker(kind: SectionKind): boolean {
  return kind !== "prompt_block";
}
