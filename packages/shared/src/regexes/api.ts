import type { RegexScript } from "./types";

export type CreateRegexScriptInput = Omit<RegexScript, "id">;

export type UpdateRegexScriptInput = Partial<CreateRegexScriptInput>;

export type RegexScriptListItem = Pick<
  RegexScript,
  | "id"
  | "name"
  | "enabled"
  | "find_regex"
  | "replace_with"
  | "targets"
  | "apply_to"
  | "order"
  | "scope"
>;
