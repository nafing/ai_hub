import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import {
  compileChatSummaryEntries,
  estimateChatSummaryTokens,
  roleplaySummaryEnabled,
  visibleChatMessages,
  type Chat,
  type ChatSummaryEntry,
} from "@ai-hub/shared";
import { Button, Modal, Select, Switch, Textarea, notifications } from "@/components/ui";
import { useConnectionSelectOptions } from "@/features/connections/queries";
import { usePresets } from "@/features/presets/queries";
import {
  useGenerateChatSummary,
  usePatchSummaryEntry,
  useUpdateChat,
  chatKeys,
} from "./queries";
import { useRollingSummaryBackfill } from "./useRollingSummaryBackfill";
import classes from "./SummaryPopover.module.css";

type SummarySourceMode = "last" | "range";

type SummaryPopoverProps = {
  chat: Chat;
  opened: boolean;
  onClose: () => void;
};

export function SummaryPopover({ chat, opened, onClose }: SummaryPopoverProps) {
  const connectionsQuery = useConnectionSelectOptions("llm");
  const { data: presets } = usePresets();
  const generateMutation = useGenerateChatSummary();
  const patchEntryMutation = usePatchSummaryEntry();
  const updateChat = useUpdateChat();
  const queryClient = useQueryClient();
  const { progress, startBackfill, stopBackfill } = useRollingSummaryBackfill();

  const summaryPresets = useMemo(
    () =>
      (presets ?? []).filter((preset) => preset.category === "chat_summary"),
    [presets],
  );

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [sourceMode, setSourceMode] = useState<SummarySourceMode>("last");
  const [rangeStart, setRangeStart] = useState("1");
  const [rangeEnd, setRangeEnd] = useState("1");

  const branchMessageCount = useMemo(
    () => visibleChatMessages(chat.messages).length,
    [chat.messages],
  );

  const compiledSummary = useMemo(
    () => compileChatSummaryEntries(chat.summary_entries) || chat.summary,
    [chat.summary, chat.summary_entries],
  );

  const tokenEstimate = estimateChatSummaryTokens(compiledSummary);
  const available = roleplaySummaryEnabled(chat.mode);
  const backfillRunning = progress.status === "running";

  function patchSettings(patch: Partial<Chat["settings"]>) {
    updateChat.mutate({
      id: chat.id,
      input: {
        settings: {
          ...chat.settings,
          ...patch,
        },
      },
    });
  }

  function handleGenerate() {
    const input =
      sourceMode === "range"
        ? {
            range_start_index: Number(rangeStart),
            range_end_index: Number(rangeEnd),
          }
        : { context_size: chat.settings.summary_context_size };

    generateMutation.mutate(
      { chatId: chat.id, ...input },
      {
        onSuccess: () => {
          notifications.show({
            title: "Summary updated",
            message: "Rolling chat summary generated.",
            color: "green",
          });
        },
        onError: (error) => {
          notifications.show({
            title: "Summary failed",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  }

  function handleBackfill() {
    void startBackfill(chat, {
      batchSize: chat.settings.summary_run_interval,
      onChatUpdated: (updated) => {
        queryClient.setQueryData(chatKeys.detail(updated.id), updated);
      },
    }).then((result) => {
      if (!result) return;
      notifications.show({
        title: "Backfill finished",
        message: result.message,
        color: result.message.includes("failed") ? "red" : "green",
      });
    });
  }

  function startEdit(entry: ChatSummaryEntry) {
    setEditingEntryId(entry.id);
    setDraftContent(entry.content);
  }

  function saveEdit(entry: ChatSummaryEntry) {
    patchEntryMutation.mutate(
      {
        chatId: chat.id,
        body: {
          operation: "replace",
          entry: { ...entry, content: draftContent.trim() },
        },
      },
      {
        onSuccess: () => {
          setEditingEntryId(null);
          setDraftContent("");
        },
      },
    );
  }

  if (!available) {
    return (
      <Modal opened={opened} onClose={onClose} title="Chat Summary" size="lg">
        <p className={classes.note}>
          Rolling chat summary is available for roleplay chats only.
        </p>
      </Modal>
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Chat Summary" size="lg">
      <div className={classes.shell}>
        <section className={classes.section}>
          <div className={classes.sectionHeader}>
            <h3 className={classes.heading}>Compiled summary</h3>
            <span className={classes.meta}>~{tokenEstimate} tokens</span>
          </div>
          <pre className={classes.compiled}>
            {compiledSummary || "No summary yet."}
          </pre>

          <div className={classes.sourceRow}>
            <Select
              data={[
                { value: "last", label: "Last N messages" },
                { value: "range", label: "Message range" },
              ]}
              value={sourceMode}
              onChange={(value) =>
                setSourceMode((value as SummarySourceMode) ?? "last")
              }
            />
            {sourceMode === "last" ? (
              <span className={classes.meta}>
                Uses context window ({chat.settings.summary_context_size} messages)
              </span>
            ) : (
              <div className={classes.rangeRow}>
                <label className={classes.field}>
                  From
                  <input
                    type="number"
                    min={1}
                    max={branchMessageCount}
                    value={rangeStart}
                    onChange={(event) => setRangeStart(event.target.value)}
                  />
                </label>
                <label className={classes.field}>
                  To
                  <input
                    type="number"
                    min={1}
                    max={branchMessageCount}
                    value={rangeEnd}
                    onChange={(event) => setRangeEnd(event.target.value)}
                  />
                </label>
                <span className={classes.meta}>
                  of {branchMessageCount} visible messages
                </span>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="primary"
            disabled={generateMutation.isPending || backfillRunning}
            onClick={handleGenerate}
          >
            <IconRefresh size={16} />
            {generateMutation.isPending ? "Generating…" : "Generate summary"}
          </Button>
        </section>

        <section className={classes.section}>
          <h3 className={classes.heading}>Automatic updates</h3>
          <Switch
            label="Enable automatic summary"
            checked={chat.settings.automatic_summary_enabled}
            onChange={(automatic_summary_enabled) =>
              patchSettings({ automatic_summary_enabled })
            }
          />
          <Switch
            label="Hide summarized messages from prompt"
            checked={chat.settings.hide_summarised_messages}
            onChange={(hide_summarised_messages) =>
              patchSettings({ hide_summarised_messages })
            }
          />
          {chat.settings.hide_summarised_messages ? (
            <label className={classes.field}>
              Keep last N messages visible
              <input
                type="number"
                min={0}
                value={chat.settings.summary_tail_messages}
                onChange={(event) =>
                  patchSettings({
                    summary_tail_messages: Number(event.target.value),
                  })
                }
              />
            </label>
          ) : null}
          <label className={classes.field}>
            User messages between runs
            <input
              type="number"
              min={1}
              max={200}
              value={chat.settings.summary_run_interval}
              onChange={(event) =>
                patchSettings({
                  summary_run_interval: Number(event.target.value),
                })
              }
            />
          </label>
          <label className={classes.field}>
            Context window (messages)
            <input
              type="number"
              min={5}
              max={500}
              value={chat.settings.summary_context_size}
              onChange={(event) =>
                patchSettings({
                  summary_context_size: Number(event.target.value),
                })
              }
            />
          </label>
          <label className={classes.field}>
            Max output tokens
            <input
              type="number"
              min={256}
              max={32768}
              value={chat.settings.summary_max_tokens}
              onChange={(event) =>
                patchSettings({
                  summary_max_tokens: Number(event.target.value),
                })
              }
            />
          </label>
          <Select
            data={connectionsQuery.options}
            value={chat.settings.summary_connection_id ?? ""}
            onChange={(value) =>
              patchSettings({ summary_connection_id: value || null })
            }
            placeholder="Summary connection (chat default)"
            clearable
          />
          <Select
            data={summaryPresets.map((preset) => ({
              value: preset.id,
              label: `${preset.name}${preset.is_default ? " (default)" : ""}`,
            }))}
            value={chat.settings.summary_preset_id ?? ""}
            onChange={(value) =>
              patchSettings({ summary_preset_id: value || null })
            }
            placeholder="Default chat_summary preset"
            clearable
          />
          <p className={classes.note}>
            Injected into the preset&apos;s <code>chat_summary</code> marker during
            generation. When hide is enabled, summarized messages drop out of prompt
            history except the protected tail.
          </p>
        </section>

        <section className={classes.section}>
          <h3 className={classes.heading}>Backfill history</h3>
          <p className={classes.note}>
            Summarize older unsummarized messages in batches (uses user-message
            interval as batch size).
          </p>
          {progress.status !== "idle" ? (
            <p className={classes.meta}>
              {progress.status === "running"
                ? `Batch ${progress.currentBatch}/${progress.totalBatches} (messages ${progress.rangeStart}-${progress.rangeEnd})`
                : progress.message}
            </p>
          ) : null}
          <div className={classes.entryActions}>
            <Button
              type="button"
              variant="primary"
              disabled={backfillRunning || generateMutation.isPending}
              onClick={handleBackfill}
            >
              {backfillRunning ? "Backfilling…" : "Start backfill"}
            </Button>
            {backfillRunning ? (
              <Button type="button" variant="default" onClick={stopBackfill}>
                Stop
              </Button>
            ) : null}
          </div>
        </section>

        <section className={classes.section}>
          <h3 className={classes.heading}>Summary entries</h3>
          {chat.summary_entries.length === 0 ? (
            <p className={classes.note}>No structured entries yet.</p>
          ) : (
            <div className={classes.entryList}>
              {chat.summary_entries.map((entry) => (
                <div key={entry.id} className={classes.entryCard}>
                  <div className={classes.entryHeader}>
                    <strong>{entry.title}</strong>
                    <span className={classes.entryMeta}>
                      {entry.origin} · ~{entry.token_estimate} tok
                      {entry.hidden_message_ids?.length
                        ? ` · ${entry.hidden_message_ids.length} hidden`
                        : ""}
                    </span>
                  </div>
                  {editingEntryId === entry.id ? (
                    <>
                      <Textarea
                        value={draftContent}
                        onChange={(event) => setDraftContent(event.target.value)}
                        rows={5}
                      />
                      <div className={classes.entryActions}>
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => saveEdit(entry)}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          onClick={() => setEditingEntryId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className={classes.entryContent}>{entry.content}</p>
                      <div className={classes.entryActions}>
                        <Switch
                          label="Enabled"
                          checked={entry.enabled}
                          onChange={(enabled) =>
                            patchEntryMutation.mutate({
                              chatId: chat.id,
                              body: {
                                operation: "toggle",
                                entry_id: entry.id,
                                enabled,
                              },
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="default"
                          onClick={() => startEdit(entry)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="dangerSolid"
                          onClick={() =>
                            patchEntryMutation.mutate({
                              chatId: chat.id,
                              body: {
                                operation: "delete",
                                entry_id: entry.id,
                              },
                            })
                          }
                        >
                          <IconTrash size={14} />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
