import {
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import type { OpenRouterChatBody } from "@ai-hub/shared";

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export type OpenRouterChatChoice = {
  index?: number;
  message?: {
    role?: string;
    content?: string | null;
    reasoning?: string | null;
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
  return {
    reply: choice?.message?.content?.trim() ?? "",
    reasoning: choice?.message?.reasoning?.trim() ?? "",
    finishReason: choice?.finish_reason ?? null,
    model: raw.model ?? null,
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
