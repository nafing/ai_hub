import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  dueTwatterRefreshTimes,
  markTwatterRefreshAttempt,
  markTwatterRefreshFailure,
  markTwatterRefreshSuccess,
  nextTwatterRefreshTime,
  type PersistedTwatterRefreshSchedule,
} from "@ai-hub/shared";
import { TwatterRefreshService } from "./twatter-refresh.service";
import { TwatterService } from "./twatter.service";

const TWATTER_SCHEDULER_INITIAL_DELAY_MS = 20_000;
const TWATTER_SCHEDULER_MAX_POLL_MS = 60_000;
const TWATTER_SCHEDULER_CONFIGURATION_RETRY_MS = 15 * 60_000;
const TWATTER_SCHEDULER_FAILURE_BASE_RETRY_MS = 5 * 60_000;
const TWATTER_SCHEDULER_FAILURE_MAX_RETRY_MS = 60 * 60_000;

function twatterRefreshRetryDelayMs(failureAttempts: number): number {
  return Math.min(
    TWATTER_SCHEDULER_FAILURE_MAX_RETRY_MS,
    TWATTER_SCHEDULER_FAILURE_BASE_RETRY_MS *
      2 ** Math.max(0, failureAttempts),
  );
}

function nextTwatterSchedulerPollDelayMs(
  schedule: PersistedTwatterRefreshSchedule,
  at: Date,
): number {
  if (schedule.refreshes_per_day === 0) return TWATTER_SCHEDULER_MAX_POLL_MS;
  const now = at.getTime();
  const retryAt = schedule.next_attempt_at
    ? Date.parse(schedule.next_attempt_at)
    : Number.NaN;
  if (Number.isFinite(retryAt) && retryAt > now) {
    return Math.max(
      1_000,
      Math.min(TWATTER_SCHEDULER_MAX_POLL_MS, retryAt - now),
    );
  }
  const nextRefreshAt = nextTwatterRefreshTime(schedule);
  if (!nextRefreshAt) return TWATTER_SCHEDULER_MAX_POLL_MS;
  return Math.max(
    1_000,
    Math.min(TWATTER_SCHEDULER_MAX_POLL_MS, Date.parse(nextRefreshAt) - now),
  );
}

@Injectable()
export class TwatterSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TwatterSchedulerService.name);
  private stopped = false;
  private polling = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly twatter: TwatterService,
    private readonly refresh: TwatterRefreshService,
  ) {}

  onModuleInit(): void {
    this.scheduleNext(TWATTER_SCHEDULER_INITIAL_DELAY_MS);
    this.logger.log("Automatic Twatter refresh scheduler started");
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private scheduleNext(delayMs: number): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.poll();
    }, Math.max(1_000, delayMs));
    this.timer.unref?.();
  }

  private async persistFailure(
    schedule: PersistedTwatterRefreshSchedule,
    error: string,
    at: Date,
  ): Promise<PersistedTwatterRefreshSchedule> {
    const failed = markTwatterRefreshFailure(
      schedule,
      error,
      at,
      twatterRefreshRetryDelayMs(schedule.failure_attempts),
    );
    await this.twatter.saveRefreshSchedule(failed);
    if (error.includes("generation connection")) {
      this.logger.debug(
        "Automatic Twatter refresh waiting for configuration: %s",
        error,
      );
    } else {
      this.logger.warn(
        "Automatic Twatter refresh failed; retrying at %s: %s",
        failed.next_attempt_at ?? "unknown",
        error,
      );
    }
    return failed;
  }

  private async poll(): Promise<void> {
    if (this.stopped || this.polling) return;
    this.polling = true;
    let nextDelay = TWATTER_SCHEDULER_MAX_POLL_MS;
    try {
      const now = new Date();
      const settings = await this.twatter.getSettings();
      let schedule = await this.twatter.ensureRefreshSchedule(now);
      const retryAt = schedule.next_attempt_at
        ? Date.parse(schedule.next_attempt_at)
        : Number.NaN;
      if (Number.isFinite(retryAt) && retryAt > now.getTime()) {
        nextDelay = nextTwatterSchedulerPollDelayMs(schedule, now);
        return;
      }

      const dueTimes = dueTwatterRefreshTimes(schedule, now);
      if (settings.refreshes_per_day === 0 || dueTimes.length === 0) {
        nextDelay = nextTwatterSchedulerPollDelayMs(schedule, now);
        return;
      }

      schedule = markTwatterRefreshAttempt(schedule, now);
      await this.twatter.saveRefreshSchedule(schedule);

      if (!settings.generation_connection_id) {
        schedule = await this.persistFailure(
          schedule,
          "Choose a generation connection for Twatter first.",
          new Date(),
        );
        nextDelay = nextTwatterSchedulerPollDelayMs(schedule, new Date());
        return;
      }

      try {
        await this.refresh.refreshTimeline();
        const completedAt = new Date();
        const latest = await this.twatter.ensureRefreshSchedule(completedAt);
        const latestDueTimes = dueTwatterRefreshTimes(latest, completedAt);
        const consumedTimes = dueTimes.filter((time: string) =>
          latest.scheduled_times.includes(time),
        );
        const completed = markTwatterRefreshSuccess(
          latest,
          consumedTimes.length > 0 ? consumedTimes : latestDueTimes,
          completedAt,
        );
        await this.twatter.saveRefreshSchedule(completed);
        this.logger.log(
          "Automatic Twatter timeline refresh completed; consumed %d due slot(s)",
          Math.max(consumedTimes.length, latestDueTimes.length),
        );
        nextDelay = nextTwatterSchedulerPollDelayMs(completed, completedAt);
      } catch (error) {
        const completedAt = new Date();
        const message =
          error instanceof Error ? error.message : String(error);
        const latest = await this.twatter.ensureRefreshSchedule(completedAt);
        const failed = await this.persistFailure(latest, message, completedAt);
        nextDelay = nextTwatterSchedulerPollDelayMs(failed, completedAt);
      }
    } catch (error) {
      const at = new Date();
      const message = error instanceof Error ? error.message : String(error);
      try {
        const schedule = await this.twatter.ensureRefreshSchedule(at);
        const failed = await this.persistFailure(schedule, message, at);
        nextDelay = nextTwatterSchedulerPollDelayMs(failed, at);
      } catch (persistError) {
        this.logger.error(
          persistError,
          "Failed to persist Twatter scheduler failure state",
        );
      }
    } finally {
      this.polling = false;
      this.scheduleNext(nextDelay);
    }
  }
}
