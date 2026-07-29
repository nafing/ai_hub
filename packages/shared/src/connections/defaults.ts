import type { Connection } from "./types";
import type { ConnectionKind } from "./constants";

/** Baseline values for a new LLM connection form / create payload. */
export function defaultConnection(): Omit<Connection, "id"> {
  return {
    kind: "llm",
    name: "",
    preferred_provider: "",
    api_key: "",
    model: "",
    max_parallel_jobs: 1,
    max_completion_tokens: 4096,
    temperature: 1,
    context_length: 128000,
    top_p: 1,
    top_k: 0,
    frequency_penalty: 0,
    presence_penalty: 0,
    assistant_prefill: "",
    thinking_tag: "",
    custom_parameters: {},
    service_tier: "",
    reasoning_effort: "",
    verbosity: "",
    prompt_caching: false,
    is_default: false,
  };
}

/** Baseline values for a new image generation connection. */
export function defaultImageConnection(): Omit<Connection, "id"> {
  return {
    ...defaultConnection(),
    kind: "image",
    max_completion_tokens: 1,
    context_length: 1,
  };
}

export function defaultConnectionForKind(
  kind: ConnectionKind,
): Omit<Connection, "id"> {
  return kind === "image" ? defaultImageConnection() : defaultConnection();
}
