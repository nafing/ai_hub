export type Connection = {
  // UUID
  id: string;
  // Name of the connection
  // A friendly name to identify this connection. Use something descriptive like 'Claude Sonnet — RP' or 'GPT-4o Main'.
  name: string;
  // Preferred provider of the connection
  // Choose which backend provider OpenRouter should route your requests to. Leave empty to let OpenRouter choose automatically based on price and availability.
  // Fetch them from the provider's API documentation (/api/v1/models/{canonical_slug}/endpoints).
  preferred_provider: string;
  // API key of the connection
  // Your authentication key from the AI provider. You can get one from their website. It's like a password that lets AI-HUB talk to the AI service.
  api_key: string;
  // Model of the connection
  // The specific AI model to use. You can pick from the list or type a custom model ID directly.
  model: string;
  // Max paraller agent jobs that can be run on the connection
  // How many agent LLM requests AI-HUB may run at once for this connection. Higher values can speed up agent-heavy chats on providers that tolerate parallel calls.
  max_parallel_jobs: number;

  // Max completion tokens of the connection
  // The maximum number of tokens this model can process at once (your messages + its reply). This is auto-set when you pick a model from the list.
  max_completion_tokens: number;

  // Temperature of the connection
  // Controls randomness. Lower values make output more focused and deterministic; higher values make it more creative and varied.
  temperature: number;
  // Context length of the connection
  // The maximum number of tokens the model can generate in a single response. Higher values allow longer replies.
  context_length: number;
  // Top P of the connection
  // Nucleus sampling: only considers tokens whose cumulative probability reaches this threshold. Lower values make output more focused.
  top_p: number;
  // Top K of the connection
  // Limits the model to only consider the top K most likely tokens at each step. 0 disables this limit.
  top_k: number;
  // Frequency penalty of the connection
  // Penalizes tokens based on how often they've already appeared. Positive values reduce repetition; negative values encourage it.
  frequency_penalty: number;
  // Presence penalty of the connection
  // Penalizes tokens that have appeared at all, regardless of frequency. Positive values encourage the model to talk about new topics.
  presence_penalty: number;

  // Assistant Prefill of the connection
  // Optional assistant-role text appended after the final user message. Use this only for models that support assistant prefill/continuation or need a specific opening tag.
  // Example: <thinking>
  assistant_prefill: string;
  // Thinking Tag of the connection
  // {{thinking}} marks the hidden reasoning slot and will be replaced by any content between the specified tags. Built-in think, thinking, thought, pipe, channel, and bracket pairs are already recognized.
  // Example: <thinking>{{thinking}}</thinking>
  thinking_tag: string;
  // Custom Parameters of the connection
  // Optional raw JSON object merged into the provider request body. This can break requests if the provider does not support a key.
  // Fetch them from the provider's API documentation (supported_parameters).
  // Example: { "reasoning_effort": "high" }
  custom_parameters: Record<string, unknown>;
  // Service Tier of the connection
  // Optional OpenRouter routing tier. Default sends no service_tier; Flex can be cheaper and slower, Priority can be faster and more expensive.
  service_tier: string;
  // Reasoning Effort of the connection
  // How much reasoning work the provider should spend before responding. Unsupported tiers are lowered to the strongest compatible tier automatically.
  reasoning_effort: string;
  // Verbosity of the connection
  // Controls how long and detailed responses should be. Low keeps things concise; high encourages elaborate, descriptive output.
  verbosity: string;
  // Prompt Caching
  // For OpenRouter Claude models, sends the cache_control flag needed for Anthropic prompt caching. Most non-Claude OpenRouter models cache automatically and do not need this toggle.
  prompt_caching: boolean;
  // Default connection
  // When true, this connection is the active/default one used by the app. Only one connection can be default at a time.
  is_default: boolean;
};
