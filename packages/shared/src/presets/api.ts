import type { Preset } from "./types";

export type CreatePresetInput = Omit<Preset, "id">;

export type UpdatePresetInput = Partial<CreatePresetInput>;

export type PresetListItem = Pick<
  Preset,
  | "id"
  | "name"
  | "description"
  | "wrap_format"
  | "category"
  | "is_default"
  | "author"
> & {
  sections_count: number;
  variables_count: number;
};
