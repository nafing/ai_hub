import type { Character, CharacterCardData, CharacterVersion } from "./types";

/** Create payload — avatar/gallery are uploaded separately. */
export type CreateCharacterInput = Omit<
  Character,
  "id" | "avatar" | "gallery" | "active_version_id" | "versions"
>;

export type UpdateCharacterInput = Partial<CreateCharacterInput> & {
  /** Switch which version is active (and returned as `data`). */
  active_version_id?: string;
  /**
   * When true with `data`, save edits as a new version instead of overwriting
   * the active one. Optional `version_label` overrides the auto-bumped label.
   */
  create_version?: boolean;
  version_label?: string;
};

export type CharacterListItem = {
  id: string;
  /** Public API path for the avatar image, or null. */
  avatar: string | null;
  name: string;
  description: string;
  creator: string;
  character_version: string;
  tags: string[];
  name_color?: string | null;
  dialogue_color?: string | null;
  message_box_color?: string | null;
  /** Set when imported from Botbooru. */
  botbooru_post_id?: number | null;
};
