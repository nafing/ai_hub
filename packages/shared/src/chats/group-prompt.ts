import { wrapSectionContent } from "../presets/build-prompt";
import type { WrapFormat } from "../presets/types";
import type { ChatMode, ChatSettings } from "./types";

export function isGroupChat(
  settings: Pick<ChatSettings, "character_ids">,
): boolean {
  return settings.character_ids.length > 1;
}

/** Marinara `groupSpeakerColors` — speaker tags in merged group replies. */
export function groupSpeakerTagsEnabled(
  mode: ChatMode,
  settings: Pick<
    ChatSettings,
    "character_ids" | "group_mode" | "group_speaker_tags"
  >,
): boolean {
  if (!isGroupChat(settings) || settings.group_mode !== "merged") return false;
  if (mode === "conversation") return true;
  return settings.group_speaker_tags === true;
}

export function shouldPrefixGroupHistorySpeakers(
  mode: ChatMode,
  settings: Pick<
    ChatSettings,
    | "character_ids"
    | "group_mode"
    | "group_speaker_names_in_history"
  >,
): boolean {
  return (
    isGroupChat(settings) &&
    settings.group_mode === "individual" &&
    mode === "roleplay" &&
    settings.group_speaker_names_in_history === true
  );
}

/** Whether chat_history assistant lines include `Name:` prefixes. */
export function groupHistoryUsesSpeakerPrefix(
  mode: ChatMode,
  settings: Pick<
    ChatSettings,
    | "character_ids"
    | "group_mode"
    | "group_speaker_names_in_history"
  >,
): boolean {
  return !(
    isGroupChat(settings) &&
    settings.group_mode === "individual" &&
    mode === "roleplay" &&
    !settings.group_speaker_names_in_history
  );
}

const CONVERSATION_GROUP_NAME_PREFIX_INSTRUCTION =
  "Remember to prefix messages with `Name: message`!";

export function buildConversationGroupOutputFormat(input: {
  wrapFormat: WrapFormat;
  characterNames: string[];
  userName: string;
  turnCharacterName?: string | null;
}): string {
  const characterList = Array.from(
    new Set(input.characterNames.map((name) => name.trim()).filter(Boolean)),
  ).join(", ");
  const userName = input.userName.trim() || "the user";
  const responseBoundary = `Only respond for these characters: ${characterList || "the listed characters"}. Never respond for ${userName} or write ${userName}'s messages.`;
  const turnCharacterName = input.turnCharacterName?.trim();
  const body = turnCharacterName
    ? `Respond only as ${turnCharacterName}.`
    : [CONVERSATION_GROUP_NAME_PREFIX_INSTRUCTION, responseBoundary].join("\n");
  return wrapSectionContent("Output Format", body, input.wrapFormat);
}

export function buildGroupChatRuntimeInstructions(input: {
  mode: ChatMode;
  settings: Pick<
    ChatSettings,
    "character_ids" | "group_mode" | "group_speaker_tags"
  >;
  characterNames: string[];
  wrapFormat?: WrapFormat;
}): string | null {
  if (!isGroupChat(input.settings)) return null;

  const parts: string[] = [];
  if (groupSpeakerTagsEnabled(input.mode, input.settings)) {
    const example = input.characterNames[0]?.trim() || "Character";
    parts.push(
      `- Since this is a group chat, wrap each character's dialogue in <speaker="name"> tags. Tags can appear inline with narration, they don't need to be on separate lines. Example: <speaker="${example}">"Hello there,"</speaker> [action beat/dialogue tag].`,
    );
  }

  if (parts.length === 0) return null;
  const body = parts.join("\n");
  const wrapFormat = input.wrapFormat ?? "none";
  return wrapFormat === "markdown"
    ? `## Group Chat\n${body}`
    : body;
}
