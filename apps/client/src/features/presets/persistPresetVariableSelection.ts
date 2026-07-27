import type { Preset, Variable } from "@ai-hub/shared";
import { api } from "@/lib/api";

/** Merge modal `selected` into the preset and PATCH it. */
export async function persistPresetVariableSelection(
  presetId: string,
  updates: Variable[],
): Promise<Preset> {
  const { data: preset } = await api.get<Preset>(`/presets/${presetId}`);
  const selectedById = new Map(
    updates.map((variable) => [variable.id, variable.selected ?? []]),
  );
  const { data } = await api.patch<Preset>(`/presets/${presetId}`, {
    variables: preset.variables.map((variable) =>
      selectedById.has(variable.id)
        ? { ...variable, selected: selectedById.get(variable.id)! }
        : variable,
    ),
  });
  return data;
}
