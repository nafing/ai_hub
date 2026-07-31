import { useCallback, useMemo } from "react";
import {
  applyRegexScriptsToDisplayMessages,
  applyRegexScriptsToText,
  type ApplyRegexScriptsOptions,
  type RegexApplyMessage,
} from "@ai-hub/shared";
import { useRegexes } from "@/features/api-queries/regexes/queries";

type UseApplyRegexOptions = {
  /** When false, skip fetching (e.g. chat not ready). Default true. */
  enabled?: boolean;
  characterId?: string | null;
};

/**
 * Client-side display pipeline: load enabled regex scripts and apply them
 * when rendering chat messages.
 */
export function useApplyRegex(options: UseApplyRegexOptions = {}) {
  const { enabled = true, characterId = null } = options;
  const listQuery = useRegexes({ enabled });

  const scripts = useMemo(
    () => (listQuery.data ?? []).filter((script) => script.enabled),
    [listQuery.data],
  );

  const applyToMessages = useCallback(
    (
      messages: RegexApplyMessage[],
      extra?: Omit<ApplyRegexScriptsOptions, "stage" | "depth">,
    ) =>
      applyRegexScriptsToDisplayMessages(messages, scripts, {
        characterId,
        ...extra,
      }),
    [scripts, characterId],
  );

  const applyToText = useCallback(
    (
      text: string,
      message: Pick<RegexApplyMessage, "role" | "character_id">,
      depth = 0,
    ) =>
      applyRegexScriptsToText(text, scripts, message, {
        stage: "display",
        depth,
        characterId,
      }),
    [scripts, characterId],
  );

  return {
    scripts,
    isLoading: enabled && listQuery.isLoading,
    isError: listQuery.isError,
    applyToMessages,
    applyToText,
  };
}
