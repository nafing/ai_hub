export type DaySummaryEntry = {
  summary: string;
  key_details: string[];
};

export type WeekSummaryEntry = DaySummaryEntry;

export type ConversationSummaryFailureRecord = {
  attempts: number;
  last_attempt_at: string;
  last_error: string;
  model: string;
  permanent: boolean;
};

export type ConversationSummaryFailures = {
  days: Record<string, ConversationSummaryFailureRecord>;
  weeks: Record<string, ConversationSummaryFailureRecord>;
};

export type ConversationSummaryBackfillInput = {
  max_missing_days?: number;
};

export type ConversationSummaryBackfillResult = {
  generated_days: string[];
  consolidated_weeks: string[];
  failed_days: Array<{ date: string; error: string }>;
  failed_weeks: Array<{ week_key: string; error: string }>;
  missing_day_count: number;
  processed_day_count: number;
  remaining_missing_day_count: number;
};

export type ConversationSummariesPatchBody = {
  day_summaries?: Record<string, DaySummaryEntry>;
  week_summaries?: Record<string, WeekSummaryEntry>;
};
