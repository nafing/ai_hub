import { create } from "zustand";
import type { GeneratorCategory } from "@ai-hub/shared";
import { notifications } from "@/components/ui";
import { playAppSound } from "@/features/sounds";
import {
  runGenerator,
  type RunGeneratorInput,
  type RunGeneratorResult,
} from "./api";

export type GeneratorJobStatus = "running" | "completed" | "failed";

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
};

type GeneratorJobsStore = {
  jobs: GeneratorJob[];
  activeCount: () => number;
  attentionCount: () => number;
  dismissJob: (jobId: string) => void;
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

export const useGeneratorJobsStore = create<GeneratorJobsStore>((set, get) => ({
  jobs: [],

  activeCount: () =>
    get().jobs.filter((job) => job.status === "running").length,

  attentionCount: () =>
    get().jobs.filter(
      (job) =>
        job.status === "running" ||
        (job.status === "completed" && job.sessionType === "character_import"),
    ).length,

  dismissJob: (jobId) => {
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== jobId),
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
    };

    set((state) => ({ jobs: [job, ...state.jobs] }));

    try {
      const result = await runGenerator(input);
      set((state) => ({
        jobs: state.jobs.map((item) =>
          item.id === jobId
            ? {
                ...item,
                status: "completed",
                completedAt: new Date().toISOString(),
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
      const message = error instanceof Error ? error.message : "Unknown error";
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
}));
