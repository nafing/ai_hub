import {
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import type { OpenRouterChatBody } from "@ai-hub/shared";
import { decodeImageDataUrl } from "../images/data-url";
import { inferImageMimeFromContentType } from "../mime";

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export type OpenRouterChatChoice = {
  index?: number;
  message?: {
    role?: string;
    content?: string | null;
    reasoning?: string | null;
    tool_calls?: Array<{
      id?: string;
      type?: string;
      function?: { name?: string; arguments?: string };
    }>;
  };
  delta?: {
    role?: string;
    content?: string | null;
    reasoning?: string | null;
  };
  finish_reason?: string | null;
};

export type OpenRouterChatResponse = {
  id?: string;
  model?: string;
  choices?: OpenRouterChatChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: string | number };
};

export type OpenRouterChatResult = {
  reply: string;
  reasoning: string;
  finishReason: string | null;
  model: string | null;
  toolCalls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  raw: OpenRouterChatResponse;
};

export type OpenRouterRequestOptions = {
  signal?: AbortSignal;
  /** Optional app attribution headers. */
  referer?: string;
  title?: string;
};

/** Callbacks for raw OpenRouter SSE deltas (content / reasoning). */
export type OpenRouterStreamHandlers = {
  onContentDelta?: (delta: string) => void;
  onReasoningDelta?: (delta: string) => void;
};

function openRouterHeaders(
  apiKey: string,
  options: OpenRouterRequestOptions = {},
  streaming = false,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: streaming ? "text/event-stream" : "application/json",
    "Content-Type": "application/json",
  };
  if (options.referer) headers["HTTP-Referer"] = options.referer;
  if (options.title) headers["X-Title"] = options.title;
  return headers;
}

