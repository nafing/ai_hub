import type { CreatePersonaInput } from "./api";
import { normalizePersona, toPersonaExport } from "./defaults";

export class PersonaImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersonaImportError";
  }
}

/**
 * Parse a hub persona JSON document (plain fields or `{ persona: … }` envelope).
 */
export function parsePersonaJson(input: unknown): CreatePersonaInput {
  let value: unknown = input;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) throw new PersonaImportError("JSON is empty");
    try {
      value = JSON.parse(trimmed);
    } catch {
      throw new PersonaImportError("Invalid JSON");
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PersonaImportError("Persona must be a JSON object");
  }

  const root = value as Record<string, unknown>;
  const unwrapped =
    isPlainObject(root.persona) ? root.persona : root;

  if (
    typeof unwrapped.name !== "string" &&
    typeof unwrapped.description !== "string" &&
    typeof unwrapped.personality !== "string"
  ) {
    throw new PersonaImportError(
      "JSON must include name, description, or personality",
    );
  }

  const normalized = normalizePersona(unwrapped);
  // Never steal the active default on import.
  normalized.is_default = false;
  if (!normalized.name.trim()) {
    normalized.name = "Imported persona";
  }
  return normalized;
}

export async function parsePersonaImportFile(
  file: Pick<File, "name" | "type">,
  bytes: ArrayBuffer,
): Promise<CreatePersonaInput> {
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
      throw new PersonaImportError(
        "Unsupported file type — use a .json persona export",
      );
    }
  }

  const text = new TextDecoder("utf-8").decode(bytes);
  return parsePersonaJson(text);
}

/** Re-export for callers that only touch the import module. */
export { toPersonaExport };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
