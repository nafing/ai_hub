import type {
  CharacterFolder,
  CreateCharacterFolderInput,
  UpdateCharacterFolderInput,
} from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function listCharacterFolders(): Promise<CharacterFolder[]> {
  const { data } = await api.get<CharacterFolder[]>("/character-folders");
  return data;
}

export async function getCharacterFolder(id: string): Promise<CharacterFolder> {
  const { data } = await api.get<CharacterFolder>(`/character-folders/${id}`);
  return data;
}

export async function createCharacterFolder(
  input: CreateCharacterFolderInput,
): Promise<CharacterFolder> {
  const { data } = await api.post<CharacterFolder>("/character-folders", input);
  return data;
}

export async function updateCharacterFolder(
  id: string,
  input: UpdateCharacterFolderInput,
): Promise<CharacterFolder> {
  const { data } = await api.patch<CharacterFolder>(
    `/character-folders/${id}`,
    input,
  );
  return data;
}

export async function deleteCharacterFolder(id: string): Promise<void> {
  await api.delete(`/character-folders/${id}`);
}
