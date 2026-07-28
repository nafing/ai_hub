import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateTwatterInteractionInput,
  CreateTwatterPostInput,
  RemoveTwatterInteractionInput,
  TwatterAccountProfileUpdateInput,
  TwatterFollowUpdateInput,
  TwatterRefreshInput,
  TwatterSettingsUpdateInput,
  UpdateTwatterPostInput,
} from "@ai-hub/shared";
import {
  createTwatterInteraction,
  createTwatterPost,
  deleteTwatterPost,
  fetchTwatterAccountProfile,
  fetchTwatterBootstrap,
  fetchTwatterNotifications,
  inviteTwatterCharacter,
  markTwatterNotificationsRead,
  refreshTwatterTimeline,
  removeTwatterInteraction,
  resetTwatterTimeline,
  searchTwatter,
  setTwatterFollow,
  uninviteTwatterCharacter,
  updateTwatterPost,
  updateTwatterProfile,
  updateTwatterSettings,
} from "./api";

export const twatterKeys = {
  all: ["twatter"] as const,
  bootstrap: () => [...twatterKeys.all, "bootstrap"] as const,
  search: (q: string) => [...twatterKeys.all, "search", q] as const,
  notifications: (personaId: string) =>
    [...twatterKeys.all, "notifications", personaId] as const,
  profile: (accountId: string, personaId: string | null) =>
    [...twatterKeys.all, "profile", accountId, personaId] as const,
};

export function useTwatterBootstrap() {
  return useQuery({
    queryKey: twatterKeys.bootstrap(),
    queryFn: fetchTwatterBootstrap,
  });
}

export function useTwatterSearch(query: string) {
  return useQuery({
    queryKey: twatterKeys.search(query),
    queryFn: () => searchTwatter(query),
    enabled: query.trim().length > 0,
  });
}

export function useTwatterNotifications(
  personaId: string | null,
  unreadOnly = false,
) {
  return useQuery({
    queryKey: twatterKeys.notifications(personaId ?? ""),
    queryFn: () => fetchTwatterNotifications(personaId!, unreadOnly),
    enabled: Boolean(personaId),
  });
}

export function useMarkTwatterNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => markTwatterNotificationsRead(personaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useTwatterAccountProfile(
  accountId: string | null,
  personaId: string | null,
) {
  return useQuery({
    queryKey: twatterKeys.profile(accountId ?? "", personaId),
    queryFn: () => fetchTwatterAccountProfile(accountId!, personaId),
    enabled: Boolean(accountId),
  });
}

export function useUpdateTwatterSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TwatterSettingsUpdateInput) =>
      updateTwatterSettings(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useRefreshTwatterTimeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TwatterRefreshInput = {}) =>
      refreshTwatterTimeline(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useCreateTwatterPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTwatterPostInput) => createTwatterPost(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useUpdateTwatterPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateTwatterPostInput & { persona_id: string };
    }) => updateTwatterPost(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useDeleteTwatterPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, personaId }: { id: string; personaId: string }) =>
      deleteTwatterPost(id, personaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useCreateTwatterInteraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      input,
    }: {
      postId: string;
      input: CreateTwatterInteractionInput;
    }) => createTwatterInteraction(postId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useRemoveTwatterInteraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      input,
    }: {
      postId: string;
      input: RemoveTwatterInteractionInput;
    }) => removeTwatterInteraction(postId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useUpdateTwatterProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      input,
    }: {
      accountId: string;
      input: TwatterAccountProfileUpdateInput & { persona_id: string };
    }) => updateTwatterProfile(accountId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useSetTwatterFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      followerAccountId,
      targetAccountId,
      input,
    }: {
      followerAccountId: string;
      targetAccountId: string;
      input: TwatterFollowUpdateInput;
    }) => setTwatterFollow(followerAccountId, targetAccountId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useInviteTwatterCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (characterId: string) => inviteTwatterCharacter(characterId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useUninviteTwatterCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (characterId: string) => uninviteTwatterCharacter(characterId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}

export function useResetTwatterTimeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetTwatterTimeline(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: twatterKeys.all });
    },
  });
}
