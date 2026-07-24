import type {
  Connection,
  ConnectionListItem,
  CreateConnectionInput,
  OpenRouterEndpoint,
  OpenRouterModel,
  UpdateConnectionInput,
} from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function listConnections(): Promise<ConnectionListItem[]> {
  const { data } = await api.get<ConnectionListItem[]>("/connections");
  return data;
}

export async function getConnection(id: string): Promise<Connection> {
  const { data } = await api.get<Connection>(`/connections/${id}`);
  return data;
}

export async function createConnection(
  input: CreateConnectionInput,
): Promise<Connection> {
  const { data } = await api.post<Connection>("/connections", input);
  return data;
}

export async function updateConnection(
  id: string,
  input: UpdateConnectionInput,
): Promise<Connection> {
  const { data } = await api.patch<Connection>(`/connections/${id}`, input);
  return data;
}

export async function deleteConnection(id: string): Promise<void> {
  await api.delete(`/connections/${id}`);
}

export async function duplicateConnection(id: string): Promise<Connection> {
  const { data } = await api.post<Connection>(`/connections/${id}/duplicate`);
  return data;
}

export type OpenRouterAuth = {
  apiKey?: string;
  connectionId?: string;
};

function openRouterParams(auth: OpenRouterAuth) {
  return {
    ...(auth.apiKey ? { apiKey: auth.apiKey } : {}),
    ...(auth.connectionId ? { connectionId: auth.connectionId } : {}),
  };
}

export async function listOpenRouterModels(
  auth: OpenRouterAuth,
): Promise<OpenRouterModel[]> {
  const { data } = await api.get<OpenRouterModel[]>(
    "/connections/openrouter/models",
    { params: openRouterParams(auth) },
  );
  return data;
}

export async function listOpenRouterEndpoints(
  modelId: string,
  auth: OpenRouterAuth,
): Promise<OpenRouterEndpoint[]> {
  const { data } = await api.get<OpenRouterEndpoint[]>(
    "/connections/openrouter/endpoints",
    { params: { modelId, ...openRouterParams(auth) } },
  );
  return data;
}
