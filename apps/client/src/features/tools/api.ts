import type {
  CreateToolInput,
  Tool,
  ToolListItem,
  UpdateToolInput,
} from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function listTools(): Promise<ToolListItem[]> {
  const { data } = await api.get<ToolListItem[]>("/tools");
  return data;
}

export async function getTool(id: string): Promise<Tool> {
  const { data } = await api.get<Tool>(`/tools/${id}`);
  return data;
}

export async function createTool(input: CreateToolInput): Promise<Tool> {
  const { data } = await api.post<Tool>("/tools", input);
  return data;
}

export async function updateTool(
  id: string,
  input: UpdateToolInput,
): Promise<Tool> {
  const { data } = await api.patch<Tool>(`/tools/${id}`, input);
  return data;
}

export async function deleteTool(id: string): Promise<void> {
  await api.delete(`/tools/${id}`);
}

export async function duplicateTool(id: string): Promise<Tool> {
  const { data } = await api.post<Tool>(`/tools/${id}/duplicate`);
  return data;
}
