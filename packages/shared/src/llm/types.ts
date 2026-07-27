export type ChatMessageRole = "system" | "user" | "assistant" | "tool";

export type LlmToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage = {
  role: ChatMessageRole;
  content: string;
  /** Present on assistant messages that request tool calls. */
  tool_calls?: LlmToolCall[];
  /** Present on tool result messages. */
  tool_call_id?: string;
  name?: string;
};
