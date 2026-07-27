import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateLorebookInput, UpdateLorebookInput } from "@ai-hub/shared";
import {
  createLorebook,
  deleteLorebook,
  duplicateLorebook,
  getLorebook,
  getLoreIndexStatus,
  listLorebooks,
  reindexLorebook,
  reindexLorebooks,
  updateLorebook,
} from "./api";

export const lorebookKeys = {
  all: ["lorebooks"] as const,
  list: () => [...lorebookKeys.all, "list"] as const,
  detail: (id: string) => [...lorebookKeys.all, "detail", id] as const,
  indexStatus: () => [...lorebookKeys.all, "index-status"] as const,
};

export function useLorebooks() {
  return useQuery({
    queryKey: lorebookKeys.list(),
    queryFn: listLorebooks,
  });
}

export function useLorebook(id: string | undefined) {
  return useQuery({
    queryKey: lorebookKeys.detail(id ?? ""),
    queryFn: () => getLorebook(id!),
    enabled: Boolean(id),
  });
}

export function useLoreIndexStatus() {
  return useQuery({
    queryKey: lorebookKeys.indexStatus(),
    queryFn: getLoreIndexStatus,
    refetchInterval: 15_000,
  });
}

export function useCreateLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLorebookInput) => createLorebook(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: lorebookKeys.indexStatus(),
      });
    },
  });
}

export function useUpdateLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLorebookInput }) =>
      updateLorebook(id, input),
    onSuccess: (lorebook) => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: lorebookKeys.detail(lorebook.id),
      });
      void queryClient.invalidateQueries({
        queryKey: lorebookKeys.indexStatus(),
      });
    },
  });
}

export function useDeleteLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLorebook(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: lorebookKeys.indexStatus(),
      });
    },
  });
}

export function useDuplicateLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateLorebook(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: lorebookKeys.indexStatus(),
      });
    },
  });
}

export function useReindexLorebooks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reindexLorebooks(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
    },
  });
}

export function useReindexLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reindexLorebook(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: lorebookKeys.detail(id),
      });
      void queryClient.invalidateQueries({
        queryKey: lorebookKeys.indexStatus(),
      });
    },
  });
}
