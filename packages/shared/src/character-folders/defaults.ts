import type { CharacterFolder } from "./types";
import type { CreateCharacterFolderInput } from "./api";

export function defaultCharacterFolder(
  overrides: Partial<CreateCharacterFolderInput> = {},
): CreateCharacterFolderInput {
  return {
    name: "",
    character_ids: [],
    ...overrides,
  };
}

export function normalizeCharacterFolder(
  input: Partial<CreateCharacterFolderInput> & { id?: string },
): Omit<CharacterFolder, "id"> & { id?: string } {
  const name =
    typeof input.name === "string" ? input.name.trim() : "";
  const seen = new Set<string>();
  const character_ids: string[] = [];
  for (const id of Array.isArray(input.character_ids)
    ? input.character_ids
    : []) {
    if (typeof id !== "string" || !id.trim() || seen.has(id)) continue;
    seen.add(id);
    character_ids.push(id);
  }
  return {
    ...(input.id ? { id: input.id } : {}),
    name,
    character_ids,
  };
}
