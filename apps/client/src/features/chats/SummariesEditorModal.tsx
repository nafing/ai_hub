import { useMemo, useState } from "react";
import type { Chat, DaySummaryEntry, WeekSummaryEntry } from "@ai-hub/shared";
import { weekRangeLabel } from "@ai-hub/shared";
import { Button, Modal, Textarea, notifications } from "@/components/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  backfillConversationSummaries,
  patchConversationSummaries,
} from "./api";
import { chatKeys } from "./queries";
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
    if (JSON.stringify(value) !== JSON.stringify(snapshot.week_summaries[key])) {
      week_summaries[key] = value;
    }
  }
  return {
    ...(Object.keys(day_summaries).length ? { day_summaries } : {}),
    ...(Object.keys(week_summaries).length ? { week_summaries } : {}),
  };
}

export function SummariesEditorModal({
  chat,
  opened,
  onClose,
}: SummariesEditorModalProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState(() => cloneDrafts(chat));
  const [snapshot] = useState(() => cloneDrafts(chat));

  const entries = useMemo(() => {
    const list: Array<{
      kind: "day" | "week";
      key: string;
      label: string;
      entry: DaySummaryEntry;
    }> = [];
    for (const [key, entry] of Object.entries(drafts.week_summaries)) {
      list.push({ kind: "week", key, label: weekRangeLabel(key), entry });
    }
    for (const [key, entry] of Object.entries(drafts.day_summaries)) {
      list.push({ kind: "day", key, label: key, entry });
    }
    list.sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [drafts]);

  const saveMutation = useMutation({
    mutationFn: () => patchConversationSummaries(chat.id, computeDelta(drafts, snapshot)),
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
    mutationFn: () => backfillConversationSummaries(chat.id, { max_missing_days: 14 }),
    onSuccess: (result) => {
      queryClient.setQueryData(chatKeys.detail(result.chat.id), result.chat);
      setDrafts(cloneDrafts(result.chat));
      notifications.show({
        title: "Backfill complete",
        message: `Generated ${result.generated_days.length} day(s), ${result.consolidated_weeks.length} week(s).`,
        color: "green",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Backfill failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    },
  });

  function updateEntry(
    kind: "day" | "week",
    key: string,
    patch: Partial<DaySummaryEntry>,
  ) {
    setDrafts((current) => {
      const map =
        kind === "day" ? current.day_summaries : current.week_summaries;
      const existing = map[key] ?? { summary: "", key_details: [] };
      const next = { ...existing, ...patch };
      return kind === "day"
        ? { ...current, day_summaries: { ...current.day_summaries, [key]: next } }
        : { ...current, week_summaries: { ...current.week_summaries, [key]: next } };
    });
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Conversation summaries" size="lg">
      <div className={classes.shell}>
        <p className={classes.note}>
          Auto-generated on each reply (up to 2 missing days). Edit summaries and key
          details below, or backfill older history.
        </p>
        <div className={classes.actions}>
          <Button
            type="button"
            variant="primary"
            disabled={backfillMutation.isPending}
            onClick={() => backfillMutation.mutate()}
          >
            {backfillMutation.isPending ? "Backfilling…" : "Backfill missing days"}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save changes
          </Button>
        </div>
        {entries.length === 0 ? (
          <p className={classes.note}>No day or week summaries yet.</p>
        ) : (
          <div className={classes.list}>
            {entries.map(({ kind, key, label, entry }) => (
              <div key={`${kind}:${key}`} className={classes.card}>
                <strong>{label}</strong>
                <label className={classes.field}>
                  Summary
                  <Textarea
                    value={entry.summary}
                    onChange={(event) =>
                      updateEntry(kind, key, { summary: event.target.value })
                    }
                    rows={3}
                  />
                </label>
                <label className={classes.field}>
                  Key details (one per line)
                  <Textarea
                    value={entry.key_details.join("\n")}
                    onChange={(event) =>
                      updateEntry(kind, key, {
                        key_details: event.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean),
                      })
                    }
                    rows={4}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
