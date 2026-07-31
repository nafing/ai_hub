import type { CreateLorebookInput, Lorebook, LorebookListItem, UpdateLorebookInput } from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function listLorebooks(): Promise<LorebookListItem[]> {
  const { data } = await api.get<LorebookListItem[]>("/lorebooks");
  return data;
}

export async function getLorebook(id: string): Promise<Lorebook> {
  const { data } = await api.get<Lorebook>(`/lorebooks/${id}`);
  return data;
}

export async function createLorebook(
  input: CreateLorebookInput,
): Promise<Lorebook> {
  const { data } = await api.post<Lorebook>("/lorebooks", input);
  return data;
}

export async function updateLorebook(
  id: string,
  input: UpdateLorebookInput,
): Promise<Lorebook> {
  const { data } = await api.patch<Lorebook>(`/lorebooks/${id}`, input);
  return data;
}

export async function deleteLorebook(id: string): Promise<void> {
  await api.delete(`/lorebooks/${id}`);
}

export async function duplicateLorebook(id: string): Promise<Lorebook> {
  const { data } = await api.post<Lorebook>(`/lorebooks/${id}/duplicate`);
  return data;
}
