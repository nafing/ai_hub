import type { ChatMode } from "../chats/types";
import type { TwatterCarryoverTarget, TwatterDigestEntry } from "./types";
import { TWATTER_CARRYOVER_TOKEN_BUDGET } from "./types";

const TWATTER_DIGEST_CONTENT_LIMIT = 1200;
const TWATTER_CARRYOVER_CHARACTER_BUDGET = TWATTER_CARRYOVER_TOKEN_BUDGET * 4;

export function modeAllowsTwatterCarryover(
  carryoverModes: readonly TwatterCarryoverTarget[],
  chatMode: ChatMode,
): boolean {
  if (carryoverModes.includes("conversation") && chatMode === "conversation") {
    return true;
  }
  if (carryoverModes.includes("roleplay") && chatMode === "roleplay") {
    return true;
  }
  return false;
}

/** Format recent digests for chat prompt injection (Noodle-style carryover). */
export function buildTwatterCarryoverBlock(
  newestFirstDigests: readonly Pick<TwatterDigestEntry, "content">[],
  maxItems: number,
): string | null {
  const selected: string[] = [];
  const itemLimit = Math.max(0, Math.floor(maxItems));
  let bodyLength = 0;

  for (const digest of newestFirstDigests.slice(0, itemLimit)) {
    const content = digest.content.trim().slice(0, TWATTER_DIGEST_CONTENT_LIMIT);
    if (!content) continue;
    const line = `- ${content}`;
    const candidateBodyLength =
      bodyLength + (selected.length > 0 ? 1 : 0) + line.length;
    if (candidateBodyLength > TWATTER_CARRYOVER_CHARACTER_BUDGET) break;
    selected.push(content);
    bodyLength = candidateBodyLength;
  }

  if (selected.length === 0) return null;

  const lines = selected
    .slice()
    .reverse()
    .map((content) => `- ${content}`);

  return [
    "Recent Social Media Activity",
    ...lines,
  ].join("\n");
}

/** @deprecated Use digests via buildTwatterCarryoverBlock instead. */
export function formatTwatterFeedMarker(): string {
  return "";
}
