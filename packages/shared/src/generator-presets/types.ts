import type { GeneratorCategory } from "../presets/constants";

/**
 * Generator Preset — instruction prompts injected into a structural
 * generator Preset via the `generator_prompt` marker.
 *
 * `prompt` is always included. Mode prompts are appended when
 * `generation_mode` matches (create / import / regenerate / rebuild).
 */
export type GeneratorPreset = {
  id: string;
  name: string;
  description: string;
  author: string;
  /** Which generator pipeline this prompt is for. */
  category: GeneratorCategory;
  /** Main / shared prompt body. */
  prompt: string;
  /** Appended when generation_mode is `create`. */
  prompt_create: string;
  /** Appended when generation_mode is `import`. */
  prompt_import: string;
  /** Appended when generation_mode is `regenerate`. */
  prompt_regenerate: string;
  /** Appended when generation_mode is `rebuild`. */
  prompt_rebuild: string;
  /**
   * Linked structural Preset from `/presets`.
   * `null` → use the default Preset for `category` at runtime.
   */
  preset_id: string | null;
  /** Only one default Generator Preset per category. */
  is_default: boolean;
};

export const GENERATOR_PRESET_PROMPT_MODES = [
  "create",
  "import",
  "regenerate",
  "rebuild",
] as const;

export type GeneratorPresetPromptMode =
  (typeof GENERATOR_PRESET_PROMPT_MODES)[number];
