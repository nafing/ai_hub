import type {
  CreateRegexScriptInput,
  RegexScript,
  UpdateRegexScriptInput,
} from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function listRegexes(): Promise<RegexScript[]> {
  const { data } = await api.get<RegexScript[]>("/regexes");
  return data;
}

export async function getRegex(id: string): Promise<RegexScript> {
  const { data } = await api.get<RegexScript>(`/regexes/${id}`);
  return data;
}

export async function createRegex(
  input: CreateRegexScriptInput,
): Promise<RegexScript> {
  const { data } = await api.post<RegexScript>("/regexes", input);
  return data;
}

export async function updateRegex(
  id: string,
  input: UpdateRegexScriptInput,
): Promise<RegexScript> {
  const { data } = await api.patch<RegexScript>(`/regexes/${id}`, input);
  return data;
}

export async function deleteRegex(id: string): Promise<void> {
  await api.delete(`/regexes/${id}`);
}

export async function duplicateRegex(id: string): Promise<RegexScript> {
  const { data } = await api.post<RegexScript>(`/regexes/${id}/duplicate`);
  return data;
}
