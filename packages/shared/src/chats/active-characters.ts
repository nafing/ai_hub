import type { ChatSettings } from "./types";

/** Keep only inactive ids that are still chat members. */
export function normalizeInactiveCharacterIds(
  characterIds: string[],
  inactiveIds: unknown,
): string[] {
  const members = new Set(characterIds.filter(Boolean));
  if (!Array.isArray(inactiveIds)) return [];
  return [
    ...new Set(
      inactiveIds.filter(
        (id): id is string => typeof id === "string" && members.has(id),
      ),
    ),
  ];
}

/**
 * Characters that participate in prompts and generation.
 * Marinara fallback: if every member is disabled, all are treated as active.
 */
export function activeCharacterIds(
  settings: Pick<ChatSettings, "character_ids" | "inactive_character_ids">,
): string[] {
  const all = settings.character_ids.filter(Boolean);
  const inactive = new Set(
    normalizeInactiveCharacterIds(all, settings.inactive_character_ids),
  );
  const active = all.filter((id) => !inactive.has(id));
  return active.length > 0 ? active : all;
}

/** Whether a member is visually disabled (may differ from runtime when all are off). */
export function isCharacterInactiveInChat(
  settings: Pick<ChatSettings, "character_ids" | "inactive_character_ids">,
  characterId: string,
): boolean {
  const all = settings.character_ids.filter(Boolean);
  return normalizeInactiveCharacterIds(all, settings.inactive_character_ids).includes(
    characterId,
  );
}
