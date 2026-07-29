import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateCharacterFolderInput,
  UpdateCharacterFolderInput,
} from "@ai-hub/shared";
import {
  createCharacterFolder,
  deleteCharacterFolder,
  listCharacterFolders,
  updateCharacterFolder,
} from "./foldersApi";

export const characterFolderKeys = {
  all: ["character-folders"] as const,
  list: () => [...characterFolderKeys.all, "list"] as const,
};

export function useCharacterFolders() {
  return useQuery({
    queryKey: characterFolderKeys.list(),
    queryFn: listCharacterFolders,
  });
}

export function useCreateCharacterFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCharacterFolderInput) =>
      createCharacterFolder(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: characterFolderKeys.list(),
      });
    },
  });
}

export function useUpdateCharacterFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateCharacterFolderInput;
    }) => updateCharacterFolder(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: characterFolderKeys.list(),
      });
    },
  });
}

export function useDeleteCharacterFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCharacterFolder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: characterFolderKeys.list(),
      });
    },
  });
}
