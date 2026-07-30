import type {
  Character,
  CharacterListItem,
  CreateCharacterInput,
  UpdateCharacterInput,
} from "@ai-hub/shared";
import { imageApiPaths } from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function listCharacters(): Promise<CharacterListItem[]> {
  const { data } = await api.get<CharacterListItem[]>("/characters");
  return data;
}

export async function getCharacter(id: string): Promise<Character> {
  const { data } = await api.get<Character>(`/characters/${id}`);
  return data;
}

export async function createCharacter(
  input: CreateCharacterInput,
): Promise<Character> {
  const { data } = await api.post<Character>("/characters", input);
  return data;
}

export async function updateCharacter(
  id: string,
  input: UpdateCharacterInput,
): Promise<Character> {
  const { data } = await api.patch<Character>(`/characters/${id}`, input);
  return data;
}

export async function deleteCharacter(id: string): Promise<void> {
  await api.delete(`/characters/${id}`);
}

export async function deleteCharacterVersion(
  id: string,
  versionId: string,
): Promise<Character> {
  const { data } = await api.delete<Character>(
    `/characters/${id}/versions/${versionId}`,
  );
  return data;
}

export async function duplicateCharacter(id: string): Promise<Character> {
  const { data } = await api.post<Character>(`/characters/${id}/duplicate`);
  return data;
}

export async function uploadCharacterAvatar(
  id: string,
  file: Blob,
  fileName = "avatar.png",
): Promise<Character> {
  const form = new FormData();
  form.append("file", file, fileName);
  const { data } = await api.put<Character>(
    imageApiPaths.characterAvatar(id),
    form,
  );
  return data;
}

export async function deleteCharacterAvatar(id: string): Promise<Character> {
  const { data } = await api.delete<Character>(
    imageApiPaths.characterAvatar(id),
  );
  return data;
}

export async function uploadCharacterGalleryImage(
  id: string,
  file: Blob,
  fileName = "image.png",
): Promise<Character> {
  const form = new FormData();
  form.append("file", file, fileName);
  const { data } = await api.post<Character>(
    imageApiPaths.characterGalleryCollection(id),
    form,
  );
  return data;
}

export async function deleteCharacterGalleryImage(
  id: string,
  imageId: string,
): Promise<Character> {
  const { data } = await api.delete<Character>(
    imageApiPaths.characterGallery(id, imageId),
  );
  return data;
}
