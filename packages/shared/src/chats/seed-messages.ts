import type { Character } from "../characters/types";
import { createChatMessage } from "./defaults";
import type { ChatMessage } from "./types";

/** `first_mes` + `alternate_greetings` as swipe branches. */
function resolveGreetingSwipes(character: Pick<Character, "data">): string[] {
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
