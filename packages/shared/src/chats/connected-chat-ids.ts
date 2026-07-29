/** Normalize linked chat ids; merges legacy single `connected_chat_id`. */
export function normalizeConnectedChatIds(
  ids: unknown,
  legacyId?: string | null,
): string[] {
  const out: string[] = [];
  if (Array.isArray(ids)) {
    for (const id of ids) {
      if (typeof id === "string" && id.trim()) out.push(id.trim());
    }
  }
  if (typeof legacyId === "string" && legacyId.trim()) {
    out.push(legacyId.trim());
  }
  return [...new Set(out)];
}

export function addConnectedChatId(ids: string[], targetId: string): string[] {
  const next = normalizeConnectedChatIds(ids);
  if (!next.includes(targetId)) next.push(targetId);
  return next;
}

export function removeConnectedChatId(ids: string[], targetId: string): string[] {
  return normalizeConnectedChatIds(ids).filter((id) => id !== targetId);
}
