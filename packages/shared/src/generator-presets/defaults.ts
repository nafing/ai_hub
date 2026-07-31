import type { GeneratorCategory } from "../presets/constants";
import { defaultPresetId } from "../presets/defaults";
import type { CreateGeneratorPresetInput } from "./api";

/** Blank Generator Preset for user-created entries. */
export function defaultGeneratorPreset(
  category: GeneratorCategory = "character_generator",
): CreateGeneratorPresetInput {
  return {
    name: "",
    description: "",
    author: "",
    category,
    prompt: "",
    prompt_create: "",
    prompt_import: "",
    prompt_regenerate: "",
    prompt_rebuild: "",
    preset_id: defaultPresetId(category),
    is_default: false,
  };
}

/** Stable DB id for a built-in default Generator Preset. */
export function defaultGeneratorPresetId(key: string): string {
  return `default:generator:${key}`;
}
