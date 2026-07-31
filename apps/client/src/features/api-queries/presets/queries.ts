import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreatePresetInput,
  PresetCategory,
  UpdatePresetInput,
} from "@ai-hub/shared";
import {
  createPreset,
  deletePreset,
  duplicatePreset,
  getDefaultPreset,
  getPreset,
  listPresets,
  testPreset,
  updatePreset,
  type TestPresetInput,
} from "@/features/api-queries/presets/api";

export const presetKeys = {
  all: ["presets"] as const,
  list: () => [...presetKeys.all, "list"] as const,
  detail: (id: string) => [...presetKeys.all, "detail", id] as const,
  default: (category: string) =>
    [...presetKeys.all, "default", category] as const,
};

export function usePresets() {
  return useQuery({
    queryKey: presetKeys.list(),
    queryFn: listPresets,
  });
}

export function usePreset(id: string | undefined) {
  return useQuery({
    queryKey: presetKeys.detail(id ?? ""),
    queryFn: () => getPreset(id!),
    enabled: Boolean(id),
  });
}

export function useDefaultPreset(category: PresetCategory | undefined) {
  return useQuery({
    queryKey: presetKeys.default(category ?? ""),
    queryFn: () => getDefaultPreset(category!),
    enabled: Boolean(category),
  });
}

export function useCreatePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePresetInput) => createPreset(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: presetKeys.list() });
    },
  });
}

export function useUpdatePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdatePresetInput;
    }) => updatePreset(id, input),
    onSuccess: (preset) => {
      void queryClient.invalidateQueries({ queryKey: presetKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: presetKeys.detail(preset.id),
      });
    },
  });
}

export function useDeletePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePreset(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: presetKeys.list() });
    },
  });
}

export function useDuplicatePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicatePreset(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: presetKeys.list() });
    },
  });
}

export function useTestPreset(presetId: string) {
  return useMutation({
    mutationFn: (input: TestPresetInput) => testPreset(presetId, input),
  });
}
