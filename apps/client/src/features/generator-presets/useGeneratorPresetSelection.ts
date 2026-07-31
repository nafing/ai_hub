import { useEffect, useMemo, useState } from "react";
import type { GeneratorCategory, GeneratorPreset, Preset } from "@ai-hub/shared";
import {
  useDefaultPreset,
  usePreset,
  usePresets,
} from "@/features/presets/queries";
import {
  useDefaultGeneratorPreset,
  useGeneratorPreset,
  useGeneratorPresets,
} from "@/features/generator-presets/queries";

/**
 * Select a Generator Preset and resolve its linked structural Preset.
 */
export function useGeneratorPresetSelection(category: GeneratorCategory) {
  const generatorPresetsQuery = useGeneratorPresets();
  const defaultGeneratorPresetQuery = useDefaultGeneratorPreset(category);
  const defaultPresetQuery = useDefaultPreset(category);
  const presetsQuery = usePresets();

  const [generatorPresetId, setGeneratorPresetId] = useState<string | null>(
    null,
  );
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (defaultGeneratorPresetQuery.data?.id) {
      setGeneratorPresetId(defaultGeneratorPresetQuery.data.id);
      setInitialized(true);
      return;
    }
    if (
      defaultGeneratorPresetQuery.isError ||
      defaultGeneratorPresetQuery.isSuccess
    ) {
      const fallback = (generatorPresetsQuery.data ?? []).find(
        (preset) => preset.category === category,
      );
      if (fallback) {
        setGeneratorPresetId(fallback.id);
        setInitialized(true);
      } else if (
        generatorPresetsQuery.isSuccess ||
        generatorPresetsQuery.isError
      ) {
        setInitialized(true);
      }
    }
  }, [
    initialized,
    category,
    defaultGeneratorPresetQuery.data,
    defaultGeneratorPresetQuery.isError,
    defaultGeneratorPresetQuery.isSuccess,
    generatorPresetsQuery.data,
    generatorPresetsQuery.isSuccess,
    generatorPresetsQuery.isError,
  ]);

  const generatorPresetDetailQuery = useGeneratorPreset(
    generatorPresetId ?? undefined,
  );

  const linkedPresetId =
    generatorPresetDetailQuery.data?.preset_id?.trim() || null;

  const fallbackStructuralId = useMemo(() => {
    if (linkedPresetId) return null;
    if (defaultPresetQuery.data?.id) return defaultPresetQuery.data.id;
    return (
      (presetsQuery.data ?? []).find((preset) => preset.category === category)
        ?.id ?? null
    );
  }, [linkedPresetId, defaultPresetQuery.data, presetsQuery.data, category]);

  const structuralPresetId = linkedPresetId ?? fallbackStructuralId;
  const structuralPresetQuery = usePreset(structuralPresetId ?? undefined);

  const generatorPresetOptions = useMemo(() => {
    const matching = (generatorPresetsQuery.data ?? []).filter(
      (preset) => preset.category === category,
    );
    const list =
      matching.length > 0 ? matching : (generatorPresetsQuery.data ?? []);
    return list.map((preset) => ({
      value: preset.id,
      label: `${preset.name || "untitled"}${preset.is_default ? " (default)" : ""}${preset.category !== category ? ` · ${preset.category}` : ""}`,
    }));
  }, [generatorPresetsQuery.data, category]);

  const generatorPreset: GeneratorPreset | undefined =
    generatorPresetDetailQuery.data;
  const structuralPreset: Preset | undefined = structuralPresetQuery.data;

  const selectError = generatorPresetsQuery.isError
    ? "Failed to load generator presets"
    : generatorPresetDetailQuery.isError
      ? "Failed to load generator preset"
      : structuralPresetQuery.isError
        ? "Failed to load linked preset"
        : !generatorPresetsQuery.isLoading && !generatorPresetOptions.length
          ? "No generator presets available"
          : undefined;

  const isLoading =
    generatorPresetsQuery.isLoading ||
    (!!generatorPresetId && generatorPresetDetailQuery.isLoading) ||
    (!!structuralPresetId && structuralPresetQuery.isLoading);

  return {
    generatorPresetId,
    setGeneratorPresetId,
    generatorPreset,
    generatorPresetOptions,
    structuralPresetId,
    structuralPreset,
    selectError,
    isLoading,
    isListLoading: generatorPresetsQuery.isLoading,
  };
}
