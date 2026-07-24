import type { CreatePersonaInput } from "./api";
import type { Persona } from "./types";

/** Blank persona for user-created entries. */
export function defaultPersona(
  overrides: Partial<CreatePersonaInput> = {},
): CreatePersonaInput {
  return {
    name: "",
    description: "",
    personality: "",
    notes: "",
    is_default: false,
    ...overrides,
  };
}

export function normalizePersona(
  input: Partial<Persona> & Record<string, unknown>,
): CreatePersonaInput {
  return defaultPersona({
    name: typeof input.name === "string" ? input.name : "",
    description:
      typeof input.description === "string" ? input.description : "",
    personality:
      typeof input.personality === "string" ? input.personality : "",
    notes: typeof input.notes === "string" ? input.notes : "",
    is_default: Boolean(input.is_default),
  });
}
