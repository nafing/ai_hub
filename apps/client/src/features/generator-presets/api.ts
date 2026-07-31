import type {
  CreateGeneratorPresetInput,
  GeneratorPreset,
  GeneratorPresetListItem,
  UpdateGeneratorPresetInput,
} from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function listGeneratorPresets(): Promise<GeneratorPresetListItem[]> {
  const { data } = await api.get<GeneratorPresetListItem[]>("/generator-presets");
  return data;
}

export async function getGeneratorPreset(id: string): Promise<GeneratorPreset> {
  const { data } = await api.get<GeneratorPreset>(`/generator-presets/${id}`);
  return data;
}

export async function getDefaultGeneratorPreset(
  category: string,
): Promise<GeneratorPreset> {
  const { data } = await api.get<GeneratorPreset>(
    `/generator-presets/default/${category}`,
  );
  return data;
}

export async function createGeneratorPreset(
  input: CreateGeneratorPresetInput,
): Promise<GeneratorPreset> {
  const { data } = await api.post<GeneratorPreset>("/generator-presets", input);
  return data;
}

export async function updateGeneratorPreset(
  id: string,
  input: UpdateGeneratorPresetInput,
): Promise<GeneratorPreset> {
  const { data } = await api.patch<GeneratorPreset>(
    `/generator-presets/${id}`,
    input,
  );
  return data;
}

export async function deleteGeneratorPreset(id: string): Promise<void> {
  await api.delete(`/generator-presets/${id}`);
}

export async function duplicateGeneratorPreset(
  id: string,
): Promise<GeneratorPreset> {
  const { data } = await api.post<GeneratorPreset>(
    `/generator-presets/${id}/duplicate`,
  );
  return data;
}
