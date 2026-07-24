import type {
  LlmChatMessage,
  GeneratorCategory,
  PresetMarkerContent,
  PresetVariableValues,
} from "@ai-hub/shared";
import { api } from "@/lib/api";

export type RunGeneratorInput = {
  category: GeneratorCategory;
  connectionId?: string;
  /** When omitted, the server uses the default preset for the category. */
  presetId?: string;
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
  const { data } = await api.post<RunGeneratorResult>("/generators/run", input);
  return data;
}
