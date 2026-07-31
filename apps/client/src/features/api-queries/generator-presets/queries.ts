import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateGeneratorPresetInput,
  GeneratorCategory,
  UpdateGeneratorPresetInput,
} from "@ai-hub/shared";
import {
  createGeneratorPreset,
  deleteGeneratorPreset,
  duplicateGeneratorPreset,
  getDefaultGeneratorPreset,
  getGeneratorPreset,
  listGeneratorPresets,
  updateGeneratorPreset,
} from "@/features/api-queries/generator-presets/api";

export const generatorPresetKeys = {
  all: ["generator-presets"] as const,
  list: () => [...generatorPresetKeys.all, "list"] as const,
  detail: (id: string) =>
    [...generatorPresetKeys.all, "detail", id] as const,
  default: (category: string) =>
    [...generatorPresetKeys.all, "default", category] as const,
};

export function useGeneratorPresets() {
  return useQuery({
    queryKey: generatorPresetKeys.list(),
    queryFn: listGeneratorPresets,
  });
}

export function useGeneratorPreset(id: string | undefined) {
  return useQuery({
    queryKey: generatorPresetKeys.detail(id ?? ""),
    queryFn: () => getGeneratorPreset(id!),
    enabled: Boolean(id),
  });
}

export function useDefaultGeneratorPreset(
  category: GeneratorCategory | undefined,
) {
  return useQuery({
    queryKey: generatorPresetKeys.default(category ?? ""),
    queryFn: () => getDefaultGeneratorPreset(category!),
    enabled: Boolean(category),
  });
}

export function useCreateGeneratorPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGeneratorPresetInput) =>
      createGeneratorPreset(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: generatorPresetKeys.list(),
      });
    },
  });
}

export function useUpdateGeneratorPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateGeneratorPresetInput;
    }) => updateGeneratorPreset(id, input),
    onSuccess: (preset) => {
      void queryClient.invalidateQueries({
        queryKey: generatorPresetKeys.list(),
      });
      void queryClient.invalidateQueries({
        queryKey: generatorPresetKeys.detail(preset.id),
      });
      void queryClient.invalidateQueries({
        queryKey: generatorPresetKeys.default(preset.category),
      });
    },
  });
}

export function useDeleteGeneratorPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGeneratorPreset(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: generatorPresetKeys.all,
      });
    },
  });
}

export function useDuplicateGeneratorPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateGeneratorPreset(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: generatorPresetKeys.list(),
      });
    },
  });
}
