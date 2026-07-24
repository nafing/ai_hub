import type { Character } from "../characters/types";
import { createChatMessage } from "./defaults";
import type { ChatMessage, ChatMessageRole } from "./types";

export type MesExampleTurn = {
  role: Extract<ChatMessageRole, "user" | "assistant">;
  content: string;
};

/**
 * Parse SillyTavern-style `mes_example` into user/assistant turns.
 * Supports `{{user}}:`, `{{char}}:`, `User:`, and `CharName:` prefixes.
 * Blocks may be separated by blank lines or `<START>` markers.
 */
export function parseMesExample(
  mesExample: string,
  options: { charName?: string; userName?: string } = {},
): MesExampleTurn[] {
  const raw = mesExample.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  const charName = options.charName?.trim() || "Char";
  const userName = options.userName?.trim() || "User";
  const charAliases = new Set(
    [charName, "char", "{{char}}"].map((name) => name.toLowerCase()),
  );
  const userAliases = new Set(
    [userName, "user", "{{user}}"].map((name) => name.toLowerCase()),
  );

  const turns: MesExampleTurn[] = [];
  let current: MesExampleTurn | null = null;

  const flush = () => {
    if (!current) return;
    const content = current.content.trim();
    if (content) turns.push({ role: current.role, content });
    current = null;
  };

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^<start>$/i.test(trimmed)) {
      flush();
      continue;
    }

    const match = trimmed.match(/^([^:]{1,80}):\s*([\s\S]*)$/);
    if (match) {
      const label = match[1].trim().toLowerCase();
      const rest = match[2] ?? "";
      let role: MesExampleTurn["role"] | null = null;
      if (userAliases.has(label)) role = "user";
      else if (charAliases.has(label)) role = "assistant";
      else if (label === charName.toLowerCase()) role = "assistant";

      if (role) {
        flush();
        current = { role, content: rest };
        continue;
      }
    }

    if (current) {
      current.content += `\n${line}`;
    } else {
      // Unprefixed line — treat as assistant example
      current = { role: "assistant", content: line };
    }
  }
  flush();
  return turns;
}

/** `first_mes` + `alternate_greetings` as swipe branches. */
export function resolveGreetingSwipes(
  character: Pick<Character, "data">,
): string[] {
  const first = character.data.first_mes?.trim() ?? "";
  const alternates = (character.data.alternate_greetings ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  return [first, ...alternates].filter(Boolean);
}

/**
 * Seed messages for a character at chat create:
 * greeting with all swipe branches (`first_mes` + `alternate_greetings`).
 */
export function buildCharacterGreetingMessage(input: {
  character: Character;
  greetingIndex?: number;
  createdAt?: string;
  id?: string;
}): ChatMessage | null {
  const swipes = resolveGreetingSwipes(input.character);
  if (!swipes.length) return null;

  const swipeId = Math.min(
    Math.max(input.greetingIndex ?? 0, 0),
    swipes.length - 1,
  );

  return createChatMessage({
    role: "assistant",
    content: swipes[swipeId]!,
    id: input.id,
    character_id: input.character.id,
    created_at: input.createdAt,
    swipes,
    swipe_id: swipeId,
  });
}
