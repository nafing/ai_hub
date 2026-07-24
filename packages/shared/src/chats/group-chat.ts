import type { Character } from "../characters/types";
import { characterTalkativeness } from "../characters/talkativeness";
import { activeMessageText } from "./history";
import { parseSlashCommand } from "./slash-commands";
import type { ChatMessage, ChatSettings } from "./types";

export type SlashCommand = "guided" | "impersonate";
export { parseSlashCommand };

export type SpeakerTurn =
  | { kind: "character"; characterId: string }
  | { kind: "merged" }
  | { kind: "impersonate" };

export type SpeakerQueueResult =
  | { status: "ready"; turns: SpeakerTurn[] }
  | { status: "needs_smart" }
  | { status: "empty"; reason: string }
  | { status: "error"; reason: string };

export function isGroupChat(
  settings: Pick<ChatSettings, "character_ids">,
): boolean {
  return settings.character_ids.length > 1;
}

/**
 * Parse `@Name` mentions against chat characters (case-insensitive, longest name first).
 */
export function parseMentions(
  text: string,
  characters: Array<{ id: string; data: { name: string } }>,
): string[] {
  if (!text.trim() || !characters.length) return [];

  const sorted = [...characters]
    .map((character) => ({
      id: character.id,
      name: character.data.name.trim(),
    }))
    .filter((item) => item.name.length > 0)
    .sort((a, b) => b.name.length - a.name.length);

  const found: string[] = [];
  const seen = new Set<string>();
  // Match @Name where Name can include spaces until punctuation / another @ / EOL
  const mentionRe = /@([^\n@]+?)(?=\s{2}|[.,!?;:\n]|$|\s@|\s*$)/gi;
  let match: RegExpExecArray | null;
  const haystack = text;

  while ((match = mentionRe.exec(haystack)) !== null) {
    const raw = match[1]?.trim() ?? "";
    if (!raw) continue;
    const lower = raw.toLowerCase();
    for (const candidate of sorted) {
      const nameLower = candidate.name.toLowerCase();
      if (lower === nameLower || lower.startsWith(`${nameLower} `)) {
        if (!seen.has(candidate.id)) {
          seen.add(candidate.id);
          found.push(candidate.id);
        }
        break;
      }
      // Prefix match: @Ali for Alice when unique enough
      if (
        nameLower.startsWith(lower) &&
        !seen.has(candidate.id) &&
        lower.length >= 2
      ) {
        seen.add(candidate.id);
        found.push(candidate.id);
        break;
      }
    }
  }

  return found;
}

/** Prefer a character other than the last assistant speaker; else first in list. */
export function fallbackSpeakerId(
  characterIds: string[],
  messages: ChatMessage[],
): string | null {
  if (!characterIds.length) return null;
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const lastId = lastAssistant?.character_id ?? null;
  if (lastId) {
    const other = characterIds.find((id) => id !== lastId);
    if (other) return other;
  }
  return characterIds[0] ?? null;
}

export function resolveSpeakerQueue(input: {
  settings: ChatSettings;
  characters: Array<Pick<Character, "id" | "data">>;
  messages: ChatMessage[];
  userMessage?: string | null;
  forCharacterId?: string | null;
}): SpeakerQueueResult {
  const { settings, characters, messages, userMessage, forCharacterId } = input;
  const characterIds = settings.character_ids.filter(Boolean);
  const characterIdSet = new Set(characters.map((c) => c.id));

  if (forCharacterId) {
    if (!characterIds.includes(forCharacterId) || !characterIdSet.has(forCharacterId)) {
      return {
        status: "error",
        reason: "forCharacterId is not a member of this chat",
      };
    }
    return {
      status: "ready",
      turns: [{ kind: "character", characterId: forCharacterId }],
    };
  }

  const rawText = userMessage?.trim() ?? "";
  const { command } = parseSlashCommand(rawText);
  // Mentions are parsed from the full raw text (including after slash command).
  const mentionSource =
    command != null ? parseSlashCommand(rawText).rest || rawText : rawText;
  const mentioned = parseMentions(mentionSource, characters).filter((id) =>
    characterIds.includes(id),
  );

  if (command === "impersonate") {
    return { status: "ready", turns: [{ kind: "impersonate" }] };
  }

  if (mentioned.length) {
    return {
      status: "ready",
      turns: mentioned.map((characterId) => ({
        kind: "character" as const,
        characterId,
      })),
    };
  }

  // Single character (or no group): one merged-style / primary turn
  if (!isGroupChat(settings)) {
    const only = characterIds[0];
    if (!only) {
      return { status: "ready", turns: [{ kind: "merged" }] };
    }
    return {
      status: "ready",
      turns: [{ kind: "character", characterId: only }],
    };
  }

  if (settings.group_mode === "merged") {
    return { status: "ready", turns: [{ kind: "merged" }] };
  }

  // Individual
  if (command === "guided") {
    const fallback = fallbackSpeakerId(characterIds, messages);
    if (!fallback) {
      return { status: "error", reason: "No characters available for queue" };
    }
    return {
      status: "ready",
      turns: [{ kind: "character", characterId: fallback }],
    };
  }

  if (settings.response_order === "manual") {
    return {
      status: "empty",
      reason:
        "Manual order requires an @mention, character picker, or Trigger Response",
    };
  }

  if (settings.response_order === "sequential") {
    if (!characterIds.length) {
      return { status: "error", reason: "No characters available for queue" };
    }
    return {
      status: "ready",
      turns: characterIds.map((characterId) => ({
        kind: "character" as const,
        characterId,
      })),
    };
  }

  // smart
  return { status: "needs_smart" };
}

/** Compact candidate summary for the Smart selector prompt. */
export function formatSmartCandidate(
  character: Pick<Character, "id" | "data">,
): string {
  const name = character.data.name.trim() || "Unnamed";
  const personality = character.data.personality.trim().slice(0, 280);
  const description = character.data.description.trim().slice(0, 280);
  const talkativeness = characterTalkativeness(character);
  return [
    `id: ${character.id}`,
    `name: ${name}`,
    `talkativeness: ${talkativeness}`,
    personality ? `personality: ${personality}` : null,
    description ? `description: ${description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatRecentHistoryForSmart(
  messages: ChatMessage[],
  nameByCharacterId: Map<string, string>,
  options: { userName?: string; limit?: number } = {},
): string {
  const limit = options.limit ?? 5;
  const userLabel = options.userName?.trim() || "User";
  const slice = messages.slice(-limit);
  return slice
    .map((message) => {
      const text = activeMessageText(message).trim();
      if (!text) return null;
      let label = "System";
      if (message.role === "user") label = userLabel;
      else if (message.role === "assistant") {
        label =
          (message.character_id &&
            nameByCharacterId.get(message.character_id)) ||
          "Assistant";
      }
      return `${label}: ${text}`;
    })
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

/** Parse Smart selector JSON array of character IDs. */
export function parseSmartSpeakerIds(
  raw: string,
  allowedIds: string[],
): string[] {
  const allowed = new Set(allowedIds);
  const trimmed = raw.trim();
  // Prefer fenced or raw JSON array
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return [];
  try {
    const parsed = JSON.parse(arrayMatch[0]) as unknown;
    if (!Array.isArray(parsed)) return [];
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      if (!allowed.has(item) || seen.has(item)) continue;
      seen.add(item);
      ids.push(item);
    }
    return ids;
  } catch {
    return [];
  }
}
