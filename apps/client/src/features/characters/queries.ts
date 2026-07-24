import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateCharacterInput, UpdateCharacterInput } from "@ai-hub/shared";
import {
  createCharacter,
  deleteCharacter,
  deleteCharacterAvatar,
  duplicateCharacter,
  getCharacter,
  listCharacters,
  updateCharacter,
  uploadCharacterAvatar,
} from "./api";
import { lorebookKeys } from "@/features/lorebooks/queries";

export const characterKeys = {
  all: ["characters"] as const,
  list: () => [...characterKeys.all, "list"] as const,
  detail: (id: string) => [...characterKeys.all, "detail", id] as const,
};

export function useCharacters() {
  return useQuery({
    queryKey: characterKeys.list(),
    queryFn: listCharacters,
  });
}

export function useCharacter(id: string | undefined) {
  return useQuery({
    queryKey: characterKeys.detail(id ?? ""),
    queryFn: () => getCharacter(id!),
    enabled: Boolean(id),
  });
}

export function useCreateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCharacterInput) => createCharacter(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.list() });
    },
  });
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateCharacterInput;
    }) => updateCharacter(id, input),
    onSuccess: (character) => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: characterKeys.detail(character.id),
      });
    },
  });
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCharacter(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.list() });
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
    },
  });
}

export function useDuplicateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateCharacter(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.list() });
    },
  });
}

export function useUploadCharacterAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: Blob }) =>
      uploadCharacterAvatar(id, file),
    onSuccess: (character) => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: characterKeys.detail(character.id),
      });
    },
  });
}

export function useDeleteCharacterAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCharacterAvatar(id),
    onSuccess: (character) => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: characterKeys.detail(character.id),
      });
    },
  });
}
