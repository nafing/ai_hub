import { useState } from "react";
import { motion } from "motion/react";
import { IconMessages, IconPlus, IconTrash } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CHAT_MODE_LABELS, type ChatListItem } from "@ai-hub/shared";
import { ActionIcon, Button, Modal, notifications, RuntimeText } from "@/components/ui";
import { CreateChatModal } from "@/features/chats/CreateChatModal";
import { useChats, useDeleteChat } from "@/features/chats/queries";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/chats/")({
  component: RouteComponent,
});

type DeleteTarget = {
  id: string;
  title: string;
};

function RouteComponent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const { data, isLoading, isError } = useChats();
  const deleteMutation = useDeleteChat();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        notifications.show({
          title: "Deleted",
          message: "Chat removed.",
          color: "green",
        });
      },
      onError: (error) => {
        notifications.show({
          title: "Delete failed",
          message: error instanceof Error ? error.message : "Unknown error",
          color: "red",
        });
      },
    });
  }

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerRow}>
          <h2 className={classes.title}>Chats</h2>
          <ActionIcon type="button" variant="default" aria-label="New chat" onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </div>
        <p className={classes.subtitle}>
          Roleplay and conversation sessions.
        </p>
      </header>

      {isLoading ? (
        <div className={classes.loading}>
          <div className={classes.spinner} aria-label="Loading" />
        </div>
      ) : null}

      {isError ? (
        <p className={classes.statusError}>Failed to load chats.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className={classes.status}>No chats yet. Create one with +.</p>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) > 0 ? (
        <div className={classes.grid}>
          {(data ?? []).map((chat) => (
            <ChatCard
              key={chat.id}
              chat={chat}
              onDelete={(item) =>
                setDeleteTarget({ id: item.id, title: item.title })
              }
              deletePending={deleteMutation.isPending}
            />
          ))}
        </div>
      ) : null}

      <CreateChatModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete chat"
        size="sm"
      >
        <p className={classes.modalBody}>
          Delete <strong>{deleteTarget?.title || "this chat"}</strong>? This
          cannot be undone.
        </p>
        <div className={classes.modalActions}>
          <Button variant="default" type="button"
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>
          <Button variant="dangerSolid" type="button"
            onClick={handleConfirmDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ChatCard({
  chat,
  onDelete,
  deletePending,
}: {
  chat: ChatListItem;
  onDelete: (chat: ChatListItem) => void;
  deletePending: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
    >
      <Link
        to="/chats/$chatId"
        params={{ chatId: chat.id }}
        className={classes.card}
      >
        <div className={classes.cardTop}>
          <div className={classes.cardIdentity}>
            <IconMessages size={20} className={classes.cardIcon} />
            <div className={classes.cardText}>
              <p className={classes.cardName}>{chat.title || "Untitled"}</p>
              <div className={classes.cardMeta}>
                <span className={classes.badge}>
                  {CHAT_MODE_LABELS[chat.mode]}
                </span>
                <p className={classes.cardCount}>
                  {chat.message_count} messages
                </p>
              </div>
            </div>
          </div>
          <div className={classes.cardActions}>
            <ActionIcon type="button" variant="ghostDanger" aria-label="Delete chat" disabled={deletePending} onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDelete(chat);
              }}
            >
              <IconTrash size={15} />
            </ActionIcon>
          </div>
        </div>
        <p className={classes.cardPreview}>
          {chat.preview ? (
            <RuntimeText text={chat.preview} />
          ) : (
            "Empty chat"
          )}
        </p>
      </Link>
    </motion.div>
  );
}
