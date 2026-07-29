import type { Connection } from "../connections/types";

export const CHAT_GENERATION_PARAMETER_SEND_KEYS = [
  "temperature",
  "max_completion_tokens",
  "top_p",
  "top_k",
  "frequency_penalty",
  "presence_penalty",
  "reasoning_effort",
  "verbosity",
] as const;

export type ChatGenerationParameterSendKey =
  (typeof CHAT_GENERATION_PARAMETER_SEND_KEYS)[number];

export type ChatGenerationParameterSendMap = Partial<
  Record<ChatGenerationParameterSendKey, boolean>
>;

/**
 * Chat-level generation overrides (Marinara `chatParameters`).
 * Sparse: omitted keys inherit from the chat's connection.
 */
export type ChatGenerationParameters = {
  temperature?: number;
  max_completion_tokens?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  assistant_prefill?: string;
  /**
   * Thinking wrappers — one per line, e.g. `<thinking>{{thinking}}</thinking>`.
   * Empty inherits the connection thinking tag.
   */
  thinking_tag?: string;
  custom_parameters?: Record<string, unknown>;
  service_tier?: string;
  reasoning_effort?: string;
  verbosity?: string;
  /**
   * When a key is `false`, that field is omitted from the provider body.
   * Missing key → use {@link DEFAULT_CHAT_PARAMETER_SEND}.
   */
  enabled_parameters?: ChatGenerationParameterSendMap;
};

/** Marinara STRICT_CONNECTION_PARAMETER_SEND_DEFAULTS for chat overrides. */
export const DEFAULT_CHAT_PARAMETER_SEND: Record<
  ChatGenerationParameterSendKey,
  boolean
> = {
  temperature: false,
  max_completion_tokens: true,
  top_p: false,
  top_k: false,
  frequency_penalty: false,
  presence_penalty: false,
  reasoning_effort: true,
  verbosity: false,
};

export type EffectiveChatGenerationParameters = {
  temperature: number;
  max_completion_tokens: number;
  top_p: number;
  top_k: number;
  frequency_penalty: number;
  presence_penalty: number;
  assistant_prefill: string;
  thinking_tag: string;
  custom_parameters: Record<string, unknown>;
  service_tier: string;
  reasoning_effort: string;
  verbosity: string;
  enabled_parameters: Record<ChatGenerationParameterSendKey, boolean>;
};

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function normalizeChatGenerationParameters(
  value: unknown,
): ChatGenerationParameters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const out: ChatGenerationParameters = {};

  if (typeof raw.temperature === "number" && Number.isFinite(raw.temperature)) {
    out.temperature = raw.temperature;
  }
  if (
    typeof raw.max_completion_tokens === "number" &&
    Number.isFinite(raw.max_completion_tokens)
  ) {
    out.max_completion_tokens = Math.max(1, Math.floor(raw.max_completion_tokens));
  }
  if (typeof raw.top_p === "number" && Number.isFinite(raw.top_p)) {
    out.top_p = raw.top_p;
  }
  if (typeof raw.top_k === "number" && Number.isFinite(raw.top_k)) {
    out.top_k = Math.max(0, Math.floor(raw.top_k));
  }
  if (
    typeof raw.frequency_penalty === "number" &&
    Number.isFinite(raw.frequency_penalty)
  ) {
    out.frequency_penalty = raw.frequency_penalty;
  }
  if (
    typeof raw.presence_penalty === "number" &&
    Number.isFinite(raw.presence_penalty)
  ) {
    out.presence_penalty = raw.presence_penalty;
  }
  if (typeof raw.assistant_prefill === "string") {
    out.assistant_prefill = raw.assistant_prefill;
  }
  if (typeof raw.thinking_tag === "string") {
    out.thinking_tag = raw.thinking_tag;
  }
  if (
    raw.custom_parameters &&
    typeof raw.custom_parameters === "object" &&
    !Array.isArray(raw.custom_parameters)
  ) {
    out.custom_parameters = raw.custom_parameters as Record<string, unknown>;
  }
  if (typeof raw.service_tier === "string") {
    out.service_tier = raw.service_tier;
  }
  if (typeof raw.reasoning_effort === "string") {
    out.reasoning_effort = raw.reasoning_effort;
  }
  if (typeof raw.verbosity === "string") {
    out.verbosity = raw.verbosity;
  }
  if (
    raw.enabled_parameters &&
    typeof raw.enabled_parameters === "object" &&
    !Array.isArray(raw.enabled_parameters)
  ) {
    const enabled: ChatGenerationParameterSendMap = {};
    for (const key of CHAT_GENERATION_PARAMETER_SEND_KEYS) {
      const flag = (raw.enabled_parameters as Record<string, unknown>)[key];
      if (typeof flag === "boolean") enabled[key] = flag;
    }
    if (Object.keys(enabled).length) out.enabled_parameters = enabled;
  }

  return out;
}

