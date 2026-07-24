/**
 * LLM function-tool definition (OpenAI / OpenRouter style).
 */
export type ToolDefinition = {
  /** Snake_case function name exposed to the model. */
  name: string;
  /** When / how the model should call this tool. */
  description: string;
  /** JSON Schema for the function arguments (type object). */
  parameters: ToolParameters;
};

/** JSON Schema object for tool arguments. */
export type ToolParameters = {
  type: "object";
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
};

/** Loosely typed JSON Schema property (enough for editor + LLM). */
export type ToolParameterProperty = {
  type?: string;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  items?: ToolParameterProperty | { type: string };
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
  [key: string]: unknown;
};

/**
 * Persisted tool (definition + hub metadata).
 */
export type Tool = ToolDefinition & {
  id: string;
  /**
   * Built-in tools seeded on startup. Cannot be deleted.
   * User-created tools always have `is_built_in: false`.
   */
  is_built_in: boolean;
};

/** OpenAI/OpenRouter tools array entry. */
export type LlmToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolParameters;
  };
};
