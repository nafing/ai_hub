import type { TwatterRefreshSchedulerStatus } from "./types";

export const TWATTER_REFRESH_SCHEDULE_VERSION = 1 as const;

export type PersistedTwatterRefreshSchedule = {
  version: typeof TWATTER_REFRESH_SCHEDULE_VERSION;
  schedule_date: string;
  timezone: string;
  refreshes_per_day: number;
  scheduled_times: string[];
  completed_times: string[];
  successful_refreshes: number;
  failure_attempts: number;
  next_attempt_at: string | null;
  last_automatic_refresh_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
};

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

export function localScheduleDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localScheduleTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
}

export function generateTwatterRefreshTimes(
  date: Date,
  refreshesPerDay: number,
): string[] {
  const count = Math.max(0, Math.min(24, Math.floor(refreshesPerDay)));
  if (count === 0) return [];

  const dayStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const dayEnd = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  ).getTime();
  const windowSize = (dayEnd - dayStart) / count;

  return Array.from({ length: count }, (_, index) => {
    const windowStart = dayStart + windowSize * index;
    const positionWithinWindow = 0.15 + Math.random() * 0.7;
    return new Date(windowStart + windowSize * positionWithinWindow).toISOString();
  });
}

export function reconcileTwatterRefreshSchedule(
  current: PersistedTwatterRefreshSchedule | null,
  refreshesPerDay: number,
  at: Date,
): PersistedTwatterRefreshSchedule {
  const count = Math.max(0, Math.min(24, Math.floor(refreshesPerDay)));
  const scheduleDate = localScheduleDate(at);
  const timezone = localScheduleTimezone();
  if (
    current &&
    current.schedule_date === scheduleDate &&
    current.timezone === timezone &&
    current.refreshes_per_day === count &&
    current.scheduled_times.length === count
  ) {
    return current;
  }

  const sameLocalDay =
    current?.schedule_date === scheduleDate && current.timezone === timezone;
  const scheduledTimes = generateTwatterRefreshTimes(at, count);
  const preservedCompletedCount = sameLocalDay
    ? Math.min(current?.completed_times.length ?? 0, count)
    : 0;

  return {
    version: TWATTER_REFRESH_SCHEDULE_VERSION,
    schedule_date: scheduleDate,
    timezone,
    refreshes_per_day: count,
    scheduled_times: scheduledTimes,
    completed_times: scheduledTimes.slice(0, preservedCompletedCount),
    successful_refreshes: sameLocalDay
      ? Math.min(current?.successful_refreshes ?? 0, preservedCompletedCount)
      : 0,
    failure_attempts: 0,
    next_attempt_at: null,
    last_automatic_refresh_at: current?.last_automatic_refresh_at ?? null,
    last_attempt_at: sameLocalDay ? (current?.last_attempt_at ?? null) : null,
    last_error: null,
  };
}

export function dueTwatterRefreshTimes(
  schedule: PersistedTwatterRefreshSchedule,
  at: Date,
): string[] {
  const completed = new Set(schedule.completed_times);
  const now = at.getTime();
  return schedule.scheduled_times.filter(
    (time) => !completed.has(time) && Date.parse(time) <= now,
  );
}

export function nextTwatterRefreshTime(
  schedule: PersistedTwatterRefreshSchedule,
): string | null {
  const completed = new Set(schedule.completed_times);
  return schedule.scheduled_times.find((time) => !completed.has(time)) ?? null;
}

export function markTwatterRefreshAttempt(
  schedule: PersistedTwatterRefreshSchedule,
  at: Date,
): PersistedTwatterRefreshSchedule {
  return { ...schedule, last_attempt_at: at.toISOString(), next_attempt_at: null };
}

export function markTwatterRefreshSuccess(
  schedule: PersistedTwatterRefreshSchedule,
  consumedTimes: string[],
  at: Date,
): PersistedTwatterRefreshSchedule {
  const scheduled = new Set(schedule.scheduled_times);
  const alreadyCompleted = new Set(schedule.completed_times);
  const matchedTimes = consumedTimes.filter((time) => scheduled.has(time));
  const fallbackTime = schedule.scheduled_times.find(
    (time) => !alreadyCompleted.has(time),
  );
  const completedTimes = Array.from(
    new Set([
      ...schedule.completed_times,
      ...matchedTimes,
      ...(matchedTimes.length === 0 && fallbackTime ? [fallbackTime] : []),
    ]),
  ).sort();

  return {
    ...schedule,
    completed_times: completedTimes,
    successful_refreshes: Math.min(
      schedule.refreshes_per_day,
      schedule.successful_refreshes + 1,
    ),
    failure_attempts: 0,
    next_attempt_at: null,
    last_automatic_refresh_at: at.toISOString(),
    last_attempt_at: at.toISOString(),
    last_error: null,
  };
}

export function markTwatterRefreshFailure(
  schedule: PersistedTwatterRefreshSchedule,
  error: string,
  at: Date,
  retryDelayMs: number,
): PersistedTwatterRefreshSchedule {
  return {
    ...schedule,
    failure_attempts: schedule.failure_attempts + 1,
    next_attempt_at: new Date(
      at.getTime() + Math.max(1_000, retryDelayMs),
    ).toISOString(),
    last_attempt_at: at.toISOString(),
    last_error: error.slice(0, 500),
  };
}

export function twatterRefreshSchedulerStatus(
  schedule: PersistedTwatterRefreshSchedule,
  at: Date,
): TwatterRefreshSchedulerStatus {
  const nextRefreshAt = nextTwatterRefreshTime(schedule);
  const retryAt = schedule.next_attempt_at
    ? Date.parse(schedule.next_attempt_at)
    : null;
  const due = dueTwatterRefreshTimes(schedule, at).length > 0;
  const state: TwatterRefreshSchedulerStatus["state"] =
    schedule.refreshes_per_day === 0
      ? "disabled"
      : schedule.last_error && retryAt !== null && retryAt > at.getTime()
        ? "retrying"
        : due
          ? "due"
          : nextRefreshAt
            ? "scheduled"
            : "completed";

  return {
    state,
    schedule_date: schedule.schedule_date,
    timezone: schedule.timezone,
    refreshes_per_day: schedule.refreshes_per_day,
    scheduled_times: schedule.scheduled_times,
    completed_times: schedule.completed_times,
    completed_slots: schedule.completed_times.length,
    successful_refreshes: schedule.successful_refreshes,
    next_refresh_at: nextRefreshAt,
    next_attempt_at: schedule.next_attempt_at,
    last_automatic_refresh_at: schedule.last_automatic_refresh_at,
    last_error: schedule.last_error,
  };
}
