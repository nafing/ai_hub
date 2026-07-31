import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateRegexScriptInput,
  UpdateRegexScriptInput,
} from "@ai-hub/shared";
import {
  createRegex,
  deleteRegex,
  duplicateRegex,
  getRegex,
  listRegexes,
  updateRegex,
} from "@/features/api-queries/regexes/api";

export const regexKeys = {
  all: ["regexes"] as const,
  list: () => [...regexKeys.all, "list"] as const,
  detail: (id: string) => [...regexKeys.all, "detail", id] as const,
};

export function useRegexes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: regexKeys.list(),
    queryFn: listRegexes,
    enabled: options?.enabled ?? true,
  });
}

export function useRegex(id: string | undefined) {
  return useQuery({
    queryKey: regexKeys.detail(id ?? ""),
    queryFn: () => getRegex(id!),
    enabled: Boolean(id),
  });
}

export function useCreateRegex() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRegexScriptInput) => createRegex(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: regexKeys.list() });
    },
  });
}

export function useUpdateRegex() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateRegexScriptInput;
    }) => updateRegex(id, input),
    onSuccess: (script) => {
      void queryClient.invalidateQueries({ queryKey: regexKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: regexKeys.detail(script.id),
      });
    },
  });
}

export function useDeleteRegex() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRegex(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: regexKeys.list() });
    },
  });
}

export function useDuplicateRegex() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateRegex(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: regexKeys.list() });
    },
  });
}
