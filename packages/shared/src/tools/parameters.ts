import type { ToolParameters } from "./types";

export function parseToolParametersJson(
  raw: string,
): { ok: true; value: ToolParameters } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Parameters must be valid JSON" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Parameters must be a JSON object" };
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.type !== "object") {
    return { ok: false, error: 'parameters.type must be "object"' };
  }
  if (
    !obj.properties ||
    typeof obj.properties !== "object" ||
    Array.isArray(obj.properties)
  ) {
    return {
      ok: false,
      error: "parameters.properties must be an object",
    };
  }
  if (
    obj.required !== undefined &&
    (!Array.isArray(obj.required) ||
      obj.required.some((item) => typeof item !== "string"))
  ) {
    return {
      ok: false,
      error: "parameters.required must be an array of strings",
    };
  }

  return { ok: true, value: obj as ToolParameters };
}

export function formatToolParametersJson(parameters: ToolParameters): string {
  return JSON.stringify(parameters, null, 2);
}

export function countToolParameters(parameters: ToolParameters): number {
  return Object.keys(parameters.properties ?? {}).length;
}
