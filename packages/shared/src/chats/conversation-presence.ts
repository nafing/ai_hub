/** Conversation presence / schedule helpers (Marinara-style). */

export const CONVERSATION_PRESENCE_STATUSES = [
  "online",
  "idle",
  "dnd",
  "offline",
] as const;

export type ConversationPresenceStatus =
  (typeof CONVERSATION_PRESENCE_STATUSES)[number];

export type ConversationStatusOverride = {
  status: ConversationPresenceStatus;
  activity?: string;
  expiresAt?: string | null;
};

export type ConversationMessageIntent =
  | "check_in"
  | "long_absence_check_in"
  | "came_back_online"
  | "after_busy"
  | "good_morning"
  | "good_night"
  | "meal_break"
  | "transition_ping";

export type ScheduleBlock = {
  /** Hour range, e.g. "06:00-08:00" */
  time: string;
  activity: string;
  status: ConversationPresenceStatus;
};

export type DaySchedule = ScheduleBlock[];

export type WeekSchedule = {
  weekStart: string;
  days: Record<string, DaySchedule>;
  inactivityThresholdMinutes: number;
  idleResponseDelayMinutes?: number;
  dndResponseDelayMinutes?: number;
  autonomousDailyCapOverride?: number | null;
  routineSummary?: string | null;
  routineSummaryGeneratedAt?: string | null;
  disabledAutonomousIntents?: ConversationMessageIntent[];
  /** 0–100 talkativeness for autonomous frequency (schedule layer). */
  talkativeness: number;
};

export type CharacterSchedules = Record<string, WeekSchedule>;

export type AutonomousDailyBudget = {
  date: string;
  counts: Record<string, number>;
};

export type CurrentConversationStatus = {
  status: ConversationPresenceStatus;
  activity: string;
  override?: ConversationStatusOverride;
};

export const CONVERSATION_SCHEDULE_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const CONVERSATION_COMMAND_KEYS = [
  "react",
  "schedule_update",
  "memory",
  "cross_post",
] as const;

export type ConversationCommandKey = (typeof CONVERSATION_COMMAND_KEYS)[number];

export function toConversationScheduleWallClockDate(
  date: Date,
  timeZone?: string | null,
): Date {
  if (!timeZone) return date;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date);
    const readPart = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const hour = readPart("hour");
    return new Date(
      readPart("year"),
      readPart("month") - 1,
      readPart("day"),
      hour === 24 ? 0 : hour,
      readPart("minute"),
      readPart("second"),
    );
  } catch {
    return date;
  }
}

export function getCurrentStatus(
  schedule: WeekSchedule,
  now: Date = new Date(),
): { status: ConversationPresenceStatus; activity: string } {
  const dayName = CONVERSATION_SCHEDULE_DAYS[(now.getDay() + 6) % 7]!;
  const daySchedule = schedule.days[dayName];
  if (!daySchedule || daySchedule.length === 0) {
    return { status: "online", activity: "free time" };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const block of daySchedule) {
    if (!block || typeof block.time !== "string") continue;
    const [startStr, endStr] = block.time.split("-");
    if (!startStr || !endStr) continue;

    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    const startMin = (sh ?? 0) * 60 + (sm ?? 0);
    const endMin = (eh ?? 0) * 60 + (em ?? 0);

    if (startMin <= currentMinutes && currentMinutes < endMin) {
      return { status: block.status, activity: block.activity };
    }
    if (
      startMin > endMin &&
      (currentMinutes >= startMin || currentMinutes < endMin)
    ) {
      return { status: block.status, activity: block.activity };
    }
  }

  return { status: "online", activity: "free time" };
}

function isManualPresenceStatus(
  value: unknown,
): value is ConversationPresenceStatus {
  return (
    value === "online" ||
    value === "idle" ||
    value === "dnd" ||
    value === "offline"
  );
}

export function getActiveStatusOverride(
  override: ConversationStatusOverride | null | undefined,
  now: Date = new Date(),
): ConversationStatusOverride | null {
  if (!override || !isManualPresenceStatus(override.status)) return null;
  if (typeof override.expiresAt === "string") {
    const expiresAt = new Date(override.expiresAt).getTime();
    if (
      !override.expiresAt.trim() ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= now.getTime()
    ) {
      return null;
    }
  }
  return override;
}

