import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getBotbooruSession,
  getBotbooruPost,
  listBotbooruPosts,
  listBotbooruRelatedTags,
  listBotbooruTags,
  loginBotbooru,
  logoutBotbooru,
  updateBotbooruPreferences,
} from "@/features/api-queries/characters/botbooru/api";
import type {
  ListBotbooruPostsParams,
  ListBotbooruRelatedTagsParams,
  ListBotbooruTagsParams,
} from "@/features/characters/botbooru/types";

export const botbooruKeys = {
  all: ["botbooru"] as const,
  session: () => [...botbooruKeys.all, "session"] as const,
  posts: (params: ListBotbooruPostsParams) =>
    [...botbooruKeys.all, "posts", params] as const,
  post: (postId: number) => [...botbooruKeys.all, "post", postId] as const,
  tags: (params: ListBotbooruTagsParams) =>
    [...botbooruKeys.all, "tags", params] as const,
  relatedTags: (params: ListBotbooruRelatedTagsParams) =>
    [...botbooruKeys.all, "related-tags", params] as const,
};

export function useBotbooruSession() {
  return useQuery({
    queryKey: botbooruKeys.session(),
    queryFn: getBotbooruSession,
    staleTime: 60_000,
  });
}

export function useBotbooruPosts(params: ListBotbooruPostsParams) {
  return useQuery({
    queryKey: botbooruKeys.posts(params),
    queryFn: () => listBotbooruPosts(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useBotbooruPost(postId: number) {
  return useQuery({
    queryKey: botbooruKeys.post(postId),
    queryFn: () => getBotbooruPost(postId),
    enabled: Number.isInteger(postId) && postId > 0,
    staleTime: 60_000,
  });
}

export function useBotbooruTags(params: ListBotbooruTagsParams) {
  return useQuery({
    queryKey: botbooruKeys.tags(params),
    queryFn: () => listBotbooruTags(params),
    staleTime: 5 * 60_000,
  });
}

export function useBotbooruRelatedTags(
  params: ListBotbooruRelatedTagsParams,
  enabled = true,
) {
  return useQuery({
    queryKey: botbooruKeys.relatedTags(params),
    queryFn: () => listBotbooruRelatedTags(params),
    enabled: enabled && params.q.trim().length > 0,
    staleTime: 60_000,
  });
}

export function useBotbooruLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => loginBotbooru(username, password),
    onSuccess: (session) => {
      queryClient.setQueryData(botbooruKeys.session(), session);
      void queryClient.invalidateQueries({ queryKey: botbooruKeys.all });
    },
  });
}

export function useBotbooruLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutBotbooru,
    onSuccess: (session) => {
      queryClient.setQueryData(botbooruKeys.session(), session);
      void queryClient.invalidateQueries({ queryKey: botbooruKeys.all });
    },
  });
}

export function useBotbooruPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateBotbooruPreferences,
    onSuccess: (session) => {
      queryClient.setQueryData(botbooruKeys.session(), session);
      void queryClient.invalidateQueries({ queryKey: botbooruKeys.all });
    },
  });
}
