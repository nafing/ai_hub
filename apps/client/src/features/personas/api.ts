import type {
  CreatePersonaInput,
  Persona,
  PersonaListItem,
  UpdatePersonaInput,
} from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function listPersonas(): Promise<PersonaListItem[]> {
  const { data } = await api.get<PersonaListItem[]>("/personas");
  return data;
}

export async function getPersona(id: string): Promise<Persona> {
  const { data } = await api.get<Persona>(`/personas/${id}`);
  return data;
}

export async function createPersona(
  input: CreatePersonaInput,
): Promise<Persona> {
  const { data } = await api.post<Persona>("/personas", input);
  return data;
}

export async function updatePersona(
  id: string,
  input: UpdatePersonaInput,
): Promise<Persona> {
  const { data } = await api.patch<Persona>(`/personas/${id}`, input);
  return data;
}

export async function deletePersona(id: string): Promise<void> {
  await api.delete(`/personas/${id}`);
}

export async function duplicatePersona(id: string): Promise<Persona> {
  const { data } = await api.post<Persona>(`/personas/${id}/duplicate`);
  return data;
}

export async function uploadPersonaAvatar(
  id: string,
  file: Blob,
  fileName = "avatar.png",
): Promise<Persona> {
  const form = new FormData();
  form.append("file", file, fileName);
  const { data } = await api.put<Persona>(`/personas/${id}/avatar`, form);
  return data;
}

export async function deletePersonaAvatar(id: string): Promise<Persona> {
  const { data } = await api.delete<Persona>(`/personas/${id}/avatar`);
  return data;
}
