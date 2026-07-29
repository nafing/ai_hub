import type { CharacterFolder } from "./types";

export type CreateCharacterFolderInput = Omit<CharacterFolder, "id">;

export type UpdateCharacterFolderInput = Partial<CreateCharacterFolderInput>;
