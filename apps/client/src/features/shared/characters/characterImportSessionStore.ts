import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  buildPresetPromptContext,
  defaultCharacter,
  lorebookFromCharacterBook,
  resolveGeneratorPresetPrompt,
  type CharacterCardData,
  type CharacterCardV2,
  type CreateLorebookInput,
  type GeneratorPresetPromptFields,
  type Preset,
} from "@ai-hub/shared";
import { notifications } from "@/components/ui";
import { getPersona } from "@/features/api-queries/personas/api";
import { useGeneratorJobsStore } from "@/features/shared/generators/generatorJobsStore";
import { queryClient } from "@/lib/queryClient";
import { createCharacter, getCharacter, uploadCharacterAvatar } from "@/features/api-queries/characters/api";
import {
  extractFullCards,
  extractedToCardData,
  withImportedCardVariables,
} from "./characterGenerateShared";
import type { ImportAiReviewContext } from "@/features/modals/characters/ImportAiReviewModal";
import { characterKeys } from "@/features/api-queries/characters/queries";

export type CharacterImportPreview = {
  card: CharacterCardV2;
  avatarFile: File | null;
  previewUrl: string | null;
  /** Persisted avatar (data URL) so Activity survives reloads. */
  avatarDataUrl?: string | null;
  fileName: string;
  source: "json" | "png";
};

export type CharacterImportSessionStatus =
  | "generating"
  | "ready"
  | "failed"
  | "saved"
  | "dismissed";

export type CharacterImportSession = {
  id: string;
  jobId: string;
  status: CharacterImportSessionStatus;
  fileName: string;
  preview: CharacterImportPreview;
  cards: CharacterCardData[];
  context: ImportAiReviewContext | null;
  reviewOpen: boolean;
  error: string | null;
  createdAt: string;
  pendingBook: {
    lorebook: CreateLorebookInput;
    characterId: string;
  } | null;
};

type StartAiImportInput = {
  preview: CharacterImportPreview;
  connectionId: string;
  preset: Preset;
  generatorPresetId: string;
  generatorPrompts?: GeneratorPresetPromptFields;
  personaId: string | null;
  referenceCharacterIds: string[];
  generatorBrief: string;
};

const MAX_SESSIONS = 20;
const INTERRUPTED = "Interrupted (page reloaded)";

function hasCharacterBook(
  book: CharacterCardV2["data"]["character_book"],
): book is NonNullable<CharacterCardV2["data"]["character_book"]> {
  return Boolean(book && typeof book === "object" && !Array.isArray(book));
}

function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read avatar file"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read avatar file"));
    reader.readAsDataURL(file);
  });
}

async function fileFromDataUrl(
  dataUrl: string,
  fileName: string,
): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, {
    type: blob.type || "image/png",
  });
}

function trimSessions(
  sessions: CharacterImportSession[],
): CharacterImportSession[] {
  return sessions.slice(0, MAX_SESSIONS);
}

function finalizeInterruptedSessions(
  sessions: CharacterImportSession[],
): CharacterImportSession[] {
  return sessions.map((session) => {
    const avatarDataUrl = session.preview.avatarDataUrl ?? null;
    const preview: CharacterImportPreview = {
      ...session.preview,
      avatarFile: null,
      avatarDataUrl,
      previewUrl: avatarDataUrl,
    };
    if (session.status === "generating") {
      return {
        ...session,
        status: "failed",
        error: session.error || INTERRUPTED,
        reviewOpen: false,
        preview,
      };
    }
    return {
      ...session,
      reviewOpen: false,
      preview,
    };
  });
}

function toPersistedSession(
  session: CharacterImportSession,
): CharacterImportSession {
  return {
    ...session,
    reviewOpen: false,
    preview: {
      card: session.preview.card,
      fileName: session.preview.fileName,
      source: session.preview.source,
      avatarFile: null,
      previewUrl: null,
      avatarDataUrl: session.preview.avatarDataUrl ?? null,
    },
  };
}

