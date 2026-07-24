import type { LlmToolDefinition, Tool, ToolDefinition } from "./types";

/** Convert a hub Tool / ToolDefinition into an OpenRouter/OpenAI tools[] entry. */
export function toLlmToolDefinition(
  tool: ToolDefinition | Tool,
): LlmToolDefinition {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

export function toLlmToolDefinitions(
  tools: Array<ToolDefinition | Tool>,
): LlmToolDefinition[] {
  return tools
    .filter((tool) => Boolean(tool.name.trim()))
    .map(toLlmToolDefinition);
}

/** Basic check that `name` is a valid LLM function name. */
export function isValidToolName(name: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name);
}
