import type { Character, CharacterCardData } from "./types";

export const DEFAULT_TALKATIVENESS = 0.5;

export function clampTalkativeness(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TALKATIVENESS;
  return Math.min(1, Math.max(0, value));
}

/** Coerce talkativeness (0–1). Default 0.5. */
export function normalizeTalkativeness(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return clampTalkativeness(input);
  }
  if (typeof input === "string" && input.trim() && !Number.isNaN(Number(input))) {
    return clampTalkativeness(Number(input));
  }
  return DEFAULT_TALKATIVENESS;
}

/** Read talkativeness from card data (0–1). Default 0.5. */
export function characterTalkativeness(
  character:
    | Pick<Character, "data">
    | { data: Pick<CharacterCardData, "talkativeness"> },
): number {
  return normalizeTalkativeness(character.data.talkativeness);
}

/** Return card data with talkativeness set. */
export function setCharacterTalkativeness(
  data: CharacterCardData,
  value: number,
): CharacterCardData {
  return {
    ...data,
    talkativeness: clampTalkativeness(value),
  };
}
