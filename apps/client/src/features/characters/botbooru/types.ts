export type BotbooruTag = {
  id: number;
  name: string;
  category: string;
};

export type BotbooruCatalogTag = {
  id: number;
  name: string;
  category: string;
  count: number;
  count_nsfw: number;
  count_nsfl: number;
  co_count?: number;
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

export type BotbooruSort =
  | "latest"
  | "random"
  | "favorited"
  | "viewed"
  | "downloads"
  | "curated";

export type ListBotbooruPostsParams = {
  sort?: BotbooruSort;
  q?: string;
  qtext?: string;
  limit?: number;
  offset?: number;
  sfwOnly?: boolean;
  hideAi?: boolean;
};

export type ListBotbooruTagsParams = {
  q?: string;
  limit?: number;
};

export type ListBotbooruRelatedTagsParams = {
  q: string;
  limit?: number;
  sfwOnly?: boolean;
  hideAi?: boolean;
};

export function botbooruDisplayName(
  post: Pick<BotbooruPost, "id" | "character_name" | "meta_name">,
): string {
  const override = post.meta_name.trim();
  if (override) return override;
  return post.character_name.trim() || `Post #${post.id}`;
}

export function botbooruContentRating(
  post: Pick<BotbooruPost, "tags">,
): "sfw" | "nsfw" | "nsfl" {
  const names = new Set(post.tags.map((tag) => tag.name.toLowerCase()));
  if (names.has("nsfl")) return "nsfl";
  if (names.has("nsfw")) return "nsfw";
  if (names.has("sfw")) return "sfw";
  return "nsfw";
}

export function appendBotbooruSearchTerm(
  current: string,
  term: string,
): string {
  const next = term.trim();
  if (!next) return current;
  const parts = current.trim() ? current.trim().split(/\s+/) : [];
  if (parts.some((part) => part.toLowerCase() === next.toLowerCase())) {
    return parts.join(" ");
  }
  parts.push(next);
  return parts.join(" ");
}
