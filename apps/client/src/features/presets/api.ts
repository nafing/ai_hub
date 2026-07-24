import type {
  LlmChatMessage,
  CreatePresetInput,
  Preset,
  PresetListItem,
  PresetMarkerContent,
  PresetVariableValues,
  Section,
  UpdatePresetInput,
  WrapFormat,
} from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function listPresets(): Promise<PresetListItem[]> {
  const { data } = await api.get<PresetListItem[]>("/presets");
  return data;
}

export async function getPreset(id: string): Promise<Preset> {
  const { data } = await api.get<Preset>(`/presets/${id}`);
  return data;
}

export async function getDefaultPreset(
  category: string,
): Promise<Preset> {
  const { data } = await api.get<Preset>(`/presets/default/${category}`);
  return data;
}

export async function createPreset(
  input: CreatePresetInput,
): Promise<Preset> {
  const { data } = await api.post<Preset>("/presets", input);
  return data;
}

export async function updatePreset(
  id: string,
  input: UpdatePresetInput,
): Promise<Preset> {
  const { data } = await api.patch<Preset>(`/presets/${id}`, input);
  return data;
}

export async function deletePreset(id: string): Promise<void> {
  await api.delete(`/presets/${id}`);
}

export async function duplicatePreset(id: string): Promise<Preset> {
  const { data } = await api.post<Preset>(`/presets/${id}/duplicate`);
  return data;
}

export type TestPresetInput = {
  connectionId?: string;
  variables?: PresetVariableValues;
  markers?: PresetMarkerContent;
  userMessage?: string;
  draft?: {
    wrap_format: WrapFormat;
    sections: Section[];
  };
};

export type TestPresetResult = {
  content: string;
  thinking: string;
  reply: string;
  finishReason: string | null;
  model: string | null;
  messages: LlmChatMessage[];
};

export async function testPreset(
  id: string,
  input: TestPresetInput,
): Promise<TestPresetResult> {
  const { data } = await api.post<TestPresetResult>(
    `/presets/${id}/test`,
    input,
  );
  return data;
}
