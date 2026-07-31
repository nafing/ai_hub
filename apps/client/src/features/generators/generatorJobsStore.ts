import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  GeneratorCategory,
  LlmChatMessage,
  PresetMarkerContent,
  PresetVariableValues,
} from "@ai-hub/shared";
import { notifications } from "@/components/ui";
import { playAppSound } from "@/features/sounds";
import {
  runGenerator,
  type RunGeneratorInput,
  type RunGeneratorResult,
} from "./api";

export type GeneratorJobStatus = "running" | "completed" | "failed";

export type GeneratorJobRequest = {
  connectionId?: string;
  presetId?: string;
  generatorPresetId?: string;
  variables: PresetVariableValues;
  markers: PresetMarkerContent;
  userMessage?: string;
};

export type GeneratorJobResult = {
  content: string;
  thinking: string;
  reply: string;
  finishReason: string | null;
  model: string | null;
  messages: LlmChatMessage[];
};

export type GeneratorJob = {
  id: string;
  title: string;
  category: GeneratorCategory;
  status: GeneratorJobStatus;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
  sessionType: "character_import" | null;
  sessionId: string | null;
  request: GeneratorJobRequest;
  result: GeneratorJobResult | null;
};

type GeneratorJobsStore = {
  jobs: GeneratorJob[];
  activeCount: () => number;
  attentionCount: () => number;
  dismissJob: (jobId: string) => void;
  clearFinished: () => void;
  runTrackedGenerator: (
    input: RunGeneratorInput & {
      title: string;
      jobId?: string;
      sessionType?: GeneratorJob["sessionType"];
      sessionId?: string | null;
      notifyOnComplete?: boolean;
    },
  ) => Promise<RunGeneratorResult>;
};

const MAX_JOBS = 40;
const INTERRUPTED = "Interrupted (page reloaded)";

function trimJobs(jobs: GeneratorJob[]): GeneratorJob[] {
  return jobs.slice(0, MAX_JOBS);
}

function finalizeInterruptedJobs(jobs: GeneratorJob[]): GeneratorJob[] {
  const now = new Date().toISOString();
  return jobs.map((job) =>
    job.status === "running"
      ? {
          ...job,
          status: "failed" as const,
          completedAt: now,
          error: job.error || INTERRUPTED,
        }
      : job,
  );
}

export const useGeneratorJobsStore = create<GeneratorJobsStore>()(
  persist(
    (set, get) => ({
      jobs: [],

      activeCount: () =>
        get().jobs.filter((job) => job.status === "running").length,

      attentionCount: () =>
        get().jobs.filter(
          (job) =>
            job.status === "running" ||
            (job.status === "completed" &&
              job.sessionType === "character_import"),
        ).length,

      dismissJob: (jobId) => {
        set((state) => ({
          jobs: state.jobs.filter((job) => job.id !== jobId),
        }));
      },

      clearFinished: () => {
        set((state) => ({
          jobs: state.jobs.filter((job) => job.status === "running"),
        }));
      },

      runTrackedGenerator: async (input) => {
        const jobId = input.jobId ?? crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const job: GeneratorJob = {
          id: jobId,
          title: input.title,
          category: input.category,
          status: "running",
          createdAt,
          completedAt: null,
          error: null,
          sessionType: input.sessionType ?? null,
          sessionId: input.sessionId ?? null,
          request: {
            connectionId: input.connectionId,
            presetId: input.presetId,
            generatorPresetId: input.generatorPresetId,
            variables: { ...(input.variables ?? {}) },
            markers: { ...(input.markers ?? {}) },
            userMessage: input.userMessage,
          },
          result: null,
        };

        set((state) => ({ jobs: trimJobs([job, ...state.jobs]) }));

        try {
          const result = await runGenerator(input);
          set((state) => ({
            jobs: state.jobs.map((item) =>
              item.id === jobId
                ? {
                    ...item,
                    status: "completed",
                    completedAt: new Date().toISOString(),
                    result: {
                      content: result.content,
                      thinking: result.thinking,
                      reply: result.reply,
                      finishReason: result.finishReason,
                      model: result.model,
                      messages: result.messages,
                    },
                  }
                : item,
            ),
          }));

          if (input.notifyOnComplete !== false) {
            const onActivityPage =
              typeof window !== "undefined" &&
              window.location.pathname.startsWith("/activity");
            if (!onActivityPage) {
              notifications.show({
                title: "Generator finished",
                message: input.title,
                color: "green",
              });
            }
          }

          return result;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          playAppSound("generator", "error");
          set((state) => ({
            jobs: state.jobs.map((item) =>
              item.id === jobId
                ? {
                    ...item,
                    status: "failed",
                    completedAt: new Date().toISOString(),
                    error: message,
                  }
                : item,
            ),
          }));
          throw error;
        }
      },
    }),
    {
      name: "ai-hub-generator-jobs",
      partialize: (state) => ({ jobs: state.jobs }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<GeneratorJobsStore>;
        const jobs = Array.isArray(stored.jobs)
          ? finalizeInterruptedJobs(stored.jobs)
          : current.jobs;
        return {
          ...current,
          jobs: trimJobs(jobs),
        };
      },
    },
  ),
);
