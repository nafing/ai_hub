import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { AppSettingsService } from "../app-settings/app-settings.service";

const BOTBOORU_ORIGIN = "https://botbooru.com";
const TOKEN_SETTINGS_KEY = "botbooru.access_token";
const MAX_LIMIT = 80;
const DEFAULT_LIMIT = 24;

const ALLOWED_SORTS = new Set([
  "latest",
  "random",
  "favorited",
  "viewed",
  "downloads",
  "curated",
]);

export type BotbooruCatalogTag = {
  id: number;
  name: string;
  category: string;
  count: number;
  count_nsfw: number;
  count_nsfl: number;
  co_count?: number;
};

export type BotbooruTag = {
  id: number;
  name: string;
  category: string;
};

export type BotbooruPost = {
  id: number;
  filename: string;
  character_name: string;
  meta_name: string;
  tagline: string;
  description_excerpt: string;
  creator_notes_excerpt: string;
  created_at: string;
  tags: BotbooruTag[];
  token_count: number;
  views: number;
  downloads: number;
  favorite_count: number;
  comments_count: number;
  card_is_animated: boolean;
  preview_url: string;
  post_url: string;
  download_url: string;
};

export type BotbooruPostDetail = BotbooruPost & {
  description: string;
  personality: string;
  first_mes: string;
  scenario: string;
  mes_example: string;
  system_prompt: string;
  post_history_instructions: string;
  creator_notes: string;
  alternate_greetings: string[];
  uploader_name: string;
  has_lorebook: boolean;
  preview_large_url: string;
};

export type BotbooruPostsPage = {
  total: number;
  posts: BotbooruPost[];
  limit: number;
  offset: number;
};

export type BotbooruSession = {
  authenticated: boolean;
  id: number | null;
  username: string | null;
  show_nsfw: boolean;
  show_nsfl: boolean;
  show_nsfl_active: boolean;
};

export type ListBotbooruPostsInput = {
  sort?: string;
  q?: string;
  qtext?: string;
  limit?: number;
  offset?: number;
  sfwOnly?: boolean;
  hideAi?: boolean;
};

export type ListBotbooruTagsInput = {
  q?: string;
  limit?: number;
};

export type ListBotbooruRelatedTagsInput = {
  q: string;
  limit?: number;
  sfwOnly?: boolean;
  hideAi?: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeTags(value: unknown): BotbooruTag[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => {
      if (!tag || typeof tag !== "object") return null;
      const row = tag as Record<string, unknown>;
      const name = asString(row.name).trim();
      if (!name) return null;
      return {
        id: asNumber(row.id),
        name,
        category: asString(row.category),
      };
    })
    .filter((tag): tag is BotbooruTag => tag != null);
}

