import type { CreateLorebookInput } from "./api";
import { normalizeLorebook } from "./defaults";

export class LorebookImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LorebookImportError";
  }
}

/**
 * Parse a lorebook / character_book / SillyTavern World Info JSON document.
 */
export function parseLorebookJson(input: unknown): CreateLorebookInput {
  let value: unknown = input;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) throw new LorebookImportError("JSON is empty");
    try {
      value = JSON.parse(trimmed);
    } catch {
      throw new LorebookImportError("Invalid JSON");
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LorebookImportError("Lorebook must be a JSON object");
  }

  const root = value as Record<string, unknown>;

  // Unwrap common envelopes
  const unwrapped =
    (isPlainObject(root.character_book) ? root.character_book : null) ??
    (isPlainObject(root.lorebook) ? root.lorebook : null) ??
    (isPlainObject(root.data) && isPlainObject((root.data as Record<string, unknown>).character_book)
      ? ((root.data as Record<string, unknown>).character_book as Record<string, unknown>)
      : null) ??
    root;

  if (
    !Array.isArray(unwrapped.entries) &&
    !(
      unwrapped.entries &&
      typeof unwrapped.entries === "object" &&
      !Array.isArray(unwrapped.entries)
    ) &&
    typeof unwrapped.name !== "string"
  ) {
    throw new LorebookImportError(
      "JSON must include entries (array or map) or a lorebook name",
    );
  }

  const normalized = normalizeLorebook(unwrapped);
  if (!normalized.name.trim()) {
    normalized.name = "Imported lorebook";
  }
  return normalized;
}

export async function parseLorebookImportFile(
  file: Pick<File, "name" | "type">,
  bytes: ArrayBuffer,
): Promise<CreateLorebookInput> {
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
      throw new LorebookImportError(
        "Unsupported file type — use a .json lorebook / character_book export",
      );
    }
  }

  const text = new TextDecoder("utf-8").decode(bytes);
  return parseLorebookJson(text);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