/** Display / edit values: connection baseline + chat sparse overrides. */
export function resolveEffectiveChatGenerationParameters(
  connection: Pick<
    Connection,
    | "temperature"
    | "max_completion_tokens"
    | "top_p"
    | "top_k"
    | "frequency_penalty"
    | "presence_penalty"
    | "assistant_prefill"
    | "thinking_tag"
    | "custom_parameters"
    | "service_tier"
    | "reasoning_effort"
    | "verbosity"
  >,
  chatParameters?: ChatGenerationParameters | null,
): EffectiveChatGenerationParameters {
  const overrides = normalizeChatGenerationParameters(chatParameters);
  const enabled = { ...DEFAULT_CHAT_PARAMETER_SEND };
  for (const key of CHAT_GENERATION_PARAMETER_SEND_KEYS) {
    const flag = overrides.enabled_parameters?.[key];
    if (typeof flag === "boolean") enabled[key] = flag;
  }

  return {
    temperature: asFiniteNumber(overrides.temperature, connection.temperature),
    max_completion_tokens: Math.max(
      1,
      Math.floor(
        asFiniteNumber(
          overrides.max_completion_tokens,
          connection.max_completion_tokens,
        ),
      ),
    ),
    top_p: asFiniteNumber(overrides.top_p, connection.top_p),
    top_k: Math.max(0, Math.floor(asFiniteNumber(overrides.top_k, connection.top_k))),
    frequency_penalty: asFiniteNumber(
      overrides.frequency_penalty,
      connection.frequency_penalty,
    ),
    presence_penalty: asFiniteNumber(
      overrides.presence_penalty,
      connection.presence_penalty,
    ),
    assistant_prefill: asString(
      overrides.assistant_prefill,
      connection.assistant_prefill,
    ),
    thinking_tag: asString(overrides.thinking_tag, connection.thinking_tag),
    custom_parameters: {
      ...(connection.custom_parameters ?? {}),
      ...(overrides.custom_parameters ?? {}),
    },
    service_tier: asString(overrides.service_tier, connection.service_tier),
    reasoning_effort: asString(
      overrides.reasoning_effort,
      connection.reasoning_effort,
    ),
    verbosity: asString(overrides.verbosity, connection.verbosity),
    enabled_parameters: enabled,
  };
}

/**
 * Connection-shaped values for OpenRouter when chat overrides are active.
 * When `chatParameters` is empty, returns the connection unchanged and
 * `useSendToggles: false` so legacy “always send sampling knobs” stays.
 */
export function connectionWithChatParameters(
  connection: Connection,
  chatParameters?: ChatGenerationParameters | null,
): {
  connection: Connection;
  enabled_parameters: Record<ChatGenerationParameterSendKey, boolean> | null;
} {
  const normalized = normalizeChatGenerationParameters(chatParameters);
  const hasOverrides = Object.keys(normalized).length > 0;
  if (!hasOverrides) {
    return { connection, enabled_parameters: null };
  }

  const effective = resolveEffectiveChatGenerationParameters(
    connection,
    normalized,
  );
  return {
    connection: {
      ...connection,
      temperature: effective.temperature,
      max_completion_tokens: effective.max_completion_tokens,
      top_p: effective.top_p,
      top_k: effective.top_k,
      frequency_penalty: effective.frequency_penalty,
      presence_penalty: effective.presence_penalty,
      assistant_prefill: effective.assistant_prefill,
      thinking_tag: effective.thinking_tag,
      custom_parameters: effective.custom_parameters,
      service_tier: effective.service_tier,
      reasoning_effort: effective.reasoning_effort,
      verbosity: effective.verbosity,
    },
    enabled_parameters: effective.enabled_parameters,
  };
}

export function shouldSendChatParameter(
  enabled: Record<ChatGenerationParameterSendKey, boolean> | null | undefined,
  key: ChatGenerationParameterSendKey,
): boolean {
  if (!enabled) return true;
  return enabled[key] !== false;
}
