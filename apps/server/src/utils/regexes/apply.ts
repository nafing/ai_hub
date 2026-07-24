/**
 * Re-export prompt-stage apply helper for chat generation pipeline.
 * Display-stage apply lives on the client (`use-apply-regex`).
 */
export {
  applyRegexScriptsToPromptMessages,
  applyRegexScriptsToMessages,
  sortRegexScripts,
  type RegexApplyMessage,
  type RegexApplyReport,
  type ApplyRegexScriptsOptions,
} from "@ai-hub/shared";
