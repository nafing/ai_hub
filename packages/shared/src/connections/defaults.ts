import type { Connection } from "./types";

/** Baseline values for a new connection form / create payload. */
export function defaultConnection(): Omit<Connection, "id"> {
  return {
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
