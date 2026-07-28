import type { ChatMessage } from "@ai-hub/shared";
import { ChatEntity } from "../chats/chat.entity";

export const TWATTER_CHAT_CONTEXT_MESSAGE_LIMIT = 12;

function messageRoleLabel(role: string): string {
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  if (role === "system") return "system";
  return "system";
}

function messageContent(message: ChatMessage): string {
  const swipeId = Math.min(
    Math.max(0, message.swipe_id),
    Math.max(0, message.swipes.length - 1),
  );
  return String(message.swipes[swipeId] ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

function escapePromptAttribute(value: string): string {
  return value.replace(/"/g, "'").replace(/[<>]/g, "");
}

export async function buildOptedInChatContext(input: {
  chats: ChatEntity[];
  invitedCharacterIds: Set<string>;
  resolvePersonaName: (personaId: string | null) => Promise<string>;
  resolveCharacterName: (characterId: string) => Promise<string>;
}): Promise<string> {
  if (input.invitedCharacterIds.size === 0) {
    return "No invited characters are eligible for Twatter chat context.";
  }

  const relevant = input.chats.filter((chat) => {
    if (!chat.settings.allow_twatter_references) return false;
    return chat.settings.character_ids.some((characterId) =>
      input.invitedCharacterIds.has(characterId),
    );
  });

  if (relevant.length === 0) {
    return "No chats opted in to Twatter references for invited characters.";
  }

  const characterNameCache = new Map<string, string>();
  const personaNameCache = new Map<string, string>();
  const blocks: string[] = [];

  for (const chat of relevant) {
    const messages = chat.messages.slice(-TWATTER_CHAT_CONTEXT_MESSAGE_LIMIT);
    if (messages.length === 0) continue;

    const personaName = await input.resolvePersonaName(chat.settings.persona_id);
    const characterNames = await Promise.all(
      chat.settings.character_ids.map(async (characterId) => ({
        id: characterId,
        name:
          characterNameCache.get(characterId) ??
          (await input.resolveCharacterName(characterId).then((name) => {
            characterNameCache.set(characterId, name);
            return name;
          })),
      })),
    );
    const speakerNameByCharacterId = new Map(
      characterNames.map((character) => [character.id, character.name]),
    );

    const participantLines = [
      `- User persona: ${personaName}`,
      ...characterNames.map((character) => `- Character: ${character.name}`),
    ];

    const messageLines = await Promise.all(
      messages.map(async (message) => {
        const role = messageRoleLabel(message.role);
        let speaker =
          role === "user"
            ? personaName
            : role === "system"
              ? "System"
              : "Assistant";
        if (message.character_id) {
          speaker =
            speakerNameByCharacterId.get(message.character_id) ??
            (await input.resolveCharacterName(message.character_id));
        }
        const content = messageContent(message);
        if (!content) return null;
        return `- ${speaker} (${role}): ${content}`;
      }),
    );

    const filteredMessageLines = messageLines.filter(
      (line): line is string => Boolean(line),
    );
    if (filteredMessageLines.length === 0) continue;

    blocks.push(
      [
        `<chat_context id="${escapePromptAttribute(chat.id)}" mode="${escapePromptAttribute(
          chat.mode,
        )}" name="${escapePromptAttribute(chat.title || "Untitled chat")}">`,
        "Participants:",
        participantLines.join("\n"),
        "Recent messages:",
        filteredMessageLines.join("\n"),
        "</chat_context>",
      ].join("\n"),
    );
  }

  return blocks.length > 0
    ? blocks.join("\n\n")
    : "Opted-in chats had no recent messages.";
}
