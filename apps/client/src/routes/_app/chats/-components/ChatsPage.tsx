import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
  CHAT_MODES,
  CHAT_MODE_LABELS,
  type ChatListItem,
  type ChatMode,
} from "@ai-hub/shared";
import {
  ActionIcon,
  Button,
  Modal,
  MultiSelect,
  notifications,
  RuntimeText,
  TextInput,
} from "@/components/ui";
import { useChats, useDeleteChat } from "@/features/shared/chats/shared";
import { CreateChatModal } from "@/features/modals/chats/CreateChatModal";
import classes from "./ChatsPage.module.css";

type DeleteTarget = {
  id: string;
  title: string;
};

export function ChatsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<ChatMode[]>([]);

  const { data, isLoading, isError } = useChats();
  const deleteMutation = useDeleteChat();

  const modeOptions = useMemo(
    () =>
      CHAT_MODES.map((mode) => ({
        value: mode,
        label: CHAT_MODE_LABELS[mode],
      })),
    [],
  );

  const hasActiveFilters = query.trim().length > 0 || modeFilter.length > 0;

  const filteredChats = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data ?? []).filter((chat) => {
      if (modeFilter.length > 0 && !modeFilter.includes(chat.mode)) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        chat.title.toLowerCase().includes(normalizedQuery) ||
        (chat.preview?.toLowerCase().includes(normalizedQuery) ?? false)
      );
    });
  }, [data, modeFilter, query]);

  const grouped = useMemo(() => {
    const byMode = new Map<ChatMode, ChatListItem[]>();
    for (const mode of CHAT_MODES) {
      byMode.set(mode, []);
    }
    for (const chat of filteredChats) {
      const list = byMode.get(chat.mode) ?? [];
      list.push(chat);
      byMode.set(chat.mode, list);
    }
    return CHAT_MODES.map((mode) => ({
      mode,
      chats: byMode.get(mode) ?? [],
    })).filter((group) => group.chats.length > 0);
  }, [filteredChats]);

  function clearFilters() {
    setQuery("");
    setModeFilter([]);
  }

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
          <ActionIcon
            type="button"
            variant="default"
            aria-label="New chat"
            onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </div>
        <p className={classes.subtitle}>
          Roleplay and conversation sessions.
          {!isLoading && !isError && hasActiveFilters
            ? ` Showing ${filteredChats.length} of ${data?.length ?? 0}.`
            : null}
        </p>
      </header>

      {!isLoading && !isError && (data?.length ?? 0) > 0 ? (
        <div className={classes.filters}>
          <TextInput
            className={classes.searchInput}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search title, preview…"
            aria-label="Search chats"
          />
          <MultiSelect
            className={classes.modeFilter}
            searchable
            clearable
            data={modeOptions}
            value={modeFilter}
            onChange={(value) => setModeFilter(value as ChatMode[])}
            placeholder="All modes"
            searchPlaceholder="Filter modes…"
          />
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="default"
              className={classes.clearFilters}
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

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

      {!isLoading &&
      !isError &&
      (data?.length ?? 0) > 0 &&
      grouped.length === 0 ? (
        <p className={classes.status}>
          No chats match your filters.{" "}
          {hasActiveFilters ? (
            <button
              type="button"
              className={classes.clearFiltersLink}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </p>
      ) : null}

      {grouped.map(({ mode, chats }) => (
        <section key={mode} className={classes.group}>
          <h3 className={classes.groupTitle}>{CHAT_MODE_LABELS[mode]}</h3>
          <div className={classes.grid}>
            {chats.map((chat) => (
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
        </section>
      ))}

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
          <Button
            variant="default"
            type="button"
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>
          <Button
            variant="dangerSolid"
            type="button"
            onClick={handleConfirmDelete}
          >
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
      className={classes.cardWrap}
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
          <p className={classes.cardName}>{chat.title || "Untitled"}</p>
          <div className={classes.cardActions}>
            <ActionIcon
              type="button"
              variant="ghostDanger"
              aria-label="Delete chat"
              disabled={deletePending}
              onClick={(event) => {
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
        <p className={classes.cardMeta}>
          {chat.message_count}{" "}
          {chat.message_count === 1 ? "message" : "messages"}
        </p>
      </Link>
    </motion.div>
  );
}
