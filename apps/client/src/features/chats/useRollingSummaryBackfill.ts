import { useCallback, useRef, useState } from "react";
import {
  isMessageHiddenFromPrompt,
  visibleChatMessages,
  type Chat,
  type ChatSummaryEntry,
  type GenerateChatSummaryInput,
} from "@ai-hub/shared";
import { generateChatSummary } from "./api";

export type RollingSummaryBackfillProgress = {
  status: "idle" | "running" | "done" | "error";
  currentBatch: number;
  totalBatches: number;
  rangeStart: number;
  rangeEnd: number;
  message: string | null;
};

const INITIAL_PROGRESS: RollingSummaryBackfillProgress = {
  status: "idle",
  currentBatch: 0,
  totalBatches: 0,
  rangeStart: 0,
  rangeEnd: 0,
  message: null,
};

type BackfillOptions = {
  batchSize?: number;
  maxMessagesPerBatch?: number;
  onChatUpdated?: (chat: Chat) => void;
};

function buildBackfillBatches(
  messages: Array<{ id: string; role: string; hidden_from_prompt?: boolean }>,
  summaryEntries: ChatSummaryEntry[],
  batchSize: number,
  maxMessagesPerBatch: number,
): Array<{ rangeStart: number; rangeEnd: number }> {
  const summarizedIds = new Set<string>();
  for (const entry of summaryEntries) {
    for (const id of entry.message_ids ?? []) summarizedIds.add(id);
  }

  const totalMessageCount = messages.length;
  const safeBatchSize = Math.max(1, Math.min(totalMessageCount, batchSize));
  const batches: Array<{ rangeStart: number; rangeEnd: number }> = [];
  let cursor = 0;

  while (cursor < totalMessageCount) {
    while (cursor < totalMessageCount) {
      const message = messages[cursor]!;
      if (summarizedIds.has(message.id) || isMessageHiddenFromPrompt(message)) {
        cursor += 1;
      } else {
        break;
      }
    }
    if (cursor >= totalMessageCount) break;

    let userCount = 0;
    let msgCount = 0;
    let endCursor = cursor;
    while (
      endCursor < totalMessageCount &&
      userCount < safeBatchSize &&
      msgCount < maxMessagesPerBatch
    ) {
      const message = messages[endCursor]!;
      if (!isMessageHiddenFromPrompt(message)) {
        if (message.role === "user") userCount += 1;
        msgCount += 1;
      }
      endCursor += 1;
    }

    batches.push({ rangeStart: cursor + 1, rangeEnd: endCursor });
    cursor = endCursor;
  }

  return batches;
}

export function useRollingSummaryBackfill() {
  const [progress, setProgress] = useState<RollingSummaryBackfillProgress>(
    INITIAL_PROGRESS,
  );
  const abortRef = useRef<AbortController | null>(null);

  const stopBackfill = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress(INITIAL_PROGRESS);
  }, []);

  const startBackfill = useCallback(
    async (chat: Chat, options: BackfillOptions = {}) => {
      if (progress.status === "running") return;

      const batchSize = options.batchSize ?? chat.settings.summary_run_interval;
      const maxMessagesPerBatch = options.maxMessagesPerBatch ?? 500;
      const messages = visibleChatMessages(chat.messages);
      const batches = buildBackfillBatches(
        messages,
        chat.summary_entries,
        batchSize,
        maxMessagesPerBatch,
      );

      if (batches.length === 0) {
        setProgress({
          ...INITIAL_PROGRESS,
          status: "done",
          message: "Everything is already summarized.",
        });
        return;
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      setProgress({
        status: "running",
        currentBatch: 0,
        totalBatches: batches.length,
        rangeStart: 0,
        rangeEnd: 0,
        message: null,
      });

      let latestChat = chat;
      let failedBatches = 0;

      for (let index = 0; index < batches.length; index += 1) {
        if (abortController.signal.aborted) break;

        const batch = batches[index]!;
        setProgress((current) => ({
          ...current,
          currentBatch: index + 1,
          rangeStart: batch.rangeStart,
          rangeEnd: batch.rangeEnd,
        }));

        const input: GenerateChatSummaryInput = {
          range_start_index: batch.rangeStart,
          range_end_index: batch.rangeEnd,
        };

        try {
          latestChat = await generateChatSummary(chat.id, input);
          options.onChatUpdated?.(latestChat);
        } catch (error) {
          failedBatches += 1;
          if (abortController.signal.aborted) break;
          setProgress({
            status: "error",
            currentBatch: index + 1,
            totalBatches: batches.length,
            rangeStart: batch.rangeStart,
            rangeEnd: batch.rangeEnd,
            message:
              error instanceof Error
                ? error.message
                : "Summary batch failed.",
          });
          abortRef.current = null;
          return;
        }
      }

      abortRef.current = null;
      const message =
        failedBatches > 0
          ? `${failedBatches} batch(es) failed.`
          : `Backfill complete (${batches.length} batch${batches.length === 1 ? "" : "es"}).`;
      setProgress({
        status: failedBatches > 0 ? "error" : "done",
        currentBatch: batches.length,
        totalBatches: batches.length,
        rangeStart: 0,
        rangeEnd: 0,
        message,
      });

      return { chat: latestChat, message };
    },
    [progress.status],
  );

  return { progress, startBackfill, stopBackfill };
}
