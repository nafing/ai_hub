import type { Tool, ToolParameters } from "./types";

export function emptyToolParameters(): ToolParameters {
  return { type: "object", properties: {} };
}

/** Blank tool for user-created entries (never default). */
export function defaultTool(): Omit<Tool, "id"> {
  return {
    name: "",
    description: "",
    parameters: emptyToolParameters(),
    is_built_in: false,
  };
}

/** Stable DB id for a built-in default tool. */
export function defaultToolId(name: string): string {
  return `default:${name}`;
}
