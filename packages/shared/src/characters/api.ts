import type { Character } from "./types";

/** Create payload — avatar is uploaded separately via PUT /characters/:id/avatar. */
export type CreateCharacterInput = Omit<Character, "id" | "avatar">;

export type UpdateCharacterInput = Partial<CreateCharacterInput>;

export type CharacterListItem = {
  id: string;
  /** Public API path for the avatar image, or null. */
  avatar: string | null;
  name: string;
  description: string;
  creator: string;
  character_version: string;
  tags: string[];
};
