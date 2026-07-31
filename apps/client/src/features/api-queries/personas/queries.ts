import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatePersonaInput, UpdatePersonaInput } from "@ai-hub/shared";
import {
  createPersona,
  deletePersona,
  deletePersonaAvatar,
  duplicatePersona,
  getPersona,
  listPersonas,
  updatePersona,
  uploadPersonaAvatar,
} from "@/features/api-queries/personas/api";
import { lorebookKeys } from "@/features/api-queries/lorebooks/queries";

export const personaKeys = {
  all: ["personas"] as const,
  list: () => [...personaKeys.all, "list"] as const,
  detail: (id: string) => [...personaKeys.all, "detail", id] as const,
};

export function usePersonas() {
  return useQuery({
    queryKey: personaKeys.list(),
    queryFn: listPersonas,
  });
}

export function usePersona(id: string | undefined) {
  return useQuery({
    queryKey: personaKeys.detail(id ?? ""),
    queryFn: () => getPersona(id!),
    enabled: Boolean(id),
  });
}

export function useCreatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePersonaInput) => createPersona(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: personaKeys.all });
    },
  });
}

export function useUpdatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePersonaInput }) =>
      updatePersona(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: personaKeys.all });
    },
  });
}

export function useDeletePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePersona(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: personaKeys.list() });
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
    },
  });
}

export function useDuplicatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicatePersona(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: personaKeys.list() });
    },
  });
}

export function useUploadPersonaAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: Blob }) =>
      uploadPersonaAvatar(id, file),
    onSuccess: (persona) => {
      void queryClient.invalidateQueries({ queryKey: personaKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: personaKeys.detail(persona.id),
      });
    },
  });
}

export function useDeletePersonaAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePersonaAvatar(id),
    onSuccess: (persona) => {
      void queryClient.invalidateQueries({ queryKey: personaKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: personaKeys.detail(persona.id),
      });
    },
  });
}
