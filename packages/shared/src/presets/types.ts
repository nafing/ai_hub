// UUID
export type Preset = {
  id: string;
  // Name of the preset
  // The display name for this preset. Used in the Presets panel and chat settings.
  name: string;
  // Description of the preset
  // A short summary of what this preset is designed for. Helps you remember its purpose when choosing between presets.
  description: string;
  // Wrap Format of the preset
  // Controls how prompt sections are formatted when sent to the AI. XML uses <tags>, Markdown uses ## headings, None sends raw content.
  wrap_format: WrapFormat;
  // Category of the preset
  // Where this preset is intended to be used (chat roleplay, generators, etc.).
  category: PresetCategory;
  // Default preset
  // When true, this preset is the active/default one for its category. Only one preset per category can be default at a time.
  is_default: boolean;
  // Author of the preset
  // Optional creator name, useful if you share presets with others.
  author: string;

  // Groups of preset
  // Named buckets for organizing sections. Sections assigned to the same group
  // are nested under one group wrapper in the built prompt (XML tag / Markdown heading).
  groups: string[];

  // Sections of preset
  // Each section below becomes part of the final prompt.
  sections: Section[];

  // Variables of preset
  variables: Variable[];
};

export type WrapFormat = "xml" | "markdown" | "none";

export type PresetCategory =
  | "roleplay"
  | "conversation"
  | "character_generator"
  | "persona_generator"
  | "lorebook_generator"
  | "twatter_refresh"
  | "chat_summary";

export type SectionRole = "system" | "user" | "assistant";

/** Kind of section: editable prompt block or a runtime marker injection point. */
export type SectionKind =
  | "prompt_block"
  | "character_info"
  | "lorebook_all"
  | "persona"
  | "chat_history"
  | "chat_summary"
  | "lorebook_before"
  | "lorebook_after"
  | "dialogue_examples"
  /** Creator brief / concept for generator presets. */
  | "generator_brief"
  /** One or more reference character cards for generators. */
  | "reference_characters";

export type Section = {
  // UUID
  id: string;
  // Kind of the section
  kind: SectionKind;
  // Name of the section
  name: string;
  // Role of the section
  role: SectionRole;
  // Content of the section
  // The text content of this section. Markers typically leave this empty.
  content: string;
  // Position of the section
  position: "ordered" | number;
  // Assigned group of the section
  group: string;
};

/** How the variable options are shown to the user. */
export type VariablePresentation = "auto" | "radios" | "dropdown";

export type VariableOption = {
  // UUID
  id: string;
  // Label shown in the UI (e.g. "Game Master")
  label: string;
  // Value injected into the prompt when this option is selected
  value: string;
};

export type Variable = {
  // UUID
  id: string;
  // Variable name
  // Use {{variable_name}} in any prompt section to insert the selected value. Must be alphanumeric/underscores only.
  variable_name: string;
  // Question shown to the user
  question: string;
  // Multi-select
  // Allow users to select multiple options instead of just one.
  multi_select: boolean;
  // Presentation
  // Auto picks a control; Radios / Dropdown force a specific UI.
  presentation: VariablePresentation;
  // Alphabetical option display
  // When enabled, options are shown alphabetically. Manual order is kept for editing and exports.
  alphabetical: boolean;
  // Currently active/selected option values (injected into {{variable_name}}).
  // Single-select uses at most one entry; multi-select may use several.
  selected: string[];
  // Options the user can choose from
  options: VariableOption[];
};
