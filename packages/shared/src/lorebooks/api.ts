import type { Lorebook } from "./types";

export type CreateLorebookInput = Omit<Lorebook, "id">;

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
> & {
  entry_count: number;
};
