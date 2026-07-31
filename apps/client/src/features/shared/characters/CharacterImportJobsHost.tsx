import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { notifications } from "@/components/ui";
import { ImportLorebookModal } from "@/features/modals/lorebooks/ImportLorebookModal";
import {
  ImportAiReviewModal,
} from "@/features/modals/characters/ImportAiReviewModal";
import { useCharacterImportSessionStore } from "./characterImportSessionStore";

export function CharacterImportJobsHost() {
  const navigate = useNavigate();
  const sessions = useCharacterImportSessionStore((state) => state.sessions);
  const closeReview = useCharacterImportSessionStore((state) => state.closeReview);
  const updateCards = useCharacterImportSessionStore((state) => state.updateCards);
  const dismiss = useCharacterImportSessionStore((state) => state.dismiss);
  const persistCards = useCharacterImportSessionStore((state) => state.persistCards);
  const clearPendingBook = useCharacterImportSessionStore(
    (state) => state.clearPendingBook,
  );

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const reviewSession = sessions.find(
    (session) => session.reviewOpen && session.context && session.status === "ready",
  );
  const pendingBookSession = sessions.find((session) => session.pendingBook);

  async function handleConfirm(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session || session.cards.length === 0) return;

    setConfirmingId(sessionId);
    try {
      const { primaryCharacterId, pendingBook } = await persistCards(
        sessionId,
        session.cards,
      );
      if (pendingBook) return;
      if (primaryCharacterId) {
        await navigate({
          to: "/characters/$characterId",
          params: { characterId: primaryCharacterId },
        });
      }
      dismiss(sessionId);
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <>
      {reviewSession?.context ? (
        <ImportAiReviewModal
          opened
          cards={reviewSession.cards}
          onCardsChange={(cards) => updateCards(reviewSession.id, cards)}
          context={reviewSession.context}
          confirming={confirmingId === reviewSession.id}
          onConfirm={() => void handleConfirm(reviewSession.id)}
          onCancel={() => closeReview(reviewSession.id)}
          title={`Review AI import · ${reviewSession.fileName}`}
        />
      ) : null}

      <ImportLorebookModal
        opened={pendingBookSession?.pendingBook != null}
        title="Import character lorebook"
        sourceLabel="character card character_book"
        initialLorebook={pendingBookSession?.pendingBook?.lorebook ?? null}
        onClose={() => {
          const session = pendingBookSession;
          if (!session?.pendingBook) return;
          const characterId = session.pendingBook.characterId;
          clearPendingBook(session.id);
          dismiss(session.id);
          if (characterId) {
            void navigate({
              to: "/characters/$characterId",
              params: { characterId },
            });
          }
        }}
        onImported={() => false}
      />
    </>
  );
}
