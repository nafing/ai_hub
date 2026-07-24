import type { Persona } from "./types";

export type CreatePersonaInput = Omit<Persona, "id" | "avatar">;

export type UpdatePersonaInput = Partial<CreatePersonaInput>;

export type PersonaListItem = Pick<
  Persona,
  | "id"
  | "avatar"
  | "name"
  | "description"
  | "personality"
  | "notes"
  | "is_default"
>;
