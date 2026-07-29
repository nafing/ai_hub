import { create } from "zustand";
import {
  buildPresetPromptContext,
  defaultCharacter,
  lorebookFromCharacterBook,
  type CharacterCardData,
  type CharacterCardV2,
  type CreateLorebookInput,
  type Preset,
} from "@ai-hub/shared";
import { notifications } from "@/components/ui";
import { getPersona } from "@/features/personas/api";
import { useGeneratorJobsStore } from "@/features/generators/generatorJobsStore";
import { queryClient } from "@/lib/queryClient";
import { createCharacter, getCharacter, uploadCharacterAvatar } from "./api";
import {
  extractFullCards,
  extractedToCardData,
  resolvePresetVariables,
} from "./characterGenerateShared";
import type { ImportAiReviewContext } from "./ImportAiReviewModal";
import { characterKeys } from "./queries";

export type CharacterImportPreview = {
  card: CharacterCardV2;
  avatarFile: File | null;
  previewUrl: string | null;
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
  sessionId: string;
  jobId: string;
  preview: CharacterImportPreview;
  connectionId: string;
  preset: Preset;
  personaId: string | null;
  referenceCharacterIds: string[];
  generatorBrief: string;
};

function hasCharacterBook(
  book: CharacterCardV2["data"]["character_book"],
): book is NonNullable<CharacterCardV2["data"]["character_book"]> {
  return Boolean(book && typeof book === "object" && !Array.isArray(book));
}

async function runAiImport(input: StartAiImportInput): Promise<{
  cards: CharacterCardData[];
  context: ImportAiReviewContext;
}> {
  const { preview, connectionId, preset, personaId, referenceCharacterIds } =
    input;
  const baseData = { ...preview.card.data };
  delete (baseData as { character_book?: unknown }).character_book;

  const userBrief = input.generatorBrief.trim();
  const [persona, libraryReferences] = await Promise.all([
    personaId ? getPersona(personaId) : Promise.resolve(null),
    Promise.all(referenceCharacterIds.map((id) => getCharacter(id))),
  ]);

  const promptContext = buildPresetPromptContext({
    generatorBrief: userBrief || null,
    persona,
    referenceCharacterList: [{ data: baseData }, ...libraryReferences],
    variables: {
      ...resolvePresetVariables(preset.variables),
      generation_mode: "import",
      char: baseData.name.trim(),
      target_field: "all card fields",
      existing_description: "",
      existing_personality: "",
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
  ) => Promise<{ primaryCharacterId: string | null; pendingBook: CharacterImportSession["pendingBook"] }>;
};

export const useCharacterImportSessionStore = create<CharacterImportSessionStore>(
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
        preview: input.preview,
        cards: [],
        context: null,
        reviewOpen: false,
        error: null,
        createdAt: new Date().toISOString(),
        pendingBook: null,
      };

      set((state) => ({ sessions: [session, ...state.sessions] }));

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
      if (session?.preview.previewUrl) {
        URL.revokeObjectURL(session.preview.previewUrl);
      }
      set((state) => ({
        sessions: state.sessions.filter((item) => item.id !== sessionId),
      }));
      useGeneratorJobsStore.getState().dismissJob(session?.jobId ?? sessionId);
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

      for (let index = 0; index < cardsToCreate.length; index += 1) {
        let created = await createCharacter(
          defaultCharacter({ data: cardsToCreate[index]! }),
        );
        if (index === 0 && preview.avatarFile) {
          created = await uploadCharacterAvatar(
            created.id,
            preview.avatarFile,
            preview.fileName,
          );
        }
        createdList.push(created);
      }

      const primary = createdList[0]!;
      void queryClient.invalidateQueries({ queryKey: characterKeys.list() });

      notifications.show({
        title: cardsToCreate.length > 1 ? "Imported characters" : "Imported",
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
            (typeof embeddedBook.name === "string" && embeddedBook.name.trim()
              ? embeddedBook.name
              : "") || `${primary.data.name || "Character"} lorebook`,
        });
        pendingBook = { lorebook, characterId: primary.id };
      }

      if (preview.previewUrl) {
        URL.revokeObjectURL(preview.previewUrl);
      }

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
);
