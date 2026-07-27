import type { Lorebook } from "./types";

export type CreateLorebookInput = Omit<Lorebook, "id" | "index_dirty">;

export type UpdateLorebookInput = Partial<CreateLorebookInput>;

export type LorebookListItem = Pick<
  Lorebook,
  | "id"
  | "name"
  | "description"
  | "enabled"
  | "global"
  | "category"
  | "linked_characters"
  | "linked_personas"
  | "scan_depth"
  | "token_budget"
  | "recursive_scanning"
  | "index_dirty"
> & {
  entry_count: number;
};

/** LanceDB index health for the lore library. */
export type LoreIndexStatus = {
  indexed_rows: number;
  lorebook_count: number;
  dirty_count: number;
  dirty_ids: string[];
};
