import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateToolInput, UpdateToolInput } from "@ai-hub/shared";
import {
  createTool,
  deleteTool,
  duplicateTool,
  getTool,
  listTools,
  updateTool,
} from "@/features/api-queries/tools/api";

export const toolKeys = {
  all: ["tools"] as const,
  list: () => [...toolKeys.all, "list"] as const,
  detail: (id: string) => [...toolKeys.all, "detail", id] as const,
};

export function useTools() {
  return useQuery({
    queryKey: toolKeys.list(),
    queryFn: listTools,
  });
}

export function useTool(id: string | undefined) {
  return useQuery({
    queryKey: toolKeys.detail(id ?? ""),
    queryFn: () => getTool(id!),
    enabled: Boolean(id),
  });
}

export function useCreateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateToolInput) => createTool(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: toolKeys.list() });
    },
  });
}

export function useUpdateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateToolInput }) =>
      updateTool(id, input),
    onSuccess: (tool) => {
      void queryClient.invalidateQueries({ queryKey: toolKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: toolKeys.detail(tool.id),
      });
    },
  });
}

export function useDeleteTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTool(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: toolKeys.list() });
    },
  });
}

export function useDuplicateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateTool(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: toolKeys.list() });
    },
  });
}
