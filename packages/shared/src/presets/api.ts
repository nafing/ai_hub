import type { Preset, Variable } from "./types";

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

/** Backend → client command: open Setup Variables before continuing. */
export const NEEDS_PRESET_VARIABLES_CODE = "needs_preset_variables" as const;

export type NeedsPresetVariablesCommand = {
  code: typeof NEEDS_PRESET_VARIABLES_CODE;
  presetId: string;
  variables: Variable[];
};
