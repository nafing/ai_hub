import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateAgentInput, UpdateAgentInput } from "@ai-hub/shared";
import {
  createAgent,
  deleteAgent,
  duplicateAgent,
  getAgent,
  listAgents,
  updateAgent,
} from "@/features/api-queries/agents/api";

export const agentKeys = {
  all: ["agents"] as const,
  list: () => [...agentKeys.all, "list"] as const,
  detail: (id: string) => [...agentKeys.all, "detail", id] as const,
};

export function useAgents() {
  return useQuery({
    queryKey: agentKeys.list(),
    queryFn: listAgents,
  });
}

export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: agentKeys.detail(id ?? ""),
    queryFn: () => getAgent(id!),
    enabled: Boolean(id),
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgentInput) => createAgent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agentKeys.list() });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAgentInput }) =>
      updateAgent(id, input),
    onSuccess: (agent) => {
      void queryClient.invalidateQueries({ queryKey: agentKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: agentKeys.detail(agent.id),
      });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAgent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agentKeys.list() });
    },
  });
}

export function useDuplicateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateAgent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agentKeys.list() });
    },
  });
}