async function runAiImport(
  input: StartAiImportInput & { sessionId: string; jobId: string },
): Promise<{
  cards: CharacterCardData[];
  context: ImportAiReviewContext;
}> {
  const {
    preview,
    connectionId,
    preset,
    generatorPresetId,
    generatorPrompts,
    personaId,
    referenceCharacterIds,
  } = input;
  const baseData = { ...preview.card.data };
  delete (baseData as { character_book?: unknown }).character_book;

  const userBrief = input.generatorBrief.trim();
  const [persona, libraryReferences] = await Promise.all([
    personaId ? getPersona(personaId) : Promise.resolve(null),
    Promise.all(referenceCharacterIds.map((id) => getCharacter(id))),
  ]);

  const promptContext = buildPresetPromptContext({
    generatorBrief: userBrief || null,
    generatorPrompt: resolveGeneratorPresetPrompt(
      generatorPrompts ?? {
        prompt: "",
        prompt_create: "",
        prompt_import: "",
        prompt_regenerate: "",
        prompt_rebuild: "",
      },
      "import",
    ),
    persona,
    referenceCharacterList: [{ data: baseData }, ...libraryReferences],
    variables: {
      ...withImportedCardVariables(preset.variables),
      generation_mode: "import",
      char: baseData.name.trim(),
      target_field: "all card fields",
      existing_description: "",
      existing_appearance: "",
      existing_personality: "",
      existing_relationships: "",
      existing_scenario: "",
      existing_first_mes: "",
      existing_mes_example: "",
      existing_alternate_greetings: "",
    },
  });

  const result = await useGeneratorJobsStore.getState().runTrackedGenerator({
    category: "character_generator",
    connectionId,
    presetId: preset.id,
    generatorPresetId,
    variables: promptContext.variables,
    markers: promptContext.markers,
    title: `Import ${preview.fileName} with AI`,
    jobId: input.jobId,
    sessionType: "character_import",
    sessionId: input.sessionId,
    notifyOnComplete: false,
  });

  const extracted = extractFullCards(result.content || result.reply || "");
  if (extracted.length === 0) {
    throw new Error("Model returned an empty character card.");
  }

  const cards = extracted.map((card, index) => {
    const data = extractedToCardData(card);
    return {
      ...baseData,
      ...data,
      creator: index === 0 ? baseData.creator : (data.creator ?? ""),
      character_version:
        index === 0
          ? baseData.character_version
          : (data.character_version ?? ""),
    };
  });

  return {
    cards,
    context: {
      connectionId,
      presetId: preset.id,
      generatorPresetId,
      generatorPrompts,
      presetVariables: preset.variables,
      personaId,
      referenceCharacterIds,
      sourceCard: baseData,
      generatorBrief: userBrief,
    },
  };
}

type CharacterImportSessionStore = {
  sessions: CharacterImportSession[];
  attentionCount: () => number;
  startAiImport: (input: StartAiImportInput) => string;
  openReview: (sessionId: string) => void;
  closeReview: (sessionId: string) => void;
  updateCards: (sessionId: string, cards: CharacterCardData[]) => void;
  dismiss: (sessionId: string) => void;
  clearPendingBook: (sessionId: string) => void;
  setPendingBook: (
    sessionId: string,
    pendingBook: CharacterImportSession["pendingBook"],
  ) => void;
  persistCards: (
    sessionId: string,
    cards: CharacterCardData[],
  ) => Promise<{
    primaryCharacterId: string | null;
    pendingBook: CharacterImportSession["pendingBook"];
  }>;
};

