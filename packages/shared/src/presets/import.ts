import type { CreatePresetInput } from "./api";
import { normalizePreset, toPresetExport } from "./defaults";

export class PresetImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresetImportError";
  }
}

/**
 * Parse a hub preset JSON document (plain fields or `{ preset: … }` envelope).
 */
export function parsePresetJson(input: unknown): CreatePresetInput {
  let value: unknown = input;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) throw new PresetImportError("JSON is empty");
    try {
      value = JSON.parse(trimmed);
    } catch {
      throw new PresetImportError("Invalid JSON");
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PresetImportError("Preset must be a JSON object");
  }

  const root = value as Record<string, unknown>;
  const unwrapped = isPlainObject(root.preset) ? root.preset : root;

  if (
    typeof unwrapped.name !== "string" &&
    !Array.isArray(unwrapped.sections) &&
    !Array.isArray(unwrapped.variables)
  ) {
    throw new PresetImportError(
      "JSON must include name, sections, or variables",
    );
  }

  const normalized = normalizePreset(unwrapped);
  // Never steal the active default on import.
  normalized.is_default = false;
  if (!normalized.name.trim()) {
    normalized.name = "Imported preset";
  }
  return normalized;
}

export async function parsePresetImportFile(
  file: Pick<File, "name" | "type">,
  bytes: ArrayBuffer,
): Promise<CreatePresetInput> {
  const name = file.name.toLowerCase();
  const isJson =
    name.endsWith(".json") ||
    file.type === "application/json" ||
    file.type === "text/json";

  if (!isJson) {
    const sample = new TextDecoder("utf-8")
      .decode(bytes.slice(0, 64))
      .trimStart();
    if (!sample.startsWith("{") && !sample.startsWith("[")) {
      throw new PresetImportError(
        "Unsupported file type — use a .json preset export",
      );
    }
  }

  const text = new TextDecoder("utf-8").decode(bytes);
  return parsePresetJson(text);
}

/** Re-export for callers that only touch the import module. */
export { toPresetExport };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
