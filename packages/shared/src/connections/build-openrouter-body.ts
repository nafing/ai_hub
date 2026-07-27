import type { Connection } from "./types";
import type { ChatMessage } from "../llm/types";

export type OpenRouterChatMessage = {
  role: string;
  content:
    | string
    | Array<{
        type: "text";
        text: string;
        cache_control?: { type: "ephemeral" };
      }>
    | null;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
};

export type OpenRouterChatBody = Record<string, unknown> & {
  model: string;
  messages: OpenRouterChatMessage[];
};

export type BuildOpenRouterBodyOptions = {
  stream?: boolean;
  /** Extra fields merged last (after connection.custom_parameters). */
  overrides?: Record<string, unknown>;
  /** OpenAI-compatible tools array. */
  tools?: unknown[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
};

/** Append connection assistant_prefill as a trailing assistant message when set. */
export function applyAssistantPrefill(
  messages: ChatMessage[],
  prefill: string | undefined | null,
): ChatMessage[] {
  const text = prefill?.trim();
  if (!text) return messages;
  return [...messages, { role: "assistant", content: text }];
}

/**
 * Apply Anthropic-style cache_control to the last text content of the first
 * system message (or first message) when prompt caching is enabled.
 */
export function withPromptCaching(
  messages: OpenRouterChatMessage[],
  enabled: boolean,
): OpenRouterChatMessage[] {
  if (!enabled || messages.length === 0) return messages;

  const cloned = messages.map((message) => ({ ...message }));
  const targetIndex = cloned.findIndex((message) => message.role === "system");
  const index = targetIndex >= 0 ? targetIndex : 0;
  const target = cloned[index]!;
  const text =
    typeof target.content === "string"
      ? target.content
      : Array.isArray(target.content)
        ? target.content.map((part) => part.text).join("\n")
        : "";

  cloned[index] = {
    ...target,
    content: [
      {
        type: "text",
        text,
        cache_control: { type: "ephemeral" },
      },
    ],
  };
  return cloned;
}

/** Map a Connection + chat messages into an OpenRouter chat completions body. */
export function buildOpenRouterBody(
  connection: Pick<
    Connection,
    | "model"
    | "preferred_provider"
    | "max_completion_tokens"
    | "temperature"
    | "top_p"
    | "top_k"
    | "frequency_penalty"
    | "presence_penalty"
    | "assistant_prefill"
    | "custom_parameters"
    | "service_tier"
    | "reasoning_effort"
    | "verbosity"
    | "prompt_caching"
  >,
  messages: ChatMessage[],
  options: BuildOpenRouterBodyOptions = {},
): OpenRouterChatBody {
  const withPrefill = applyAssistantPrefill(messages, connection.assistant_prefill);
  const openRouterMessages: OpenRouterChatMessage[] = withPrefill.map(
    (message) => {
      const mapped: OpenRouterChatMessage = {
        role: message.role,
        content: message.content,
      };
      if (message.tool_calls?.length) {
        (mapped as Record<string, unknown>).tool_calls = message.tool_calls;
      }
      if (message.tool_call_id) {
        (mapped as Record<string, unknown>).tool_call_id = message.tool_call_id;
      }
      if (message.name) {
        (mapped as Record<string, unknown>).name = message.name;
      }
      return mapped;
    },
  );

  const body: OpenRouterChatBody = {
    model: connection.model,
    messages: withPromptCaching(openRouterMessages, connection.prompt_caching),
    temperature: connection.temperature,
    top_p: connection.top_p,
    max_tokens: connection.max_completion_tokens,
    stream: options.stream !== false,
  };

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.tool_choice ?? "auto";
  }

  if (connection.frequency_penalty !== 0) {
    body.frequency_penalty = connection.frequency_penalty;
  }
  if (connection.presence_penalty !== 0) {
    body.presence_penalty = connection.presence_penalty;
  }

  if (connection.top_k > 0) {
    body.top_k = connection.top_k;
  }

  const provider = connection.preferred_provider.trim();
  if (provider) {
    body.provider = { order: [provider], allow_fallbacks: true };
  }

  const tier = connection.service_tier.trim();
  if (tier && tier !== "default") {
    body.service_tier = tier;
  }

  const effort = connection.reasoning_effort.trim();
  if (effort && effort !== "none") {
    body.reasoning = { effort };
  }

  const verbosity = connection.verbosity.trim();
  if (verbosity && verbosity !== "none") {
    body.verbosity = verbosity;
  }

  const custom = connection.custom_parameters;
  if (custom && typeof custom === "object" && !Array.isArray(custom)) {
    Object.assign(body, custom);
  }

  if (options.overrides) {
    Object.assign(body, options.overrides);
  }

  return body;
}
