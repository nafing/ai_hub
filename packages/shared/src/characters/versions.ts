import { normalizeCharacterCardData } from "./defaults";
import type { CharacterCardData, CharacterVersion } from "./types";

export const DEFAULT_CHARACTER_VERSION_LABEL = "1.0";

/** Create a version snapshot from card data. */
export function createCharacterVersion(input: {
  id?: string;
  label?: string;
  data: CharacterCardData;
  created_at?: string;
  updated_at?: string;
}): CharacterVersion {
  const now = new Date().toISOString();
  const label =
    (input.label ?? input.data.character_version)?.trim() ||
    DEFAULT_CHARACTER_VERSION_LABEL;
  const data = normalizeCharacterCardData({
    ...input.data,
    character_version: label,
  });
  return {
    id: input.id ?? createVersionId(),
    label,
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
    data,
  };
}

/** Ensure versions exist; seed from legacy single-data characters. */
export function normalizeCharacterVersions(input: {
  data: CharacterCardData;
  versions?: CharacterVersion[] | null;
  active_version_id?: string | null;
}): {
  versions: CharacterVersion[];
  active_version_id: string;
  data: CharacterCardData;
} {
  const rawVersions = Array.isArray(input.versions) ? input.versions : [];
  let versions = rawVersions
    .map((version) => {
      if (!version || typeof version !== "object") return null;
      const id = typeof version.id === "string" ? version.id : "";
      if (!id) return null;
      const data = normalizeCharacterCardData(version.data ?? input.data);
      const label =
        (typeof version.label === "string" && version.label.trim()) ||
        data.character_version.trim() ||
        DEFAULT_CHARACTER_VERSION_LABEL;
      return {
        id,
        label,
        created_at:
          typeof version.created_at === "string"
            ? version.created_at
            : new Date().toISOString(),
        updated_at:
          typeof version.updated_at === "string"
            ? version.updated_at
            : new Date().toISOString(),
        data: normalizeCharacterCardData({
          ...data,
          character_version: label,
        }),
      } satisfies CharacterVersion;
    })
    .filter((version): version is CharacterVersion => Boolean(version));

  if (versions.length === 0) {
    versions = [
      createCharacterVersion({
        data: input.data,
        label: input.data.character_version,
      }),
    ];
  }

  const activeId =
    (input.active_version_id &&
      versions.some((version) => version.id === input.active_version_id) &&
      input.active_version_id) ||
    versions[versions.length - 1].id;

  const active =
    versions.find((version) => version.id === activeId) ?? versions[0];

  return {
    versions,
    active_version_id: active.id,
    data: active.data,
  };
}

/**
 * Suggest the next version label from existing ones.
 * Prefers `major.minor` bumps (1.0 → 1.1); falls back to `vN`.
 */
export function nextCharacterVersionLabel(labels: string[]): string {
  const cleaned = labels.map((label) => label.trim()).filter(Boolean);
  if (cleaned.length === 0) return DEFAULT_CHARACTER_VERSION_LABEL;

  let bestMajor = 0;
  let bestMinor = -1;
  for (const label of cleaned) {
    const match = /^v?(\d+)(?:\.(\d+))?$/i.exec(label);
    if (!match) continue;
    const major = Number(match[1]);
    const minor = match[2] !== undefined ? Number(match[2]) : 0;
    if (
      major > bestMajor ||
      (major === bestMajor && minor > bestMinor)
    ) {
      bestMajor = major;
      bestMinor = minor;
    }
  }

  if (bestMinor >= 0) {
    return `${bestMajor}.${bestMinor + 1}`;
  }

  return `v${cleaned.length + 1}`;
}

function createVersionId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `ver_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
