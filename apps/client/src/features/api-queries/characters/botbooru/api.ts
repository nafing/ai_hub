import axios from "axios";
import { api } from "@/lib/api";
import type {
  BotbooruCatalogTag,
  BotbooruPostDetail,
  BotbooruPostsPage,
  BotbooruSession,
  ListBotbooruPostsParams,
  ListBotbooruRelatedTagsParams,
  ListBotbooruTagsParams,
} from "@/features/shared/characters/botbooru/types";

function apiErrorMessage(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | { message?: string | string[]; detail?: string }
      | undefined;
    if (typeof payload?.detail === "string" && payload.detail.trim()) {
      return new Error(payload.detail);
    }
    if (typeof payload?.message === "string" && payload.message.trim()) {
      return new Error(payload.message);
    }
    if (Array.isArray(payload?.message) && payload.message.length > 0) {
      return new Error(payload.message.join(", "));
    }
  }
  if (error instanceof Error && error.message.trim()) return error;
  return new Error(fallback);
}

export async function getBotbooruSession(): Promise<BotbooruSession> {
  try {
    const { data } = await api.get<BotbooruSession>("/botbooru/auth/me");
    return data;
  } catch (error) {
    throw apiErrorMessage(error, "Failed to load Botbooru session");
  }
}

export async function loginBotbooru(
  username: string,
  password: string,
): Promise<BotbooruSession> {
  try {
    const { data } = await api.post<BotbooruSession>("/botbooru/auth/login", {
      username,
      password,
    });
    return data;
  } catch (error) {
    throw apiErrorMessage(error, "Login failed");
  }
}

export async function logoutBotbooru(): Promise<BotbooruSession> {
  try {
    const { data } = await api.post<BotbooruSession>("/botbooru/auth/logout");
    return data;
  } catch (error) {
    throw apiErrorMessage(error, "Logout failed");
  }
}

export async function updateBotbooruPreferences(input: {
  show_nsfw?: boolean;
  show_nsfl?: boolean;
  show_nsfl_active?: boolean;
}): Promise<BotbooruSession> {
  try {
    const { data } = await api.patch<BotbooruSession>(
      "/botbooru/auth/preferences",
      input,
    );
    return data;
  } catch (error) {
    throw apiErrorMessage(error, "Failed to update Botbooru preferences");
  }
}

export async function listBotbooruPosts(
  params: ListBotbooruPostsParams = {},
): Promise<BotbooruPostsPage> {
  try {
    const { data } = await api.get<BotbooruPostsPage>("/botbooru/posts", {
      params: {
        sort: params.sort ?? "latest",
        q: params.q?.trim() || undefined,
        qtext: params.qtext?.trim() || undefined,
        limit: params.limit ?? 24,
        offset: params.offset ?? 0,
        sfw_only: params.sfwOnly === false ? "false" : "true",
        hide_ai: params.hideAi ? "true" : undefined,
      },
    });
    return data;
  } catch (error) {
    throw apiErrorMessage(error, "Failed to load Botbooru gallery");
  }
}

export async function getBotbooruPost(
  postId: number,
): Promise<BotbooruPostDetail> {
  try {
    const { data } = await api.get<BotbooruPostDetail>(
      `/botbooru/posts/${postId}`,
    );
    return data;
  } catch (error) {
    throw apiErrorMessage(error, "Failed to load Botbooru post");
  }
}

export async function listBotbooruTags(
  params: ListBotbooruTagsParams = {},
): Promise<BotbooruCatalogTag[]> {
  try {
    const { data } = await api.get<BotbooruCatalogTag[]>("/botbooru/tags", {
      params: {
        q: params.q?.trim() || undefined,
        limit: params.limit ?? 50,
      },
    });
    return data;
  } catch (error) {
    throw apiErrorMessage(error, "Failed to load Botbooru tags");
  }
}

export async function listBotbooruRelatedTags(
  params: ListBotbooruRelatedTagsParams,
): Promise<BotbooruCatalogTag[]> {
  try {
    const { data } = await api.get<BotbooruCatalogTag[]>(
      "/botbooru/tags/related",
      {
        params: {
          q: params.q,
          limit: params.limit ?? 50,
          sfw_only: params.sfwOnly === false ? "false" : "true",
          hide_ai: params.hideAi ? "true" : undefined,
        },
      },
    );
    return data;
  } catch (error) {
    throw apiErrorMessage(error, "Failed to load related tags");
  }
}

async function messageFromBlob(blob: Blob): Promise<string | null> {
  if (!blob.type.includes("json") && !blob.type.includes("text")) return null;
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text) as { message?: unknown };
    return typeof parsed.message === "string" ? parsed.message : text;
  } catch {
    return null;
  }
}

export async function downloadBotbooruPng(postId: number): Promise<File> {
  try {
    const { data } = await api.get<Blob>(`/botbooru/posts/${postId}/png`, {
      responseType: "blob",
    });
    if (data.type.includes("json") || data.type.includes("text")) {
      const message =
        (await messageFromBlob(data)) || "Botbooru download failed";
      throw new Error(message);
    }
    return new File([data], `botbooru-${postId}.png`, { type: "image/png" });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      const message = await messageFromBlob(error.response.data);
      if (message) throw new Error(message);
    }
    throw apiErrorMessage(error, "Botbooru download failed");
  }
}
