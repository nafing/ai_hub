import type {
  Agent,
  AgentListItem,
  CreateAgentInput,
  UpdateAgentInput,
} from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function listAgents(): Promise<AgentListItem[]> {
  const { data } = await api.get<AgentListItem[]>("/agents");
  return data;
}

export async function getAgent(id: string): Promise<Agent> {
  const { data } = await api.get<Agent>(`/agents/${id}`);
  return data;
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const { data } = await api.post<Agent>("/agents", input);
  return data;
}

export async function updateAgent(
  id: string,
  input: UpdateAgentInput,
): Promise<Agent> {
  const { data } = await api.patch<Agent>(`/agents/${id}`, input);
  return data;
}

export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/agents/${id}`);
}

export async function duplicateAgent(id: string): Promise<Agent> {
  const { data } = await api.post<Agent>(`/agents/${id}/duplicate`);
  return data;
}