export function getEffectiveCurrentStatus(
  schedule: WeekSchedule | null | undefined,
  override: ConversationStatusOverride | null | undefined,
  now: Date = new Date(),
  fallbackActivity = "free time",
  scheduleNow: Date = now,
): CurrentConversationStatus {
  const scheduled = schedule
    ? getCurrentStatus(schedule, scheduleNow)
    : { status: "online" as const, activity: fallbackActivity };
  const activeOverride = getActiveStatusOverride(override, now);
  if (!activeOverride) return scheduled;
  const activity =
    typeof activeOverride.activity === "string"
      ? activeOverride.activity.trim()
      : scheduled.activity;
  return { status: activeOverride.status, activity, override: activeOverride };
}

/** Daily autonomous cap from 0–1 talkativeness (Marinara scale adapted). */
export function dailyCapFromTalkativeness(talkativeness01: number): number {
  const t = Number.isFinite(talkativeness01) ? talkativeness01 : 0.5;
  if (t >= 0.8) return 8;
  if (t >= 0.6) return 6;
  if (t >= 0.4) return 5;
  if (t >= 0.2) return 3;
  return 2;
}

export function dailyCapForCharacter(input: {
  talkativeness01: number;
  chatCapOverride?: number | null;
  scheduleCapOverride?: number | null;
}): number {
  let cap = dailyCapFromTalkativeness(input.talkativeness01);
  if (
    typeof input.scheduleCapOverride === "number" &&
    Number.isFinite(input.scheduleCapOverride)
  ) {
    cap = Math.min(cap, Math.max(0, Math.floor(input.scheduleCapOverride)));
  }
  if (
    typeof input.chatCapOverride === "number" &&
    Number.isFinite(input.chatCapOverride)
  ) {
    cap = Math.min(cap, Math.max(0, Math.floor(input.chatCapOverride)));
  }
  return Math.min(8, Math.max(0, cap));
}

export function busyDelayMsForStatus(
  status: ConversationPresenceStatus,
  schedule?: WeekSchedule | null,
): number {
  if (status === "online" || status === "offline") return 0;
  if (status === "idle") {
    if (
      typeof schedule?.idleResponseDelayMinutes === "number" &&
      Number.isFinite(schedule.idleResponseDelayMinutes)
    ) {
      return Math.max(0, schedule.idleResponseDelayMinutes) * 60_000;
    }
    return (1 + Math.floor(Math.random() * 3)) * 60_000;
  }
  if (status === "dnd") {
    if (
      typeof schedule?.dndResponseDelayMinutes === "number" &&
      Number.isFinite(schedule.dndResponseDelayMinutes)
    ) {
      return Math.max(0, schedule.dndResponseDelayMinutes) * 60_000;
    }
    return (2 + Math.floor(Math.random() * 4)) * 60_000;
  }
  return 0;
}

export function inactivityThresholdMinutes(
  schedule?: WeekSchedule | null,
  talkativeness01 = 0.5,
): number {
  if (
    schedule &&
    typeof schedule.inactivityThresholdMinutes === "number" &&
    Number.isFinite(schedule.inactivityThresholdMinutes)
  ) {
    return Math.max(0, schedule.inactivityThresholdMinutes);
  }
  // Talkativeness 0–1 → ~360–30 minutes when active
  const t = Math.min(1, Math.max(0, talkativeness01));
  return Math.round(360 - t * 330);
}

