/**
 * Named set of characters for quick roster selection in chats.
 */
export type CharacterFolder = {
  id: string;
  name: string;
  /** Ordered character ids in this folder. */
  character_ids: string[];
};
