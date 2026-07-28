import type {
  CreateTwatterInteractionInput,
  CreateTwatterPostInput,
  RemoveTwatterInteractionInput,
  TwatterAccount,
  TwatterAccountProfile,
  TwatterAccountProfileUpdateInput,
  TwatterBootstrap,
  TwatterFollowUpdateInput,
  TwatterInteraction,
  TwatterNotificationsResponse,
  TwatterPost,
  TwatterRefreshInput,
  TwatterSearchResult,
  TwatterSettings,
  TwatterSettingsUpdateInput,
  UpdateTwatterPostInput,
} from "@ai-hub/shared";
import { api } from "@/lib/api";

export async function fetchTwatterBootstrap(): Promise<TwatterBootstrap> {
  const { data } = await api.get<TwatterBootstrap>("/twatter");
  return data;
}

export async function searchTwatter(
  q: string,
  limit?: number,
): Promise<TwatterSearchResult> {
  const { data } = await api.get<TwatterSearchResult>("/twatter/search", {
    params: { q, limit },
  });
  return data;
}

export async function fetchTwatterNotifications(
  personaId: string,
  unreadOnly = false,
): Promise<TwatterNotificationsResponse> {
  const { data } = await api.get<TwatterNotificationsResponse>(
    "/twatter/notifications",
    {
      params: {
        persona_id: personaId,
        unread: unreadOnly ? "1" : undefined,
      },
    },
  );
  return data;
}

export async function markTwatterNotificationsRead(
  personaId: string,
): Promise<TwatterAccount> {
  const { data } = await api.post<TwatterAccount>("/twatter/notifications/read", {
    persona_id: personaId,
  });
  return data;
}

export async function fetchTwatterAccountProfile(
  accountId: string,
  personaId?: string | null,
): Promise<TwatterAccountProfile> {
  const { data } = await api.get<TwatterAccountProfile>(
    `/twatter/accounts/${accountId}/profile`,
    {
      params: personaId ? { persona_id: personaId } : undefined,
    },
  );
  return data;
}

export async function updateTwatterSettings(
  input: TwatterSettingsUpdateInput,
): Promise<TwatterSettings> {
  const { data } = await api.put<TwatterSettings>("/twatter/settings", input);
  return data;
}

export async function refreshTwatterTimeline(
  input: TwatterRefreshInput = {},
): Promise<{ ok: true }> {
  const { data } = await api.post<{ ok: true }>("/twatter/refresh", input);
  return data;
}

export async function createTwatterPost(
  input: CreateTwatterPostInput,
): Promise<TwatterPost> {
  const { data } = await api.post<TwatterPost>("/twatter/posts", input);
  return data;
}

export async function updateTwatterPost(
  id: string,
  input: UpdateTwatterPostInput & { persona_id: string },
): Promise<TwatterPost> {
  const { data } = await api.patch<TwatterPost>(`/twatter/posts/${id}`, input);
  return data;
}

export async function deleteTwatterPost(
  id: string,
  personaId: string,
): Promise<void> {
  await api.delete(`/twatter/posts/${id}`, { data: { persona_id: personaId } });
}

export async function createTwatterInteraction(
  postId: string,
  input: CreateTwatterInteractionInput,
): Promise<TwatterInteraction | null> {
  const { data } = await api.post<TwatterInteraction | null>(
    `/twatter/posts/${postId}/interactions`,
    input,
  );
  return data;
}

export async function removeTwatterInteraction(
  postId: string,
  input: RemoveTwatterInteractionInput,
): Promise<void> {
  await api.delete(`/twatter/posts/${postId}/interactions`, { data: input });
}

export async function updateTwatterProfile(
  accountId: string,
  input: TwatterAccountProfileUpdateInput & { persona_id: string },
): Promise<TwatterAccount> {
  const { data } = await api.patch<TwatterAccount>(
    `/twatter/accounts/${accountId}/profile`,
    input,
  );
  return data;
}

export async function setTwatterFollow(
  followerAccountId: string,
  targetAccountId: string,
  input: TwatterFollowUpdateInput,
): Promise<TwatterAccount> {
  const { data } = await api.patch<TwatterAccount>(
    `/twatter/accounts/${followerAccountId}/follows/${targetAccountId}`,
    input,
  );
  return data;
}

export async function inviteTwatterCharacter(
  characterId: string,
): Promise<TwatterSettings> {
  const { data } = await api.post<TwatterSettings>("/twatter/invites", {
    character_id: characterId,
  });
  return data;
}

export async function uninviteTwatterCharacter(
  characterId: string,
): Promise<TwatterSettings> {
  const { data } = await api.delete<TwatterSettings>(
    `/twatter/invites/${characterId}`,
  );
  return data;
}

export async function resetTwatterTimeline(): Promise<void> {
  await api.delete("/twatter/timeline");
}
