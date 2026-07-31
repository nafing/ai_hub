import {
  defaultCharacter,
  lorebookFromCharacterBook,
  parseCharacterImportFile,
  type CharacterCardV2,
  type CreateLorebookInput,
  type GeneratorPresetPromptFields,
  type Preset,
} from "@ai-hub/shared";
import { downloadBotbooruPng } from "@/features/api-queries/characters/botbooru/api";
import { withBotbooruPostId } from "./imported";
import { botbooruDisplayName } from "./types";
import type { CharacterImportPreview } from "@/features/shared/characters/characterImportSessionStore";
import {
  createCharacter,
  uploadCharacterAvatar,
} from "@/features/api-queries/characters/api";

export type BotbooruImportAiOptions = {
  connectionId: string;
  preset: Preset;
  generatorPresetId: string;
  generatorPrompts?: GeneratorPresetPromptFields;
  personaId: string | null;
  referenceCharacterIds: string[];
  generatorBrief: string;
  startAiImport: (input: {
    preview: CharacterImportPreview;
    connectionId: string;
    preset: Preset;
    generatorPresetId: string;
    generatorPrompts?: GeneratorPresetPromptFields;
    personaId: string | null;
    referenceCharacterIds: string[];
    generatorBrief: string;
  }) => string;
};

export type BotbooruImportResult =
  | { mode: "ai" }
  | {
      mode: "direct";
      characterId: string;
      characterName: string;
      pendingBook: {
        lorebook: CreateLorebookInput;
        characterId: string;
      } | null;
    };

function hasCharacterBook(
  book: CharacterCardV2["data"]["character_book"],
): book is NonNullable<CharacterCardV2["data"]["character_book"]> {
  return Boolean(book && typeof book === "object" && !Array.isArray(book));
}

export async function importBotbooruPost(
  post: { id: number; character_name: string; meta_name: string },
  options?: { ai?: BotbooruImportAiOptions | null },
): Promise<BotbooruImportResult> {
  const file = await downloadBotbooruPng(post.id);
  const bytes = await file.arrayBuffer();
  const { card } = await parseCharacterImportFile(file, bytes);
  const stampedCard: CharacterCardV2 = {
    ...card,
    data: withBotbooruPostId(card.data, post.id),
  };

  if (options?.ai) {
    options.ai.startAiImport({
      preview: {
        card: stampedCard,
        avatarFile: file,
        previewUrl: null,
        fileName: file.name,
        source: "png",
      },
      connectionId: options.ai.connectionId,
      preset: options.ai.preset,
      generatorPresetId: options.ai.generatorPresetId,
      generatorPrompts: options.ai.generatorPrompts,
      personaId: options.ai.personaId,
      referenceCharacterIds: options.ai.referenceCharacterIds,
      generatorBrief: options.ai.generatorBrief,
    });
    return { mode: "ai" };
  }

  const { character_book: embeddedBook, ...dataWithoutBook } = stampedCard.data;
  let created = await createCharacter(
    defaultCharacter({ data: dataWithoutBook }),
  );
  created = await uploadCharacterAvatar(created.id, file, file.name);

  let pendingBook: {
    lorebook: CreateLorebookInput;
    characterId: string;
  } | null = null;
  if (hasCharacterBook(embeddedBook)) {
    pendingBook = {
      lorebook: lorebookFromCharacterBook(embeddedBook, {
        category: "character",
        linked_characters: [created.id],
        name:
          (typeof embeddedBook.name === "string" && embeddedBook.name.trim()
            ? embeddedBook.name
            : "") || `${created.data.name || "Character"} lorebook`,
      }),
      characterId: created.id,
    };
  }

  return {
    mode: "direct",
    characterId: created.id,
    characterName: created.data.name || botbooruDisplayName(post),
    pendingBook,
  };
}
