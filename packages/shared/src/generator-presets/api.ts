import type { GeneratorPreset } from "./types";

export type CreateGeneratorPresetInput = Omit<GeneratorPreset, "id">;

export type UpdateGeneratorPresetInput = Partial<CreateGeneratorPresetInput>;

export type GeneratorPresetListItem = Pick<
  GeneratorPreset,
  | "id"
  | "name"
  | "description"
  | "author"
  | "category"
  | "preset_id"
  | "is_default"
>;
