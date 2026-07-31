import type {
  LlmChatMessage,
  GeneratorCategory,
  PresetMarkerContent,
  PresetVariableValues,
} from "@ai-hub/shared";
import { promptPresetVariables } from "@/features/presets/PresetCommandBridge";
import { extractNeedsPresetVariables } from "@/features/presets/needsPresetVariables";
import { playAppSound } from "@/features/sounds";
import { api } from "@/lib/api";

export type RunGeneratorInput = {
  category: GeneratorCategory;
  connectionId?: string;
  /** When omitted, the server uses the default preset for the category. */
  presetId?: string;
  /** Injects Generator Preset prompt as `generator_prompt` marker. */
  generatorPresetId?: string;
  variables?: PresetVariableValues;
  markers?: PresetMarkerContent;
  userMessage?: string;
};

export type RunGeneratorResult = {
  content: string;
  thinking: string;
  reply: string;
  finishReason: string | null;
  model: string | null;
  messages: LlmChatMessage[];
};

/** Run a generator preset via `POST /generators/run`. */
export async function runGenerator(
  input: RunGeneratorInput,
): Promise<RunGeneratorResult> {
  let variables = { ...(input.variables ?? {}) };

  for (;;) {
    try {
      const { data } = await api.post<RunGeneratorResult>("/generators/run", {
        ...input,
        variables,
      });
      playAppSound("generator");
      return data;
    } catch (error) {
      const command = extractNeedsPresetVariables(error);
      if (!command) throw error;

      const chosen = await promptPresetVariables(
        command.presetId,
        command.variables,
      );
      if (!chosen) {
        throw new Error("Preset variables setup cancelled");
      }
      variables = { ...variables, ...chosen };
    }
  }
}