export const useCharacterImportSessionStore =
  create<CharacterImportSessionStore>()(
    persist(
      (set, get) => ({
        sessions: [],

        attentionCount: () =>
          get().sessions.filter(
            (session) =>
              session.status === "generating" ||
              (session.status === "ready" && !session.reviewOpen),
          ).length,

        startAiImport: (input) => {
          const sessionId = crypto.randomUUID();
          const jobId = crypto.randomUUID();
          const session: CharacterImportSession = {
            id: sessionId,
            jobId,
            status: "generating",
            fileName: input.preview.fileName,
            preview: {
              ...input.preview,
              avatarDataUrl: input.preview.avatarDataUrl ?? null,
            },
            cards: [],
            context: null,
            reviewOpen: false,
            error: null,
            createdAt: new Date().toISOString(),
            pendingBook: null,
          };

          set((state) => ({
            sessions: trimSessions([session, ...state.sessions]),
          }));

          if (input.preview.avatarFile && !input.preview.avatarDataUrl) {
            void readFileAsDataUrl(input.preview.avatarFile)
              .then((avatarDataUrl) => {
                set((state) => ({
                  sessions: state.sessions.map((item) =>
                    item.id === sessionId
                      ? {
                          ...item,
                          preview: {
                            ...item.preview,
                            avatarDataUrl,
                          },
                        }
                      : item,
                  ),
                }));
              })
              .catch(() => {
                /* keep File in memory for this session */
              });
          }

          void (async () => {
            try {
              const result = await runAiImport({
                sessionId,
                jobId,
                ...input,
              });
              set((state) => ({
                sessions: state.sessions.map((item) =>
                  item.id === sessionId
                    ? {
                        ...item,
                        status: "ready",
                        cards: result.cards,
                        context: result.context,
                        reviewOpen: true,
                      }
                    : item,
                ),
              }));
              notifications.show({
                title: "Import ready for review",
                message: `${input.preview.fileName} — open Activity to review.`,
                color: "green",
              });
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Unknown error";
              set((state) => ({
                sessions: state.sessions.map((item) =>
                  item.id === sessionId
                    ? { ...item, status: "failed", error: message }
                    : item,
                ),
              }));
              notifications.show({
                title: "Import failed",
                message,
                color: "red",
              });
            }
          })();

          notifications.show({
            title: "Import started",
            message: "Running in background. You can leave this page.",
            color: "blue",
          });

          return sessionId;
        },

        openReview: (sessionId) => {
          set((state) => ({
            sessions: state.sessions.map((item) =>
              item.id === sessionId ? { ...item, reviewOpen: true } : item,
            ),
          }));
        },

        closeReview: (sessionId) => {
          set((state) => ({
            sessions: state.sessions.map((item) =>
              item.id === sessionId ? { ...item, reviewOpen: false } : item,
            ),
          }));
        },

        updateCards: (sessionId, cards) => {
          set((state) => ({
            sessions: state.sessions.map((item) =>
              item.id === sessionId ? { ...item, cards } : item,
            ),
          }));
        },

        dismiss: (sessionId) => {
          const session = get().sessions.find((item) => item.id === sessionId);
          revokeBlobUrl(session?.preview.previewUrl);
          set((state) => ({
            sessions: state.sessions.filter((item) => item.id !== sessionId),
          }));
          useGeneratorJobsStore
            .getState()
            .dismissJob(session?.jobId ?? sessionId);
        },

        clearPendingBook: (sessionId) => {
          set((state) => ({
            sessions: state.sessions.map((item) =>
              item.id === sessionId ? { ...item, pendingBook: null } : item,
            ),
          }));
        },

        setPendingBook: (sessionId, pendingBook) => {
          set((state) => ({
            sessions: state.sessions.map((item) =>
              item.id === sessionId ? { ...item, pendingBook } : item,
            ),
          }));
        },

        persistCards: async (sessionId, cardsToCreate) => {
          const session = get().sessions.find((item) => item.id === sessionId);
          if (!session) {
            throw new Error("Import session not found.");
          }

          const preview = session.preview;
          const embeddedBook = preview.card.data.character_book;
          const createdList = [];

          const botbooruPostId = preview.card.data.botbooru_post_id ?? null;
          let avatarFile = preview.avatarFile;
          if (!avatarFile && preview.avatarDataUrl) {
            avatarFile = await fileFromDataUrl(
              preview.avatarDataUrl,
              preview.fileName,
            );
          }

          for (let index = 0; index < cardsToCreate.length; index += 1) {
            const cardData = cardsToCreate[index]!;
            let created = await createCharacter(
              defaultCharacter({
                data:
                  botbooruPostId != null
                    ? { ...cardData, botbooru_post_id: botbooruPostId }
                    : cardData,
              }),
            );
            if (index === 0 && avatarFile) {
              created = await uploadCharacterAvatar(
                created.id,
                avatarFile,
                preview.fileName,
              );
            }
            createdList.push(created);
          }

          const primary = createdList[0]!;
          void queryClient.invalidateQueries({ queryKey: characterKeys.list() });

          notifications.show({
            title:
              cardsToCreate.length > 1 ? "Imported characters" : "Imported",
            message:
              cardsToCreate.length > 1
                ? `Created ${cardsToCreate.length} characters with AI: ${createdList.map((c) => c.data.name || "untitled").join(", ")}.`
                : `${primary.data.name || "Character"} from ${preview.source.toUpperCase()} (AI).`,
            color: "green",
          });

          let pendingBook: CharacterImportSession["pendingBook"] = null;
          if (hasCharacterBook(embeddedBook)) {
            const lorebook = lorebookFromCharacterBook(embeddedBook, {
              category: "character",
              linked_characters: createdList.map((c) => c.id),
              name:
                (typeof embeddedBook.name === "string" &&
                embeddedBook.name.trim()
                  ? embeddedBook.name
                  : "") || `${primary.data.name || "Character"} lorebook`,
            });
            pendingBook = { lorebook, characterId: primary.id };
          }

          revokeBlobUrl(preview.previewUrl);

          set((state) => ({
            sessions: state.sessions.map((item) =>
              item.id === sessionId
                ? {
                    ...item,
                    status: "saved",
                    reviewOpen: false,
                    pendingBook,
                  }
                : item,
            ),
          }));

          useGeneratorJobsStore.getState().dismissJob(session.jobId);

          return { primaryCharacterId: primary.id, pendingBook };
        },
      }),
      {
        name: "ai-hub-character-imports",
        partialize: (state) => ({
          sessions: state.sessions.map(toPersistedSession),
        }),
        merge: (persisted, current) => {
          const stored = (persisted ?? {}) as Partial<CharacterImportSessionStore>;
          const sessions = Array.isArray(stored.sessions)
            ? finalizeInterruptedSessions(stored.sessions)
            : current.sessions;
          return {
            ...current,
            sessions: trimSessions(sessions),
          };
        },
      },
    ),
  );
