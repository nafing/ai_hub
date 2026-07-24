import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateConnectionInput,
  UpdateConnectionInput,
} from "@ai-hub/shared";
import {
  createConnection,
  deleteConnection,
  duplicateConnection,
  getConnection,
  listConnections,
  listOpenRouterEndpoints,
  listOpenRouterModels,
  type OpenRouterAuth,
  updateConnection,
} from "./api";

export const connectionKeys = {
  all: ["connections"] as const,
  list: () => [...connectionKeys.all, "list"] as const,
  detail: (id: string) => [...connectionKeys.all, "detail", id] as const,
  models: (auth: OpenRouterAuth) =>
    [...connectionKeys.all, "models", auth.apiKey ?? "", auth.connectionId ?? ""] as const,
  endpoints: (modelId: string, auth: OpenRouterAuth) =>
    [
      ...connectionKeys.all,
      "endpoints",
      modelId,
      auth.apiKey ?? "",
      auth.connectionId ?? "",
    ] as const,
};

export function useConnections() {
  return useQuery({
    queryKey: connectionKeys.list(),
    queryFn: listConnections,
  });
}

export function useConnection(id: string | undefined) {
  return useQuery({
    queryKey: connectionKeys.detail(id ?? ""),
    queryFn: () => getConnection(id!),
    enabled: Boolean(id),
  });
}

export function useCreateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConnectionInput) => createConnection(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.list() });
    },
  });
}

export function useUpdateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateConnectionInput;
    }) => updateConnection(id, input),
    onSuccess: (connection) => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: connectionKeys.detail(connection.id),
      });
    },
  });
}

export function useDeleteConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteConnection(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.list() });
    },
  });
}

export function useDuplicateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateConnection(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.list() });
    },
  });
}

export function useOpenRouterModels(auth: OpenRouterAuth, enabled: boolean) {
  return useQuery({
    queryKey: connectionKeys.models(auth),
    queryFn: () => listOpenRouterModels(auth),
    enabled:
      enabled && Boolean(auth.apiKey?.trim() || auth.connectionId?.trim()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOpenRouterEndpoints(
  modelId: string,
  auth: OpenRouterAuth,
  enabled: boolean,
) {
  return useQuery({
    queryKey: connectionKeys.endpoints(modelId, auth),
    queryFn: () => listOpenRouterEndpoints(modelId, auth),
    enabled:
      enabled &&
      Boolean(modelId) &&
      Boolean(auth.apiKey?.trim() || auth.connectionId?.trim()),
    staleTime: 5 * 60 * 1000,
  });
}
