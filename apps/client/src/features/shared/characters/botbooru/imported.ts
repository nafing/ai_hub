import type { CharacterListItem } from "@ai-hub/shared";
import { botbooruDisplayName, type BotbooruPost } from "./types";

export function buildImportedBotbooruPostIds(
  characters: CharacterListItem[],
): Set<number> {
  const ids = new Set<number>();
  for (const character of characters) {
    const postId = character.botbooru_post_id;
    if (typeof postId === "number" && Number.isInteger(postId) && postId > 0) {
      ids.add(postId);
    }
  }
  return ids;
}

export function isBotbooruPostImported(
  post: Pick<BotbooruPost, "id" | "character_name" | "meta_name">,
  characters: CharacterListItem[],
  importedIds: Set<number> = buildImportedBotbooruPostIds(characters),
): boolean {
  if (importedIds.has(post.id)) return true;

  const displayName = botbooruDisplayName(post).trim().toLowerCase();
  if (!displayName) return false;

  return characters.some(
    (character) => (character.name || "").trim().toLowerCase() === displayName,
  );
}

export function withBotbooruPostId<T extends { botbooru_post_id?: number | null }>(
  data: T,
  postId: number,
): T & { botbooru_post_id: number } {
  return {
    ...data,
    botbooru_post_id: postId,
  };
}
