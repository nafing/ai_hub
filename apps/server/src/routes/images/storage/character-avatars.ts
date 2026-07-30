import { writeFile, mkdir, unlink, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { assertPngBuffer } from "../../../utils/images/png";
import { ignoreEnoent } from "../../../utils/fs";
import { uploadsPath } from "../paths";

function getAvatarsDir(): string {
  return (
    process.env.SERVER_AVATARS_DIR ?? uploadsPath("characters")
  );
}

export function characterAvatarFilePath(characterId: string): string {
  return path.join(getAvatarsDir(), `${characterId}.png`);
}

async function ensureAvatarsDir(): Promise<void> {
  await mkdir(getAvatarsDir(), { recursive: true });
}

export async function characterAvatarExists(characterId: string): Promise<boolean> {
  try {
    await access(characterAvatarFilePath(characterId), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeCharacterAvatarPng(
  characterId: string,
  buffer: Buffer,
): Promise<void> {
  assertPngBuffer(buffer);
  await ensureAvatarsDir();
  await writeFile(characterAvatarFilePath(characterId), buffer);
}

export async function deleteCharacterAvatarFile(characterId: string): Promise<void> {
  await ignoreEnoent(() => unlink(characterAvatarFilePath(characterId)));
}

export async function copyCharacterAvatarFile(
  fromId: string,
  toId: string,
): Promise<boolean> {
  if (!(await characterAvatarExists(fromId))) return false;
  await ensureAvatarsDir();
  await copyFile(characterAvatarFilePath(fromId), characterAvatarFilePath(toId));
  return true;
}
