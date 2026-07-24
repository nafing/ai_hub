import type { RegexScript } from "./types";

export function defaultRegexScript(): Omit<RegexScript, "id"> {
  return {
    name: "",
    enabled: true,
    find_regex: "",
    replace_with: "",
    flags: "g",
    targets: ["ai_output"],
    apply_to: "both",
    order: 100,
    min_depth: null,
    max_depth: null,
    scope: "global",
    character_ids: [],
  };
}
