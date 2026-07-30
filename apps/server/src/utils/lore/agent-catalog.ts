import type { Lorebook, LorebookEntry } from "@ai-hub/shared";

export function loreEntryId(
  lorebookId: string,
  entry: LorebookEntry,
  index: number,
): string {
  if (entry.id != null) return `${lorebookId}:${entry.id}`;
  if (entry.name?.trim()) return `${lorebookId}:${entry.name.trim()}`;
  return `${lorebookId}:idx:${index}`;
}

export function resolveLoreEntriesByIds(
  lorebooks: Lorebook[],
  entryIds: string[],
): string {
  if (!entryIds.length) return "";
  const chunks: string[] = [];
  const wanted = new Set(entryIds);

  for (const book of lorebooks) {
    book.entries.forEach((entry, index) => {
      const id = loreEntryId(book.id, entry, index);
      if (
        !wanted.has(id) &&
        !wanted.has(String(entry.id ?? "")) &&
        !wanted.has(entry.name ?? "")
      ) {
        return;
      }
      const name = entry.name?.trim() || entry.keys?.[0] || id;
      const content = (entry.content ?? "").trim();
      if (!content) return;
      chunks.push(`### ${name}\n${content}`);
    });
  }
  return chunks.join("\n\n");
}

export function buildLoreCatalog(lorebooks: Lorebook[]): string {
  const lines: string[] = [];
  for (const book of lorebooks) {
    book.entries.forEach((entry, index) => {
      if (entry.enabled === false) return;
      const id = loreEntryId(book.id, entry, index);
      const name = entry.name?.trim() || entry.keys?.[0] || id;
      const keys = (entry.keys ?? []).join(", ");
      const snippet = (entry.content ?? "").trim().slice(0, 180);
      lines.push(
        `- id: ${id} | name: ${name} | keys: ${keys || "—"} | snippet: ${snippet}`,
      );
    });
  }
  return lines.join("\n") || "(no entries)";
}

export function buildLoreSourceMaterial(lorebooks: Lorebook[]): string {
  const chunks: string[] = [];
  for (const book of lorebooks) {
    for (const entry of book.entries) {
      if (entry.enabled === false) continue;
      const name = entry.name?.trim() || entry.keys?.[0] || "Entry";
      const content = (entry.content ?? "").trim();
      if (!content) continue;
      chunks.push(`### ${name}\n${content}`);
    }
  }
  return chunks.join("\n\n").slice(0, 24_000) || "(no source material)";
}
