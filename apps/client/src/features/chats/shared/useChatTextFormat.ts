import { DEFAULT_PRESET } from "@/features/theme/presets";
import { useThemeStore } from "@/features/theme/themeStore";
import { useChatFormatStore } from "./chatFormatStore";
import type { FormatChatTextOptions } from "./formatChatText";

/**
 * Live chat text-format options from Settings → Text formats (theme + bold).
 * `dialogueColorOverride` (per-character) wins over the global speech color.
 */
export function useChatTextFormat(
  dialogueColorOverride?: string | null,
): FormatChatTextOptions {
  const dialogueBold = useChatFormatStore((s) => s.dialogueBold);
  const speech = useThemeStore((s) => s.baseColors.speech);
  const thoughts = useThemeStore((s) => s.baseColors.thoughts);
  const emphasis = useThemeStore((s) => s.baseColors.emphasis);

  const override = dialogueColorOverride?.trim() || null;

  return {
    dialogueColor: override ?? speech ?? DEFAULT_PRESET.colors.speech,
    thoughtsColor: thoughts ?? DEFAULT_PRESET.colors.thoughts,
    emphasisColor: emphasis ?? DEFAULT_PRESET.colors.emphasis,
    dialogueBold,
  };
}
