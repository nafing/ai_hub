import { writeFile, mkdir, unlink, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { assertPngBuffer } from "../../../utils/images/png";
import { ignoreEnoent } from "../../../utils/fs";
import { uploadsPath } from "../paths";

function getAvatarsDir(): string {
  return (
    process.env.SERVER_PERSONA_AVATARS_DIR ?? uploadsPath("personas")
  );
}

export function personaAvatarFilePath(personaId: string): string {
  return path.join(getAvatarsDir(), `${personaId}.png`);
}

async function ensureAvatarsDir(): Promise<void> {
  await mkdir(getAvatarsDir(), { recursive: true });
}

export async function personaAvatarExists(personaId: string): Promise<boolean> {
  try {
    await access(personaAvatarFilePath(personaId), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writePersonaAvatarPng(
  personaId: string,
  buffer: Buffer,
): Promise<void> {
  assertPngBuffer(buffer);
  await ensureAvatarsDir();
  await writeFile(personaAvatarFilePath(personaId), buffer);
}

export async function deletePersonaAvatarFile(personaId: string): Promise<void> {
  await ignoreEnoent(() => unlink(personaAvatarFilePath(personaId)));
}

export async function copyPersonaAvatarFile(
  fromId: string,
  toId: string,
): Promise<boolean> {
  if (!(await personaAvatarExists(fromId))) return false;
  await ensureAvatarsDir();
  await copyFile(personaAvatarFilePath(fromId), personaAvatarFilePath(toId));
  return true;
}
