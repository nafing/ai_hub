import { useRef, useState } from "react";
import {
  IconDownload,
  IconRefresh,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Chat, ChatMemoryChunk } from "@ai-hub/shared";
import { Button, Modal, Switch, Textarea, notifications } from "@/components/ui";
import {
  clearChatMemories,
  deleteChatMemoryChunk,
  importChatMemories,
  rebuildChatMemories,
  updateChatMemoryChunk,
} from "@/features/api-queries/chats/api";
import type { PatchChatSettings } from "./chatSettingsUi";
import { SettingsSection } from "./chatSettingsUi";
import { chatKeys } from "@/features/api-queries/chats/queries";
import classes from "./MemoryRecallSettings.module.css";

type MemoryRecallSettingsProps = {
  chat: Chat;
  patchSettings: PatchChatSettings;
};

export function MemoryRecallSettings({
  chat,
  patchSettings,
}: MemoryRecallSettingsProps) {
  const [opened, setOpened] = useState(false);
  const chunks = chat.memory_chunks ?? [];

  return (
    <SettingsSection value="memory" label="Memory Recall">
      <Switch
        variant="card"
        checked={chat.settings.enable_memory_recall !== false}
        onChange={(enable_memory_recall) =>
          patchSettings({ enable_memory_recall })
        }
        label="Enable Memory Recall"
        description="After generation, older messages are stored in chunks of 5. Relevant chunks are injected into later prompts."
      />
      <button
        type="button"
        className={classes.manageButton}
        onClick={() => setOpened(true)}
      >
        <span className={classes.manageTitle}>Memories for this chat</span>
        <span className={classes.manageMeta}>
          {chunks.length} chunk{chunks.length === 1 ? "" : "s"}
        </span>
      </button>
      <ChatMemoriesModal
        chat={chat}
        opened={opened}
        onClose={() => setOpened(false)}
      />
    </SettingsSection>
  );
}

function ChatMemoriesModal({
  chat,
  opened,
  onClose,
}: {
  chat: Chat;
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chunks = chat.memory_chunks ?? [];
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function setChat(updated: Chat) {
    queryClient.setQueryData(chatKeys.detail(updated.id), updated);
  }

  const rebuildMutation = useMutation({
    mutationFn: () => rebuildChatMemories(chat.id),
    onSuccess: (updated) => {
      setChat(updated);
      notifications.show({
        title: "Memories rebuilt",
        message: `${updated.memory_chunks.length} chunk(s) from chat history.`,
        color: "green",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Rebuild failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearChatMemories(chat.id),
    onSuccess: (updated) => {
      setChat(updated);
      setDrafts({});
      notifications.show({
        title: "Memories cleared",
        message: "All memory chunks removed for this chat.",
        color: "green",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ chunkId, content }: { chunkId: string; content: string }) =>
      updateChatMemoryChunk(chat.id, chunkId, content),
    onSuccess: (updated, variables) => {
      setChat(updated);
      setDrafts((current) => {
        const next = { ...current };
        delete next[variables.chunkId];
        return next;
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (chunkId: string) => deleteChatMemoryChunk(chat.id, chunkId),
    onSuccess: (updated) => setChat(updated),
  });

  const importMutation = useMutation({
    mutationFn: (incoming: ChatMemoryChunk[]) =>
      importChatMemories(chat.id, incoming, false),
    onSuccess: (updated) => {
      setChat(updated);
      notifications.show({
        title: "Import complete",
        message: `Chat now has ${updated.memory_chunks.length} memory chunk(s).`,
        color: "green",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Import failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    },
  });

  function exportChunks() {
    const payload = {
      format: "ai-hub-memory-recall",
      version: 1,
      chat_id: chat.id,
      exported_at: new Date().toISOString(),
      chunks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${chat.title || "chat"}-memories.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        chunks?: ChatMemoryChunk[];
      };
      const incoming = Array.isArray(parsed.chunks)
        ? parsed.chunks
        : Array.isArray(parsed)
          ? parsed
          : null;
      if (!incoming) {
        throw new Error("JSON must include a chunks array");
      }
      importMutation.mutate(incoming as ChatMemoryChunk[]);
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message: error instanceof Error ? error.message : "Invalid JSON",
        color: "red",
      });
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Memories · ${chunks.length}`}
      size="lg"
    >
      <div className={classes.modalStack}>
        <p className={classes.modalHint}>
          Chunks are created automatically after generation in groups of 5
          messages (excluding the recent context window). Rebuild recreates them
          from the current history.
        </p>

        <div className={classes.toolbar}>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={rebuildMutation.isPending}
            onClick={() => rebuildMutation.mutate()}
          >
            <IconRefresh size={14} />
            {rebuildMutation.isPending ? "Rebuilding…" : "Rebuild"}
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={exportChunks}
            disabled={chunks.length === 0}
          >
            <IconDownload size={14} />
            Export
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          >
            <IconUpload size={14} />
            Import
          </Button>
          <Button
            type="button"
            variant="ghostDanger"
            size="sm"
            disabled={chunks.length === 0 || clearMutation.isPending}
            onClick={() => clearMutation.mutate()}
          >
            <IconTrash size={14} />
            Clear
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void handleImportFile(file);
            }}
          />
        </div>

        {chunks.length === 0 ? (
          <p className={classes.empty}>
            No memory chunks yet. Keep chatting, or rebuild from history once
            there are at least 5 older messages outside the active context
            window.
          </p>
        ) : (
          <div className={classes.list}>
            {chunks.map((chunk) => {
              const draft = drafts[chunk.id] ?? chunk.content;
              const dirty = draft !== chunk.content;
              return (
                <article key={chunk.id} className={classes.card}>
                  <header className={classes.cardHeader}>
                    <span>
                      {chunk.message_count} message
                      {chunk.message_count === 1 ? "" : "s"}
                      {chunk.source_chat_id ? " · imported" : ""}
                    </span>
                    <span className={classes.cardMeta}>
                      {chunk.first_message_at.slice(0, 10)} →{" "}
                      {chunk.last_message_at.slice(0, 10)}
                    </span>
                  </header>
                  <Textarea
                    value={draft}
                    rows={5}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [chunk.id]: event.currentTarget.value,
                      }))
                    }
                  />
                  <div className={classes.cardActions}>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={!dirty || saveMutation.isPending}
                      onClick={() =>
                        saveMutation.mutate({
                          chunkId: chunk.id,
                          content: draft,
                        })
                      }
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghostDanger"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(chunk.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
