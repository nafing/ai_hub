import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  selectedVariableValues,
  type PresetVariableValues,
  type Variable,
} from "@ai-hub/shared";
import { notifications } from "@/components/ui";
import { persistPresetVariableSelection } from "./persistPresetVariableSelection";
import { presetKeys } from "@/features/api-queries/presets/queries";
import { SetupVariablesModal } from "@/features/modals/presets/SetupVariablesModal";

type PromptPresetVariables = (
  presetId: string,
  variables: Variable[],
) => Promise<PresetVariableValues | null>;

type PendingPrompt = {
  presetId: string;
  variables: Variable[];
  resolve: (values: PresetVariableValues | null) => void;
};

const PresetCommandContext = createContext<PromptPresetVariables | null>(null);

let registeredPrompt: PromptPresetVariables | null = null;

/** Imperative entry for non-React callers (API wrappers). */
export function promptPresetVariables(
  presetId: string,
  variables: Variable[],
): Promise<PresetVariableValues | null> {
  if (!registeredPrompt) {
    return Promise.resolve(null);
  }
  return registeredPrompt(presetId, variables);
}

export function usePromptPresetVariables(): PromptPresetVariables {
  const prompt = useContext(PresetCommandContext);
  if (!prompt) {
    throw new Error(
      "usePromptPresetVariables must be used within PresetCommandBridge",
    );
  }
  return prompt;
}

export function PresetCommandBridge({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef<PendingPrompt | null>(null);

  function settle(values: PresetVariableValues | null) {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    setSaving(false);
    current?.resolve(values);
  }

  const prompt: PromptPresetVariables = (presetId, variables) => {
    if (variables.length === 0) {
      return Promise.resolve({});
    }
    return new Promise((resolve) => {
      const next: PendingPrompt = { presetId, variables, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  };

  useEffect(() => {
    registeredPrompt = prompt;
    return () => {
      if (registeredPrompt === prompt) {
        registeredPrompt = null;
      }
    };
  });

  async function handleApply(variables: Variable[]) {
    const current = pendingRef.current;
    if (!current) return;
    setSaving(true);
    try {
      const saved = await persistPresetVariableSelection(
        current.presetId,
        variables,
      );
      queryClient.setQueryData(presetKeys.detail(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: presetKeys.all });
      settle(selectedVariableValues(variables));
    } catch (error) {
      notifications.show({
        title: "Variables save failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
      setSaving(false);
      settle(null);
    }
  }

  return (
    <PresetCommandContext.Provider value={prompt}>
      {children}
      <SetupVariablesModal
        opened={pending != null && !saving}
        variables={pending?.variables ?? []}
        onClose={() => settle(null)}
        onApply={(variables) => {
          void handleApply(variables);
        }}
      />
    </PresetCommandContext.Provider>
  );
}
