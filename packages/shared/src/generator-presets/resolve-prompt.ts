import type { GeneratorPreset, GeneratorPresetPromptMode } from "./types";
import { GENERATOR_PRESET_PROMPT_MODES } from "./types";

export type GeneratorPresetPromptFields = Pick<
  GeneratorPreset,
  | "prompt"
  | "prompt_create"
  | "prompt_import"
  | "prompt_regenerate"
  | "prompt_rebuild"
>;

function modePrompt(
  preset: GeneratorPresetPromptFields,
  mode: GeneratorPresetPromptMode,
): string {
  switch (mode) {
    case "create":
      return preset.prompt_create;
    case "import":
      return preset.prompt_import;
    case "regenerate":
      return preset.prompt_regenerate;
    case "rebuild":
      return preset.prompt_rebuild;
  }
}

/**
 * Build the injected `generator_prompt` text: main prompt plus the
 * mode-specific block when `generation_mode` is create/import/regenerate/rebuild.
 */
export function resolveGeneratorPresetPrompt(
  preset: GeneratorPresetPromptFields,
  generationMode?: string | null,
): string {
  const main = preset.prompt.trim();
  const raw =
    typeof generationMode === "string" ? generationMode.trim() : "";
  const mode = (GENERATOR_PRESET_PROMPT_MODES as readonly string[]).includes(
    raw,
  )
    ? (raw as GeneratorPresetPromptMode)
    : null;
  const extra = mode ? modePrompt(preset, mode).trim() : "";
  if (main && extra) return `${main}\n\n${extra}`;
  return main || extra;
}
