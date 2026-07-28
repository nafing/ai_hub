import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateLorebookInput, UpdateLorebookInput } from "@ai-hub/shared";
import {
  createLorebook,
  deleteLorebook,
  duplicateLorebook,
  getLorebook,
  listLorebooks,
  updateLorebook,
} from "./api";

export const lorebookKeys = {
  all: ["lorebooks"] as const,
  list: () => [...lorebookKeys.all, "list"] as const,
  detail: (id: string) => [...lorebookKeys.all, "detail", id] as const,
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

export function useCreateLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLorebookInput) => createLorebook(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
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
    },
  });
}

export function useDeleteLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLorebook(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
    },
  });
}

export function useDuplicateLorebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateLorebook(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
    },
  });
}
