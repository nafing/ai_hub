import {
  buildOpenRouterBody,
  buildPromptMessages,
  extractThinking,
  type BuildOpenRouterBodyOptions,
  type BuildPromptOptions,
  type LlmChatMessage,
  type Connection,
  type Preset,
} from "@ai-hub/shared";
import {
  openRouterChatCompletion,
  type OpenRouterChatResult,
  type OpenRouterRequestOptions,
  type OpenRouterStreamHandlers,
} from "./client";

export type CompleteWithConnectionOptions = {
  /** Extra messages appended after the preset-built prompt. */
  appendMessages?: LlmChatMessage[];
  prompt?: BuildPromptOptions;
  body?: BuildOpenRouterBodyOptions;
  request?: OpenRouterRequestOptions;
  /**
   * When true (default), strip thinking tags from the reply using
   * `connection.thinking_tag` (and built-in pairs).
   */
  parseThinking?: boolean;
  /** When set, receives raw OpenRouter stream deltas while buffering. */
  stream?: OpenRouterStreamHandlers;
};

export type CompleteWithConnectionResult = OpenRouterChatResult & {
  messages: LlmChatMessage[];
  thinking: string;
  content: string;
};

/** Build messages from a preset, call OpenRouter with connection settings. */
export async function completeWithConnectionAndPreset(
  connection: Connection,
  preset: Pick<Preset, "wrap_format" | "sections">,
  options: CompleteWithConnectionOptions = {},
): Promise<CompleteWithConnectionResult> {
  const promptMessages = buildPromptMessages(preset, options.prompt);
  const messages = [
    ...promptMessages,
    ...(options.appendMessages ?? []),
  ];

  const body = buildOpenRouterBody(connection, messages, options.body);
  const result = await openRouterChatCompletion(
    connection.api_key,
    body,
    options.request,
    options.stream,
  );

  const shouldParse = options.parseThinking !== false;
  const parsed = shouldParse
    ? extractThinking(result.reply, connection.thinking_tag)
    : { thinking: result.reasoning, content: result.reply };

  return {
    ...result,
    messages,
    thinking: parsed.thinking || result.reasoning,
    content: parsed.content,
  };
}

/** Call OpenRouter using a connection and an already-built message list. */
export async function completeWithConnection(
  connection: Connection,
  messages: LlmChatMessage[],
  options: Omit<CompleteWithConnectionOptions, "prompt" | "appendMessages"> = {},
): Promise<CompleteWithConnectionResult> {
  const body = buildOpenRouterBody(connection, messages, options.body);
  const result = await openRouterChatCompletion(
    connection.api_key,
    body,
    options.request,
    options.stream,
  );

  const shouldParse = options.parseThinking !== false;
  const parsed = shouldParse
    ? extractThinking(result.reply, connection.thinking_tag)
    : { thinking: result.reasoning, content: result.reply };

  return {
    ...result,
    messages,
    thinking: parsed.thinking || result.reasoning,
    content: parsed.content,
  };
}
