/**
 * Catalog of preset template macros (`{{…}}`) for authoring docs / UI.
 * Keep in sync with `template.ts` resolve behavior.
 */

export type PresetMacroEntry = {
  /** Example syntax shown to authors. */
  syntax: string;
  /** Short description of what it does. */
  description: string;
};

/** Control-flow and expression macros supported by `resolveTemplate`. */
export const PRESET_TEMPLATE_MACROS: readonly PresetMacroEntry[] = [
  {
    syntax: "{{name}}",
    description:
      "Inserts the value of a setup or runtime variable. Unresolved names stay as written; empty values also stay as the placeholder.",
  },
  {
    syntax: "{{name || fallback}}",
    description:
      "Uses name when it is truthy; otherwise inserts the fallback text (empty / false / 0 / off / no count as falsy).",
  },
  {
    syntax: "{{name ?? fallback}}",
    description:
      "Uses name when the variable exists (even if empty); otherwise inserts the fallback.",
  },
  {
    syntax: "{{name == value}}",
    description:
      "Inline comparison — resolves to true or false. Also usable inside {{if}} conditions. Operators: == != > >= < <=.",
  },
  {
    syntax: "{{if condition}}…{{else}}…{{/if}}",
    description:
      "Conditional block. {{else}} is optional. Nested {{if}} is supported. Conditions: name, !name, or name == value (etc.).",
  },
] as const;

/**
 * Runtime variables commonly injected by chat / generator flows
 * (not Setup Variables — those come from the preset itself).
 */
export const PRESET_RUNTIME_VARIABLES: readonly PresetMacroEntry[] = [
  {
    syntax: "{{user}}",
    description: "Active persona display name.",
  },
  {
    syntax: "{{userName}}",
    description: "Alias for {{user}} (conversation presets).",
  },
  {
    syntax: "{{char}}",
    description: "Primary character display name.",
  },
  {
    syntax: "{{charName}}",
    description: "Alias for {{char}} (conversation presets).",
  },
  {
    syntax: "{{char_appearance}}",
    description:
      "Primary character Appearance field (image presets / visual prompts).",
  },
  {
    syntax: "{{user_appearance}}",
    description:
      "Active persona Appearance field (image presets / visual prompts).",
  },
  {
    syntax: "{{characters}}",
    description: "Comma-separated names of every character in the chat.",
  },
  {
    syntax: "{{group}}",
    description:
      "Other cast members besides {{char}} (comma-separated). Empty in solo chats.",
  },
  {
    syntax: "{{target_field}}",
    description:
      "What the generator should produce (e.g. all card fields, description, personality).",
  },
  {
    syntax: "{{existing_description}}",
    description: "Current description field (generators / rebuild).",
  },
  {
    syntax: "{{existing_appearance}}",
    description: "Current appearance field (character generator).",
  },
  {
    syntax: "{{existing_personality}}",
    description: "Current personality field (generators / rebuild).",
  },
  {
    syntax: "{{existing_relationships}}",
    description:
      "Current relationships list as JSON array string (character generator).",
  },
  {
    syntax: "{{existing_scenario}}",
    description: "Current scenario field (character generator).",
  },
  {
    syntax: "{{existing_first_mes}}",
    description: "Current first message (character generator).",
  },
  {
    syntax: "{{existing_mes_example}}",
    description: "Current dialogue examples (character generator).",
  },
  {
    syntax: "{{existing_alternate_greetings}}",
    description: "Current alternate greetings (character generator).",
  },
  {
    syntax: "{{generation_mode}}",
    description:
      "Generator task mode: create, import, regenerate, rebuild (character generator).",
  },
  {
    syntax: "{{regenerate_scope}}",
    description: "concept or all when generation_mode is regenerate.",
  },
  {
    syntax: "{{rebuild_scope}}",
    description:
      "concept_batch, concept, all, or field when generation_mode is rebuild.",
  },
  {
    syntax: "{{rebuild_notes}}",
    description: "Optional extra direction for rebuild.",
  },
  {
    syntax: "{{cast_size}}",
    description: "Expected number of characters in a multi-card response.",
  },
  {
    syntax: "{{cast_roster}}",
    description: "Numbered list of names for multi-card regenerate / rebuild.",
  },
  {
    syntax: "{{name_seed}}",
    description: "Optional name hint when creating characters with AI.",
  },
  {
    syntax: "{{language}}",
    description: "From the default Language setup variable (when present).",
  },
] as const;
