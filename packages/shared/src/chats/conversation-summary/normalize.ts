import type {
  ConversationSummaryFailureRecord,
  ConversationSummaryFailures,
  DaySummaryEntry,
  WeekSummaryEntry,
} from "./types";

function coerceSummaryEntry(value: unknown): DaySummaryEntry | null {
  if (typeof value === "string") {
    const summary = value.trim();
    return summary ? { summary, key_details: [] } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";
  const rawDetails = record.key_details ?? record.keyDetails;
  const key_details = Array.isArray(rawDetails)
    ? rawDetails.filter(
        (detail): detail is string =>
          typeof detail === "string" && detail.trim().length > 0,
      )
    : [];
  return summary || key_details.length > 0 ? { summary, key_details } : null;
}

export function normalizeDaySummaries(
  raw: unknown,
): Record<string, DaySummaryEntry> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, DaySummaryEntry> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const entry = coerceSummaryEntry(value);
    if (entry) out[key] = entry;
  }
  return out;
}

export function normalizeWeekSummaries(
  raw: unknown,
): Record<string, WeekSummaryEntry> {
  return normalizeDaySummaries(raw);
}

function coerceFailureRecord(
  value: unknown,
): ConversationSummaryFailureRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const attempts = Number(record.attempts);
  const last_attempt_at =
    typeof record.last_attempt_at === "string"
      ? record.last_attempt_at
      : typeof record.lastAttemptAt === "string"
        ? record.lastAttemptAt
        : "";
  const last_error =
    typeof record.last_error === "string"
      ? record.last_error
      : typeof record.lastError === "string"
        ? record.lastError
        : "";
  const model = typeof record.model === "string" ? record.model : "";
  if (
    !Number.isFinite(attempts) ||
    attempts <= 0 ||
    !last_attempt_at ||
    !last_error ||
    !model
  ) {
    return null;
  }
  return {
    attempts: Math.floor(attempts),
    last_attempt_at,
    last_error,
    model,
    permanent: record.permanent === true,
  };
}

export function normalizeConversationSummaryFailures(
  raw: unknown,
): ConversationSummaryFailures {
  const empty: ConversationSummaryFailures = { days: {}, weeks: {} };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const record = raw as Record<string, unknown>;
  for (const [bucketName, target] of [
    ["days", empty.days],
    ["weeks", empty.weeks],
  ] as const) {
    const bucket = record[bucketName];
    if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) continue;
    for (const [key, value] of Object.entries(
      bucket as Record<string, unknown>,
    )) {
      const failure = coerceFailureRecord(value);
      if (failure) target[key] = failure;
    }
  }
  return empty;
}
