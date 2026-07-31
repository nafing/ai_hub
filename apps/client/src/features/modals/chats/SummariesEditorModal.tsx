import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  IconCalendarClock,
  IconChevronRight,
  IconChevronsDown,
  IconChevronsUp,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import type { Chat, DaySummaryEntry, WeekSummaryEntry } from "@ai-hub/shared";
import {
  formatConversationDateKey,
  parseConversationDateKey,
  weekRangeLabel,
} from "@ai-hub/shared";
import { Button, Modal, notifications } from "@/components/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  backfillConversationSummaries,
  patchConversationSummaries,
} from "@/features/api-queries/chats/api";
import { chatKeys } from "@/features/api-queries/chats/queries";
import classes from "./SummariesEditorModal.module.css";

type SummariesEditorModalProps = {
  chat: Chat;
  opened: boolean;
  onClose: () => void;
};

type Drafts = {
  day_summaries: Record<string, DaySummaryEntry>;
  week_summaries: Record<string, WeekSummaryEntry>;
};

type EntryRef = {
  kind: "day" | "week";
  key: string;
  label: string;
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function fmtTokens(n: number): string {
  return n.toLocaleString();
}

function entryTokenText(entry: DaySummaryEntry | WeekSummaryEntry): string {
  return [entry.summary, ...entry.key_details].join("\n");
}

function cloneDrafts(chat: Chat): Drafts {
  return {
    day_summaries: structuredClone(chat.day_summaries ?? {}),
    week_summaries: structuredClone(chat.week_summaries ?? {}),
  };
}

function computeDelta(current: Drafts, snapshot: Drafts) {
  const day_summaries: Record<string, DaySummaryEntry> = {};
  const week_summaries: Record<string, WeekSummaryEntry> = {};
  for (const [key, value] of Object.entries(current.day_summaries)) {
    if (JSON.stringify(value) !== JSON.stringify(snapshot.day_summaries[key])) {
      day_summaries[key] = value;
    }
  }
  for (const [key, value] of Object.entries(current.week_summaries)) {
    if (
      JSON.stringify(value) !== JSON.stringify(snapshot.week_summaries[key])
    ) {
      week_summaries[key] = value;
    }
  }
  return {
    ...(Object.keys(day_summaries).length ? { day_summaries } : {}),
    ...(Object.keys(week_summaries).length ? { week_summaries } : {}),
  };
}

function AutoSizingTextarea({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      rows={1}
      className={[classes.autoTextarea, className].filter(Boolean).join(" ")}
    />
  );
}

export function SummariesEditorModal({
  chat,
  opened,
  onClose,
}: SummariesEditorModalProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState(() => cloneDrafts(chat));
  const snapshotRef = useRef(cloneDrafts(chat));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [backfillNotice, setBackfillNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    void (async () => {
      await queryClient.refetchQueries({ queryKey: chatKeys.detail(chat.id) });
      if (cancelled) return;
      const latest =
        queryClient.getQueryData<Chat>(chatKeys.detail(chat.id)) ?? chat;
      const fresh = cloneDrafts(latest);
      setDrafts(fresh);
      snapshotRef.current = fresh;
      setExpanded(new Set());
      setBackfillNotice(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [opened, chat, queryClient]);

  const entries = useMemo<EntryRef[]>(() => {
    const list: EntryRef[] = [];
    const weekKeys = Object.keys(drafts.week_summaries).sort(
      (a, b) =>
        parseConversationDateKey(a).getTime() -
        parseConversationDateKey(b).getTime(),
    );
    for (const weekKey of weekKeys) {
      list.push({
        kind: "week",
        key: weekKey,
        label: weekRangeLabel(weekKey),
      });
    }

    const dayToWeek = new Map<string, string>();
    for (const weekKey of weekKeys) {
      const monday = parseConversationDateKey(weekKey);
      for (let i = 0; i < 7; i++) {
        const day = new Date(
          monday.getFullYear(),
          monday.getMonth(),
          monday.getDate() + i,
        );
        dayToWeek.set(formatConversationDateKey(day), weekKey);
      }
    }

    const dayKeys = Object.keys(drafts.day_summaries)
      .filter((key) => !dayToWeek.has(key))
      .sort(
        (a, b) =>
          parseConversationDateKey(a).getTime() -
          parseConversationDateKey(b).getTime(),
      );
    for (const dayKey of dayKeys) {
      list.push({ kind: "day", key: dayKey, label: dayKey });
    }
    return list;
  }, [drafts]);

  const delta = useMemo(
    () => computeDelta(drafts, snapshotRef.current),
    [drafts],
  );
  const isDirty = Boolean(delta.day_summaries || delta.week_summaries);

  const totalTokens = useMemo(() => {
    let text = "";
    for (const entry of entries) {
      const current =
        entry.kind === "week"
          ? drafts.week_summaries[entry.key]
          : drafts.day_summaries[entry.key];
      if (current) text += entryTokenText(current);
    }
    return estimateTokens(text);
  }, [entries, drafts]);

  const allExpanded = entries.length > 0 && expanded.size === entries.length;

  function toggleEntry(id: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allExpanded) setExpanded(new Set());
    else setExpanded(new Set(entries.map((entry) => `${entry.kind}:${entry.key}`)));
  }

  function updateEntry(
    kind: "day" | "week",
    key: string,
    next: DaySummaryEntry,
  ) {
    setDrafts((current) =>
      kind === "week"
        ? {
            ...current,
            week_summaries: { ...current.week_summaries, [key]: next },
          }
        : {
            ...current,
            day_summaries: { ...current.day_summaries, [key]: next },
          },
    );
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      patchConversationSummaries(chat.id, computeDelta(drafts, snapshotRef.current)),
    onSuccess: (updated) => {
      queryClient.setQueryData(chatKeys.detail(updated.id), updated);
      notifications.show({
        title: "Summaries saved",
        message: "Day and week summaries updated.",
        color: "green",
      });
      onClose();
    },
  });

  const backfillMutation = useMutation({
    mutationFn: () =>
      backfillConversationSummaries(chat.id, { max_missing_days: 14 }),
    onSuccess: (result) => {
      queryClient.setQueryData(chatKeys.detail(result.chat.id), result.chat);
      const fresh = cloneDrafts(result.chat);
      setDrafts(fresh);
      snapshotRef.current = fresh;

      const added =
        result.generated_days.length + result.consolidated_weeks.length;
      const failed = result.failed_days.length + result.failed_weeks.length;
      const remaining = result.remaining_missing_day_count;
      if (added === 0 && failed === 0 && remaining === 0) {
        setBackfillNotice("No missing summaries found.");
      } else {
        setBackfillNotice(
          [
            added > 0
              ? `Added ${added} ${added === 1 ? "summary" : "summaries"}`
              : "No summaries added",
            remaining > 0
              ? `${remaining} older ${remaining === 1 ? "day remains" : "days remain"}`
              : null,
            failed > 0 ? `${failed} failed` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        );
      }
    },
    onError: () => {
      setBackfillNotice(null);
    },
  });

  const title: ReactNode = (
    <span className={classes.modalTitle}>
      <IconCalendarClock size={16} className={classes.modalTitleIcon} />
      <span className={classes.modalTitleText}>Automatic Summarization</span>
      <span className={classes.modalMeta}>
        {entries.length} {entries.length === 1 ? "entry" : "entries"} · ~
        {fmtTokens(totalTokens)} token{totalTokens !== 1 ? "s" : ""}
      </span>
    </span>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="lg"
      className={classes.modal}
      bodyClassName={classes.modalBody}
    >
      <div className={classes.shell}>
        <div className={classes.body}>
          <div className={classes.infoBox}>
            Days from the current week are automatically consolidated into a
            weekly summary once the week ends. Edits to the current week&apos;s
            days may be rewritten by that consolidation.
          </div>

          <div className={classes.backfillCard}>
            <div className={classes.backfillRow}>
              <div className={classes.backfillCopy}>
                <p className={classes.backfillTitle}>Missing Summaries</p>
                <p className={classes.backfillHint}>
                  Retry past days that failed or never received an automatic
                  summary.
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isDirty || backfillMutation.isPending}
                title={
                  isDirty
                    ? "Save your edits before backfilling"
                    : "Generate missing summaries"
                }
                onClick={() => {
                  if (isDirty || backfillMutation.isPending) return;
                  setBackfillNotice(null);
                  backfillMutation.mutate();
                }}
              >
                <IconRefresh
                  size={12}
                  className={
                    backfillMutation.isPending ? classes.spin : undefined
                  }
                />
                {backfillMutation.isPending ? "Checking…" : "Backfill"}
              </Button>
            </div>
            {backfillNotice || backfillMutation.isError ? (
              <p
                className={
                  backfillMutation.isError
                    ? classes.backfillError
                    : classes.backfillNotice
                }
              >
                {backfillMutation.isError
                  ? "Backfill failed — check the server log for details."
                  : backfillNotice}
              </p>
            ) : null}
          </div>

          {entries.length === 0 ? (
            <div className={classes.empty}>
              No summaries yet — come back after your first day of chatting has
              ended.
            </div>
          ) : (
            <div className={classes.expandAllRow}>
              <button
                type="button"
                className={classes.expandAll}
                onClick={toggleAll}
                title={allExpanded ? "Collapse all" : "Expand all"}
              >
                {allExpanded ? (
                  <IconChevronsDown size={14} />
                ) : (
                  <IconChevronsUp size={14} />
                )}
                {allExpanded ? "Collapse all" : "Expand all"}
              </button>
            </div>
          )}

          {entries.map((entry) => {
            const current =
              entry.kind === "week"
                ? drafts.week_summaries[entry.key]
                : drafts.day_summaries[entry.key];
            if (!current) return null;
            const id = `${entry.kind}:${entry.key}`;
            const isOpen = expanded.has(id);
            const entryTokens = estimateTokens(entryTokenText(current));

            return (
              <div key={id} className={classes.entry}>
                <button
                  type="button"
                  className={classes.entryHeader}
                  aria-expanded={isOpen}
                  onClick={() => toggleEntry(id)}
                >
                  <IconChevronRight
                    size={14}
                    className={[
                      classes.chevron,
                      isOpen ? classes.chevronOpen : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                  <span className={classes.entryLabel}>{entry.label}</span>
                  <span
                    className={[
                      classes.kindBadge,
                      entry.kind === "week"
                        ? classes.kindWeek
                        : classes.kindDay,
                    ].join(" ")}
                  >
                    {entry.kind}
                  </span>
                  <span className={classes.entryTokens}>
                    ~{fmtTokens(entryTokens)} token
                    {entryTokens !== 1 ? "s" : ""}
                  </span>
                </button>

                {isOpen ? (
                  <div className={classes.entryBody}>
                    <label className={classes.field}>
                      <span className={classes.fieldLabel}>Summary</span>
                      <AutoSizingTextarea
                        value={current.summary}
                        onChange={(summary) =>
                          updateEntry(entry.kind, entry.key, {
                            ...current,
                            summary,
                          })
                        }
                      />
                    </label>

                    <div className={classes.field}>
                      <span className={classes.fieldLabel}>Key Details</span>
                      {current.key_details.length === 0 ? (
                        <p className={classes.noDetails}>No key details.</p>
                      ) : null}
                      <div className={classes.detailsList}>
                        {current.key_details.map((detail, index) => (
                          <div key={index} className={classes.detailRow}>
                            <AutoSizingTextarea
                              value={detail}
                              onChange={(next) => {
                                const key_details = [...current.key_details];
                                key_details[index] = next;
                                updateEntry(entry.kind, entry.key, {
                                  ...current,
                                  key_details,
                                });
                              }}
                            />
                            <button
                              type="button"
                              className={classes.deleteDetail}
                              title="Delete key detail"
                              onClick={() =>
                                updateEntry(entry.kind, entry.key, {
                                  ...current,
                                  key_details: current.key_details.filter(
                                    (_, i) => i !== index,
                                  ),
                                })
                              }
                            >
                              <IconTrash size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={classes.addDetail}
                        onClick={() =>
                          updateEntry(entry.kind, entry.key, {
                            ...current,
                            key_details: [...current.key_details, ""],
                          })
                        }
                      >
                        <IconPlus size={12} />
                        Add key detail
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className={classes.footer}>
          <span className={classes.saveError}>
            {saveMutation.isError ? "Save failed — try again." : ""}
          </span>
          <div className={classes.footerActions}>
            <Button
              type="button"
              variant="ghost"
              disabled={saveMutation.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!isDirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