function previewUrl(filename: string, maxEdge: 320 | 480 | 640 = 480): string {
  return `${BOTBOORU_ORIGIN}/images/preview/${maxEdge}/${encodeURIComponent(filename)}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : ""))
    .filter((item) => item.trim().length > 0);
}

function normalizePost(raw: unknown): BotbooruPost | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asNumber(row.id);
  const filename = asString(row.filename).trim();
  if (!id || !filename) return null;

  const description = asString(row.description);
  const creatorNotes = asString(row.creator_notes_display || row.creator_notes);

  return {
    id,
    filename,
    character_name: asString(row.character_name),
    meta_name: asString(row.meta_name),
    tagline: asString(row.tagline),
    description_excerpt:
      asString(row.description_excerpt) || description.slice(0, 220),
    creator_notes_excerpt:
      asString(row.creator_notes_excerpt) || creatorNotes.slice(0, 220),
    created_at: asString(row.created_at),
    tags: normalizeTags(row.tags),
    token_count: asNumber(row.token_count),
    views: asNumber(row.views),
    downloads: asNumber(row.downloads),
    favorite_count: asNumber(row.favorite_count),
    comments_count: asNumber(row.comments_count),
    card_is_animated: asBoolean(row.card_is_animated),
    preview_url: previewUrl(filename),
    post_url: `${BOTBOORU_ORIGIN}/character/${id}`,
    download_url: `${BOTBOORU_ORIGIN}/download/png/${id}`,
  };
}

function normalizePostDetail(raw: unknown): BotbooruPostDetail | null {
  const base = normalizePost(raw);
  if (!base || !raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    ...base,
    description: asString(row.description),
    personality: asString(row.personality),
    first_mes: asString(row.first_mes),
    scenario: asString(row.scenario),
    mes_example: asString(row.mes_example),
    system_prompt: asString(row.system_prompt),
    post_history_instructions: asString(row.post_history_instructions),
    creator_notes: asString(row.creator_notes_display || row.creator_notes),
    alternate_greetings: asStringArray(row.alternate_greetings),
    uploader_name: asString(row.uploader_name),
    has_lorebook: asBoolean(row.has_lorebook),
    preview_large_url: previewUrl(base.filename, 640),
  };
}

function guestSession(): BotbooruSession {
  return {
    authenticated: false,
    id: null,
    username: null,
    show_nsfw: false,
    show_nsfl: false,
    show_nsfl_active: false,
  };
}

function normalizeSession(raw: unknown): BotbooruSession {
  if (!raw || typeof raw !== "object") return guestSession();
  const row = raw as Record<string, unknown>;
  const username = asString(row.username).trim();
  const id = asNumber(row.id);
  if (!username || !id) return guestSession();
  const showNsfl = asBoolean(row.show_nsfl);
  return {
    authenticated: true,
    id,
    username,
    show_nsfw: asBoolean(row.show_nsfw),
    show_nsfl: showNsfl,
    show_nsfl_active: showNsfl
      ? row.show_nsfl_active === undefined
        ? true
        : asBoolean(row.show_nsfl_active)
      : false,
  };
}

function normalizeCatalogTag(raw: unknown): BotbooruCatalogTag | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (asString(row.alias_of).trim()) return null;
  const name = asString(row.name).trim();
  if (!name) return null;
  const tag: BotbooruCatalogTag = {
    id: asNumber(row.id),
    name,
    category: asString(row.category),
    count: asNumber(row.count),
    count_nsfw: asNumber(row.count_nsfw),
    count_nsfl: asNumber(row.count_nsfl),
  };
  if (typeof row.co_count === "number" && Number.isFinite(row.co_count)) {
    tag.co_count = row.co_count;
  }
  return tag;
}

function detailFromBody(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as Record<string, unknown>).detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
    const msg = (detail[0] as Record<string, unknown>).msg;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return fallback;
}

@Injectable()
export class BotbooruService {
  private tagsCache: { fetchedAt: number; tags: BotbooruCatalogTag[] } | null =
    null;

  constructor(private readonly appSettings: AppSettingsService) {}

  private async getStoredToken(): Promise<string | null> {
    const value = await this.appSettings.get(TOKEN_SETTINGS_KEY);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private async setStoredToken(token: string | null): Promise<void> {
    if (!token) {
      await this.appSettings.delete(TOKEN_SETTINGS_KEY);
      return;
    }
    await this.appSettings.set(TOKEN_SETTINGS_KEY, token);
  }

  private authHeaders(token: string | null): Record<string, string> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  private async fetchMe(token: string): Promise<BotbooruSession> {
    let response: Response;
    try {
      response = await fetch(`${BOTBOORU_ORIGIN}/auth/me`, {
        headers: this.authHeaders(token),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new BadGatewayException(
        error instanceof Error
          ? `Botbooru unreachable: ${error.message}`
          : "Botbooru unreachable",
      );
    }

    if (response.status === 401 || response.status === 403) {
      await this.setStoredToken(null);
      throw new UnauthorizedException("Botbooru session expired. Log in again.");
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `Botbooru returned ${response.status} while reading account`,
      );
    }

    const payload = await response.json().catch(() => null);
    const session = normalizeSession(payload);
    if (!session.authenticated) {
      await this.setStoredToken(null);
      throw new UnauthorizedException("Botbooru session invalid. Log in again.");
    }
    return session;
  }

  async getSession(): Promise<BotbooruSession> {
    const token = await this.getStoredToken();
    if (!token) return guestSession();
    try {
      return await this.fetchMe(token);
    } catch (error) {
      if (error instanceof UnauthorizedException) return guestSession();
      throw error;
    }
  }

  async login(username: string, password: string): Promise<BotbooruSession> {
    const user = username.trim();
    if (!user || !password) {
      throw new BadRequestException("Username and password are required");
    }

    const body = new URLSearchParams({ username: user, password });
    let response: Response;
    try {
      response = await fetch(`${BOTBOORU_ORIGIN}/auth/token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new BadGatewayException(
        error instanceof Error
          ? `Botbooru unreachable: ${error.message}`
          : "Botbooru unreachable",
      );
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new UnauthorizedException(
        detailFromBody(payload, "Incorrect username or password"),
      );
    }

    const token =
      payload && typeof payload === "object"
        ? asString((payload as Record<string, unknown>).access_token).trim()
        : "";
    if (!token) {
      throw new BadGatewayException("Botbooru login did not return a token");
    }

    await this.setStoredToken(token);
    return this.fetchMe(token);
  }

  async logout(): Promise<BotbooruSession> {
    await this.setStoredToken(null);
    return guestSession();
  }

  async updatePreferences(input: {
    show_nsfw?: boolean;
    show_nsfl?: boolean;
    show_nsfl_active?: boolean;
  }): Promise<BotbooruSession> {
    const token = await this.getStoredToken();
    if (!token) {
      throw new UnauthorizedException("Log in to Botbooru first");
    }

    const body: Record<string, boolean> = {};
    if (typeof input.show_nsfw === "boolean") body.show_nsfw = input.show_nsfw;
    if (typeof input.show_nsfl === "boolean") body.show_nsfl = input.show_nsfl;
    if (typeof input.show_nsfl_active === "boolean") {
      body.show_nsfl_active = input.show_nsfl_active;
    }
    if (Object.keys(body).length === 0) return this.fetchMe(token);

    let response: Response;
    try {
      response = await fetch(`${BOTBOORU_ORIGIN}/auth/me`, {
        method: "PATCH",
        headers: {
          ...this.authHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new BadGatewayException(
        error instanceof Error
          ? `Botbooru unreachable: ${error.message}`
          : "Botbooru unreachable",
      );
    }

    if (response.status === 401 || response.status === 403) {
      await this.setStoredToken(null);
      throw new UnauthorizedException("Botbooru session expired. Log in again.");
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new BadGatewayException(
        detailFromBody(payload, `Botbooru returned ${response.status}`),
      );
    }

    const payload = await response.json().catch(() => null);
    return normalizeSession(payload);
  }

  private async fetchAllCatalogTags(): Promise<BotbooruCatalogTag[]> {
    const now = Date.now();
    if (this.tagsCache && now - this.tagsCache.fetchedAt < 5 * 60_000) {
      return this.tagsCache.tags;
    }

    const token = await this.getStoredToken();
    let response: Response;
    try {
      response = await fetch(`${BOTBOORU_ORIGIN}/tags/`, {
        headers: this.authHeaders(token),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      throw new BadGatewayException(
        error instanceof Error
          ? `Botbooru unreachable: ${error.message}`
          : "Botbooru unreachable",
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `Botbooru returned ${response.status} while listing tags`,
      );
    }
    const payload = await response.json().catch(() => null);
    const rows = Array.isArray(payload) ? payload : [];
    const tags = rows
      .map((row) => normalizeCatalogTag(row))
      .filter((tag): tag is BotbooruCatalogTag => tag != null)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    this.tagsCache = { fetchedAt: now, tags };
    return tags;
  }

  async listTags(input: ListBotbooruTagsInput = {}): Promise<BotbooruCatalogTag[]> {
    const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 50)));
    const q = (input.q ?? "").trim().toLowerCase();
    const tags = await this.fetchAllCatalogTags();
    if (!q) return tags.slice(0, limit);

    const matched = tags.filter((tag) => {
      const name = tag.name.toLowerCase();
      const category = tag.category.toLowerCase();
      return name.includes(q) || `${category}:${name}`.includes(q);
    });
    matched.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return b.count - a.count || a.name.localeCompare(b.name);
    });
    return matched.slice(0, limit);
  }

  async listRelatedTags(
    input: ListBotbooruRelatedTagsInput,
  ): Promise<BotbooruCatalogTag[]> {
    const q = input.q.trim();
    if (!q) return this.listTags({ limit: input.limit ?? 50 });

    const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 50)));
    const token = await this.getStoredToken();
    const params = new URLSearchParams({ q });
    if (input.sfwOnly !== false) params.set("sfw_only", "true");
    if (input.hideAi) params.set("hide_ai", "true");

    let response: Response;
    try {
      response = await fetch(`${BOTBOORU_ORIGIN}/tags/related/?${params}`, {
        headers: this.authHeaders(token),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new BadGatewayException(
        error instanceof Error
          ? `Botbooru unreachable: ${error.message}`
          : "Botbooru unreachable",
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `Botbooru returned ${response.status} while listing related tags`,
      );
    }
    const payload = await response.json().catch(() => null);
    const rows = Array.isArray(payload) ? payload : [];
    return rows
      .map((row) => normalizeCatalogTag(row))
      .filter((tag): tag is BotbooruCatalogTag => tag != null)
      .slice(0, limit);
  }

  async listPosts(input: ListBotbooruPostsInput = {}): Promise<BotbooruPostsPage> {
    const sortRaw = (input.sort ?? "latest").trim().toLowerCase();
    const sort = ALLOWED_SORTS.has(sortRaw) ? sortRaw : "latest";
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(input.limit ?? DEFAULT_LIMIT)),
    );
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const q = (input.q ?? "").trim();
    const qtext = (input.qtext ?? "").trim();
    const sfwOnly = input.sfwOnly !== false;
    const hideAi = input.hideAi === true;
    const token = await this.getStoredToken();

    const params = new URLSearchParams({
      sort,
      limit: String(limit),
      offset: String(offset),
    });
    if (q) params.set("q", q);
    if (qtext) params.set("qtext", qtext);
    if (sfwOnly) params.set("sfw_only", "true");
    if (hideAi) params.set("hide_ai", "true");

    let response: Response;
    try {
      response = await fetch(`${BOTBOORU_ORIGIN}/posts/?${params}`, {
        headers: this.authHeaders(token),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new BadGatewayException(
        error instanceof Error
          ? `Botbooru unreachable: ${error.message}`
          : "Botbooru unreachable",
      );
    }

    if (response.status === 401 || response.status === 403) {
      await this.setStoredToken(null);
      throw new UnauthorizedException("Botbooru session expired. Log in again.");
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `Botbooru returned ${response.status} while listing posts`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException("Botbooru returned invalid JSON");
    }

    const root =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    const posts = Array.isArray(root.posts)
      ? root.posts
          .map((post) => normalizePost(post))
          .filter((post): post is BotbooruPost => post != null)
      : [];

    return {
      total: asNumber(root.total),
      posts,
      limit,
      offset,
    };
  }

  async getPost(postId: number): Promise<BotbooruPostDetail> {
    if (!Number.isInteger(postId) || postId <= 0) {
      throw new BadRequestException("Invalid Botbooru post id");
    }

    const token = await this.getStoredToken();
    let response: Response;
    try {
      response = await fetch(`${BOTBOORU_ORIGIN}/post/${postId}`, {
        headers: this.authHeaders(token),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new BadGatewayException(
        error instanceof Error
          ? `Botbooru unreachable: ${error.message}`
          : "Botbooru unreachable",
      );
    }

    if (response.status === 401 || response.status === 403) {
      await this.setStoredToken(null);
      throw new UnauthorizedException("Botbooru session expired. Log in again.");
    }
    if (response.status === 404) {
      throw new NotFoundException(`Botbooru post ${postId} not found`);
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `Botbooru returned ${response.status} while loading post`,
      );
    }

    const payload = await response.json().catch(() => null);
    const detail = normalizePostDetail(payload);
    if (!detail) {
      throw new NotFoundException(`Botbooru post ${postId} not found`);
    }
    return detail;
  }

  async downloadPng(postId: number): Promise<{
    buffer: Buffer;
    fileName: string;
  }> {
    if (!Number.isInteger(postId) || postId <= 0) {
      throw new BadRequestException("Invalid Botbooru post id");
    }

    const token = await this.getStoredToken();
    let response: Response;
    try {
      response = await fetch(`${BOTBOORU_ORIGIN}/download/png/${postId}`, {
        headers: {
          Accept: "image/png,*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(60_000),
        redirect: "follow",
      });
    } catch (error) {
      throw new BadGatewayException(
        error instanceof Error
          ? `Botbooru unreachable: ${error.message}`
          : "Botbooru unreachable",
      );
    }

    if (response.status === 401 || response.status === 403) {
      await this.setStoredToken(null);
      throw new UnauthorizedException(
        "Botbooru requires login to download this card. Log in and try again.",
      );
    }
    if (response.status === 404) {
      throw new NotFoundException(`Botbooru post ${postId} not found`);
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `Botbooru returned ${response.status} while downloading PNG`,
      );
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
      throw new BadGatewayException(
        contentType.includes("json") || contentType.includes("html")
          ? "Botbooru did not return a PNG card (login may be required)"
          : "Botbooru download was not a valid PNG",
      );
    }

    return {
      buffer: bytes,
      fileName: `botbooru-${postId}.png`,
    };
  }
}