export function normalizeWeekSchedule(value: unknown): WeekSchedule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const daysRaw =
    record.days && typeof record.days === "object" && !Array.isArray(record.days)
      ? (record.days as Record<string, unknown>)
      : {};
  const days: Record<string, DaySchedule> = {};
  for (const day of CONVERSATION_SCHEDULE_DAYS) {
    const blocks = daysRaw[day];
    if (!Array.isArray(blocks)) {
      days[day] = [];
      continue;
    }
    days[day] = blocks
      .map((block): ScheduleBlock | null => {
        if (!block || typeof block !== "object" || Array.isArray(block)) {
          return null;
        }
        const entry = block as Record<string, unknown>;
        const time = typeof entry.time === "string" ? entry.time.trim() : "";
        const activity =
          typeof entry.activity === "string" ? entry.activity.trim() : "";
        const status = isManualPresenceStatus(entry.status)
          ? entry.status
          : "online";
        if (!time) return null;
        return { time, activity: activity || "free time", status };
      })
      .filter((block): block is ScheduleBlock => Boolean(block));
  }

  const talkativeness =
    typeof record.talkativeness === "number" &&
    Number.isFinite(record.talkativeness)
      ? Math.min(100, Math.max(0, record.talkativeness))
      : 50;

  return {
    weekStart:
      typeof record.weekStart === "string" ? record.weekStart : "",
    days,
    inactivityThresholdMinutes:
      typeof record.inactivityThresholdMinutes === "number" &&
      Number.isFinite(record.inactivityThresholdMinutes)
        ? Math.max(0, Math.floor(record.inactivityThresholdMinutes))
        : 60,
    idleResponseDelayMinutes:
      typeof record.idleResponseDelayMinutes === "number"
        ? record.idleResponseDelayMinutes
        : undefined,
    dndResponseDelayMinutes:
      typeof record.dndResponseDelayMinutes === "number"
        ? record.dndResponseDelayMinutes
        : undefined,
    autonomousDailyCapOverride:
      typeof record.autonomousDailyCapOverride === "number"
        ? record.autonomousDailyCapOverride
        : record.autonomousDailyCapOverride === null
          ? null
          : undefined,
    routineSummary:
      typeof record.routineSummary === "string" ? record.routineSummary : null,
    routineSummaryGeneratedAt:
      typeof record.routineSummaryGeneratedAt === "string"
        ? record.routineSummaryGeneratedAt
        : null,
    disabledAutonomousIntents: Array.isArray(record.disabledAutonomousIntents)
      ? (record.disabledAutonomousIntents.filter(
          (item): item is ConversationMessageIntent => typeof item === "string",
        ) as ConversationMessageIntent[])
      : undefined,
    talkativeness,
  };
}

export function normalizeCharacterSchedules(
  value: unknown,
): CharacterSchedules {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CharacterSchedules = {};
  for (const [id, schedule] of Object.entries(value)) {
    const normalized = normalizeWeekSchedule(schedule);
    if (normalized) out[id] = normalized;
  }
  return out;
}

export function normalizeStatusOverrides(
  value: unknown,
): Record<string, ConversationStatusOverride> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, ConversationStatusOverride> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    if (!isManualPresenceStatus(record.status)) continue;
    out[id] = {
      status: record.status,
      activity:
        typeof record.activity === "string" ? record.activity : undefined,
      expiresAt:
        typeof record.expiresAt === "string" || record.expiresAt === null
          ? (record.expiresAt as string | null)
          : undefined,
    };
  }
  return out;
}

export function normalizeAutonomousDailyBudget(
  value: unknown,
): AutonomousDailyBudget {
  const today = new Date().toISOString().slice(0, 10);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { date: today, counts: {} };
  }
  const record = value as Record<string, unknown>;
  const date =
    typeof record.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
      ? record.date
      : today;
  const counts: Record<string, number> = {};
  if (record.counts && typeof record.counts === "object" && !Array.isArray(record.counts)) {
    for (const [id, count] of Object.entries(record.counts)) {
      if (typeof count === "number" && Number.isFinite(count)) {
        counts[id] = Math.max(0, Math.floor(count));
      }
    }
  }
  if (date !== today) return { date: today, counts: {} };
  return { date, counts };
}

export function emptyWeekSchedule(talkativeness = 50): WeekSchedule {
  const days: Record<string, DaySchedule> = {};
  for (const day of CONVERSATION_SCHEDULE_DAYS) {
    days[day] = [
      { time: "00:00-24:00", activity: "free time", status: "online" },
    ];
  }
  const monday = new Date();
  const day = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - day);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    days,
    inactivityThresholdMinutes: 60,
    talkativeness,
  };
}

/**
 * Active character ids after inactive + offline filters.
 * If every member would be excluded, fall back to the previous active set.
 */
export function filterOnlineCharacterIds(input: {
  characterIds: string[];
  statuses: Record<string, ConversationPresenceStatus>;
}): string[] {
  const online = input.characterIds.filter(
    (id) => (input.statuses[id] ?? "online") !== "offline",
  );
  return online.length > 0 ? online : input.characterIds;
}
