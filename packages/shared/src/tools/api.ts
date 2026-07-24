import type { Tool } from "./types";

export type CreateToolInput = Omit<Tool, "id" | "is_built_in">;

export type UpdateToolInput = Partial<CreateToolInput>;

export type ToolListItem = Pick<
  Tool,
  "id" | "name" | "description" | "is_built_in"
> & {
  /** Number of top-level parameter properties. */
  parameter_count: number;
};
