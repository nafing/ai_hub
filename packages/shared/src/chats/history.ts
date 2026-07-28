import type { ChatMessage } from "./types";

/** Active swipe text for a persisted chat message. */
export function activeMessageText(message: ChatMessage): string {
  const swipe = message.swipes[message.swipe_id];
  if (typeof swipe === "string") return swipe;
  return message.swipes[0] ?? "";
}

/**
 * Format messages for the `chat_history` preset marker.
 * Uses User / Char / System labels (SillyTavern-style).
 * When `nameByCharacterId` is set, each assistant turn uses that character's name.
 */
export function formatChatHistoryMarker(
  messages: ChatMessage[],
  options: {
    charName?: string;
    userName?: string;
    nameByCharacterId?: Map<string, string> | Record<string, string>;
    /**
     * When false, assistant lines use raw text (Marinara individual mode default).
     * User lines still use the persona label.
     */
    prefixSpeakerNames?: boolean;
  } = {},
): string {
  const userLabel = options.userName?.trim() || "User";
  const charLabel = options.charName?.trim() || "Char";
  const prefixSpeakerNames = options.prefixSpeakerNames !== false;
  const nameMap =
    options.nameByCharacterId instanceof Map
      ? options.nameByCharacterId
      : options.nameByCharacterId
        ? new Map(Object.entries(options.nameByCharacterId))
        : null;

  return messages
    .map((message) => {
      const text = activeMessageText(message).trim();
      if (!text) return null;
      let label: string;
      if (message.role === "user") {
        label = userLabel;
      } else if (message.role === "system") {
        label = "System";
      } else if (
        prefixSpeakerNames &&
        message.character_id &&
        nameMap?.has(message.character_id)
      ) {
        label = nameMap.get(message.character_id) || charLabel;
      } else if (prefixSpeakerNames) {
        label = charLabel;
      } else if (message.role === "assistant") {
        return text;
      } else {
        label = charLabel;
      }
      return `${label}: ${text}`;
    })
    .filter((line): line is string => Boolean(line))
    .join("\n");
}