export async function openRouterGetJson<T>(
  url: string,
  apiKey: string,
  options: OpenRouterRequestOptions = {},
): Promise<T> {
  if (!apiKey.trim()) {
    throw new BadRequestException("OpenRouter API key is required");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: openRouterHeaders(apiKey, options),
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new BadRequestException(
      `Failed to reach OpenRouter: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return handleOpenRouterResponse<T>(response);
}

export async function openRouterChatCompletion(
  apiKey: string,
  body: OpenRouterChatBody,
  options: OpenRouterRequestOptions = {},
  streamHandlers?: OpenRouterStreamHandlers,
): Promise<OpenRouterChatResult> {
  if (!apiKey.trim()) {
    throw new BadRequestException("OpenRouter API key is required");
  }
  if (!body.model?.trim()) {
    throw new BadRequestException("Connection model is required");
  }

  const streaming = body.stream !== false;
  const payload: OpenRouterChatBody = { ...body, stream: streaming };

  // Debug: inspect what we send to OpenRouter (api key never logged).
  console.log(
    "[openrouter] POST /chat/completions",
    JSON.stringify(
      {
        model: payload.model,
        messages: payload.messages,
        temperature: payload.temperature,
        top_p: payload.top_p,
        top_k: payload.top_k,
        max_tokens: payload.max_tokens,
        frequency_penalty: payload.frequency_penalty,
        presence_penalty: payload.presence_penalty,
        provider: payload.provider,
        service_tier: payload.service_tier,
        reasoning: payload.reasoning,
        verbosity: payload.verbosity,
        stream: payload.stream,
      },
      null,
      2,
    ),
  );

  let response: Response;
  try {
    response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: openRouterHeaders(apiKey, options, streaming),
      body: JSON.stringify(payload),
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new BadRequestException(
      `Failed to reach OpenRouter: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  assertOpenRouterAuth(response);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new BadRequestException(
      `OpenRouter error ${response.status}: ${errorBody || response.statusText}`,
    );
  }

  const result = streaming
    ? await readStreamingChatCompletion(response, streamHandlers)
    : await readJsonChatCompletion(response);

  console.log(
    "[openrouter] response",
    JSON.stringify(
      {
        model: result.model,
        finish_reason: result.finishReason,
        reply: result.reply,
        usage: result.raw.usage ?? null,
      },
      null,
      2,
    ),
  );

  return result;
}

async function readJsonChatCompletion(
  response: Response,
): Promise<OpenRouterChatResult> {
  const raw = (await response.json()) as OpenRouterChatResponse;
  if (raw.error?.message) {
    throw new BadRequestException(`OpenRouter error: ${raw.error.message}`);
  }

  const choice = raw.choices?.[0];
  const toolCalls = (choice?.message?.tool_calls ?? [])
    .map((call) => {
      const id = call.id?.trim();
      const name = call.function?.name?.trim();
      if (!id || !name) return null;
      return {
        id,
        type: "function" as const,
        function: {
          name,
          arguments: call.function?.arguments ?? "{}",
        },
      };
    })
    .filter(
      (
        call,
      ): call is {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      } => Boolean(call),
    );

  return {
    reply: choice?.message?.content?.trim() ?? "",
    reasoning: choice?.message?.reasoning?.trim() ?? "",
    finishReason: choice?.finish_reason ?? null,
    model: raw.model ?? null,
    toolCalls,
    raw,
  };
}

async function readStreamingChatCompletion(
  response: Response,
  streamHandlers?: OpenRouterStreamHandlers,
): Promise<OpenRouterChatResult> {
  if (!response.body) {
    throw new BadRequestException("OpenRouter returned an empty stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let reasoning = "";
  let finishReason: string | null = null;
  let model: string | null = null;
  let usage: OpenRouterChatResponse["usage"];
  let lastChunk: OpenRouterChatResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      let chunk: OpenRouterChatResponse;
      try {
        chunk = JSON.parse(data) as OpenRouterChatResponse;
      } catch {
        continue;
      }

      if (chunk.error?.message) {
        throw new BadRequestException(`OpenRouter error: ${chunk.error.message}`);
      }

      lastChunk = chunk;
      if (chunk.model) model = chunk.model;
      if (chunk.usage) usage = chunk.usage;

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const deltaContent = choice.delta?.content;
      if (typeof deltaContent === "string" && deltaContent) {
        reply += deltaContent;
        streamHandlers?.onContentDelta?.(deltaContent);
      }

      const deltaReasoning = choice.delta?.reasoning;
      if (typeof deltaReasoning === "string" && deltaReasoning) {
        reasoning += deltaReasoning;
        streamHandlers?.onReasoningDelta?.(deltaReasoning);
      }

      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  return {
    reply: reply.trim(),
    reasoning: reasoning.trim(),
    finishReason,
    model,
    toolCalls: [],
    raw: {
      ...(lastChunk ?? {}),
      model: model ?? lastChunk?.model,
      usage,
      choices: [
        {
          message: {
            role: "assistant",
            content: reply,
            reasoning: reasoning || null,
          },
          finish_reason: finishReason,
        },
      ],
    },
  };
}

function assertOpenRouterAuth(response: Response): void {
  if (response.status === 401 || response.status === 403) {
    throw new UnauthorizedException("OpenRouter rejected the API key");
  }
}

async function handleOpenRouterResponse<T>(response: Response): Promise<T> {
  assertOpenRouterAuth(response);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new BadRequestException(
      `OpenRouter error ${response.status}: ${body || response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export type OpenRouterImageGenerationResult = {
  buffer: Buffer;
  mime: "image/png" | "image/jpeg" | "image/webp";
  model: string | null;
};

type OpenRouterImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
    media_type?: string | null;
  }>;
  error?: { message?: string; code?: string | number };
  model?: string;
};

/** Generate an image via OpenRouter `POST /images`. */
export async function openRouterGenerateImage(
  apiKey: string,
  input: {
    model: string;
    prompt: string;
    preferredProvider?: string | null;
    aspectRatio?: string;
    resolution?: string;
    outputFormat?: "png" | "jpeg" | "webp";
  },
  options: OpenRouterRequestOptions = {},
): Promise<OpenRouterImageGenerationResult> {
  if (!apiKey.trim()) {
    throw new BadRequestException("OpenRouter API key is required");
  }
  if (!input.model.trim()) {
    throw new BadRequestException("Image connection model is required");
  }
  if (!input.prompt.trim()) {
    throw new BadRequestException("Image prompt is required");
  }

  const capabilities = await fetchImageModelCapabilities(
    apiKey,
    input.model.trim(),
    options,
  );

  const preferred = input.preferredProvider?.trim();
  const body = buildImageRequestBody(input, capabilities, preferred);

  let raw = await postOpenRouterImage(apiKey, body, options);

  // Google (and some other providers) return a generic 400 for unsupported args.
  // Retry once with only model + prompt if we sent any optional fields.
  if (
    isOpenRouterImageInvalidArgument(raw) &&
    Object.keys(body).some((key) => key !== "model" && key !== "prompt")
  ) {
    console.warn(
      `[openrouter] images 400 for ${input.model}; retrying with prompt-only body`,
      raw.error?.message || raw.httpErrorText || "",
    );
    raw = await postOpenRouterImage(
      apiKey,
      {
        model: input.model.trim(),
        prompt: input.prompt.trim(),
      },
      options,
    );
  }

  if (raw.error?.message || raw.httpStatus) {
    const detail =
      raw.error?.message ||
      raw.httpErrorText ||
      `HTTP ${raw.httpStatus ?? "error"}`;
    console.warn(`[openrouter] images failed for ${input.model}: ${detail}`);
    throw new BadRequestException(`OpenRouter images error: ${detail}`);
  }

  const item = raw.data?.[0];
  if (!item) {
    throw new BadRequestException("OpenRouter returned no image data");
  }

  if (item.b64_json?.trim()) {
    const decoded = decodeImageBase64(item.b64_json.trim(), item.media_type);
    return {
      buffer: decoded.buffer,
      mime: decoded.mime,
      model: raw.model ?? input.model,
    };
  }

  if (item.url?.trim()) {
    const downloaded = await downloadImageUrl(item.url.trim(), options.signal);
    return {
      buffer: downloaded.buffer,
      mime: downloaded.mime,
      model: raw.model ?? input.model,
    };
  }

  throw new BadRequestException("OpenRouter image response missing b64_json/url");
}

type ImageParamCapability =
  | { type: "enum"; values: string[] }
  | { type: "range"; min: number; max: number }
  | { type: "boolean" }
  | { type: "unknown" };

type ImageModelCapabilities = {
  /** True when OpenRouter returned any supported_parameters for this model. */
  known: boolean;
  supports: (key: string) => boolean;
  capability: (key: string) => ImageParamCapability | undefined;
};

function buildImageRequestBody(
  input: {
    model: string;
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    outputFormat?: "png" | "jpeg" | "webp";
  },
  capabilities: ImageModelCapabilities,
  preferredProvider?: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.model.trim(),
    prompt: input.prompt.trim(),
  };

  // Without capability metadata, only send required fields — Google rejects
  // unknown optional args (n / output_format / unsupported resolution) with 400.
  if (!capabilities.known) {
    if (preferredProvider) {
      body.provider = { order: [preferredProvider], allow_fallbacks: true };
    }
    return body;
  }

  if (capabilities.supports("n")) {
    body.n = 1;
  }

  const aspectRatio = pickOptionalParam(
    capabilities,
    "aspect_ratio",
    input.aspectRatio,
  );
  if (aspectRatio) body.aspect_ratio = aspectRatio;

  const resolution = pickOptionalResolution(capabilities, input.resolution);
  if (resolution) body.resolution = resolution;

  const outputFormat = pickOptionalParam(
    capabilities,
    "output_format",
    input.outputFormat,
  );
  if (outputFormat) body.output_format = outputFormat;

  if (preferredProvider) {
    body.provider = { order: [preferredProvider], allow_fallbacks: true };
  }

  return body;
}

async function postOpenRouterImage(
  apiKey: string,
  body: Record<string, unknown>,
  options: OpenRouterRequestOptions,
): Promise<OpenRouterImageResponse & { httpStatus?: number; httpErrorText?: string }> {
  let response: Response;
  try {
    response = await fetch(`${OPENROUTER_BASE}/images`, {
      method: "POST",
      headers: openRouterHeaders(apiKey, options, false),
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new BadRequestException(
      `Failed to reach OpenRouter images: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  assertOpenRouterAuth(response);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    // Surface as a structured error so callers can retry on invalid-argument.
    let parsed: OpenRouterImageResponse | null = null;
    try {
      parsed = JSON.parse(errorBody) as OpenRouterImageResponse;
    } catch {
      parsed = null;
    }
    if (parsed?.error || response.status === 400) {
      return {
        ...(parsed ?? {}),
        error: parsed?.error ?? {
          message: errorBody || response.statusText,
          code: response.status,
        },
        httpStatus: response.status,
        httpErrorText: errorBody,
      };
    }
    throw new BadRequestException(
      `OpenRouter images error ${response.status}: ${errorBody || response.statusText}`,
    );
  }

  return (await response.json()) as OpenRouterImageResponse;
}

function isOpenRouterImageInvalidArgument(
  raw: OpenRouterImageResponse & { httpStatus?: number; httpErrorText?: string },
): boolean {
  if (raw.httpStatus === 400) return true;
  const message = (raw.error?.message || raw.httpErrorText || "").toLowerCase();
  return (
    message.includes("invalid argument") ||
    message.includes("unsupported") ||
    message.includes("not supported")
  );
}

async function fetchImageModelCapabilities(
  apiKey: string,
  modelId: string,
  options: OpenRouterRequestOptions,
): Promise<ImageModelCapabilities> {
  const empty: ImageModelCapabilities = {
    known: false,
    supports: () => false,
    capability: () => undefined,
  };

  try {
    const path = modelId
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    // Prefer per-endpoint truth; fall back to model-level union.
    const endpointsPayload = await openRouterGetJson<{
      data?: {
        endpoints?: Array<{
          supported_parameters?: Record<string, unknown> | string[];
        }>;
      };
      endpoints?: Array<{
        supported_parameters?: Record<string, unknown> | string[];
      }>;
    }>(`${OPENROUTER_BASE}/images/models/${path}/endpoints`, apiKey, options);

    const endpoints =
      endpointsPayload.data?.endpoints ?? endpointsPayload.endpoints ?? [];
    const params: Record<string, ImageParamCapability> = {};
    for (const endpoint of endpoints) {
      mergeSupportedParameters(params, endpoint.supported_parameters);
    }

    if (Object.keys(params).length === 0) {
      const modelsPayload = await openRouterGetJson<{
        data?: Array<{
          id?: string;
          supported_parameters?: Record<string, unknown> | string[];
        }>;
      }>(`${OPENROUTER_BASE}/images/models`, apiKey, options);
      const model = (modelsPayload.data ?? []).find((item) => item.id === modelId);
      mergeSupportedParameters(params, model?.supported_parameters);
    }

    const known = Object.keys(params).length > 0;
    return {
      known,
      supports: (key) => Object.prototype.hasOwnProperty.call(params, key),
      capability: (key) => params[key],
    };
  } catch (error) {
    console.warn(
      `[openrouter] image capabilities lookup failed for ${modelId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    // Conservative fallback: send only prompt+model (always valid).
    return empty;
  }
}

function mergeSupportedParameters(
  target: Record<string, ImageParamCapability>,
  raw: Record<string, unknown> | string[] | undefined,
): void {
  if (!raw) return;
  if (Array.isArray(raw)) {
    for (const key of raw) {
      if (typeof key === "string" && key && !target[key]) {
        target[key] = { type: "unknown" };
      }
    }
    return;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!key) continue;
    const parsed = parseCapability(value);
    if (!parsed) continue;
    const existing = target[key];
    if (!existing) {
      target[key] = parsed;
      continue;
    }
    if (existing.type === "enum" && parsed.type === "enum") {
      target[key] = {
        type: "enum",
        values: Array.from(new Set([...existing.values, ...parsed.values])),
      };
    } else if (existing.type === "unknown" && parsed.type !== "unknown") {
      target[key] = parsed;
    }
  }
}

function parseCapability(value: unknown): ImageParamCapability | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (value === true) return { type: "boolean" };
    return { type: "unknown" };
  }
  const record = value as Record<string, unknown>;
  if (record.type === "enum" && Array.isArray(record.values)) {
    return {
      type: "enum",
      values: record.values.filter((item): item is string => typeof item === "string"),
    };
  }
  if (
    record.type === "range" &&
    typeof record.min === "number" &&
    typeof record.max === "number"
  ) {
    return { type: "range", min: record.min, max: record.max };
  }
  if (record.type === "boolean") return { type: "boolean" };
  return { type: "unknown" };
}

function pickOptionalParam(
  capabilities: ImageModelCapabilities,
  key: string,
  requested: string | undefined,
): string | undefined {
  if (!requested?.trim()) return undefined;
  if (!capabilities.supports(key)) return undefined;
  const value = requested.trim();
  const cap = capabilities.capability(key);
  if (cap?.type === "enum") {
    if (cap.values.includes(value)) return value;
    return undefined;
  }
  // Supported but untyped → pass through.
  return value;
}

function pickOptionalResolution(
  capabilities: ImageModelCapabilities,
  requested: string | undefined,
): string | undefined {
  if (!requested?.trim()) return undefined;
  if (!capabilities.supports("resolution")) return undefined;
  const value = requested.trim();
  const aliases: Record<string, string[]> = {
    "512": ["512", "0.5K", "0.5k"],
    "0.5K": ["0.5K", "0.5k", "512"],
    "1K": ["1K", "1k"],
    "2K": ["2K", "2k"],
    "4K": ["4K", "4k"],
  };
  const fallbacks: Record<string, string[]> = {
    "512": ["0.5K", "1K"],
    "0.5K": ["512", "1K"],
    "1K": ["2K"],
    "2K": ["1K", "4K"],
    "4K": ["2K", "1K"],
  };
  const cap = capabilities.capability("resolution");
  if (cap?.type !== "enum") return value;

  const allowed = cap.values;
  if (allowed.includes(value)) return value;
  for (const candidate of aliases[value] ?? []) {
    const match = allowed.find(
      (item) => item.toLowerCase() === candidate.toLowerCase(),
    );
    if (match) return match;
  }
  for (const candidate of fallbacks[value] ?? []) {
    const match = allowed.find(
      (item) => item.toLowerCase() === candidate.toLowerCase(),
    );
    if (match) return match;
  }
  return undefined;
}

function decodeImageBase64(
  value: string,
  mediaType?: string | null,
): {
  buffer: Buffer;
  mime: "image/png" | "image/jpeg" | "image/webp";
} {
  if (value.trim().startsWith("data:")) {
    const decoded = decodeImageDataUrl(value);
    return { buffer: decoded.buffer, mime: decoded.mime };
  }
  return {
    buffer: Buffer.from(value, "base64"),
    mime: inferImageMimeFromContentType(mediaType),
  };
}
async function downloadImageUrl(
  url: string,
  signal?: AbortSignal,
): Promise<{ buffer: Buffer; mime: "image/png" | "image/jpeg" | "image/webp" }> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new BadRequestException(
      `Failed to download generated image (${response.status})`,
    );
  }
  const contentType = response.headers.get("content-type");
  const mime = inferImageMimeFromContentType(contentType);
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mime };
}
