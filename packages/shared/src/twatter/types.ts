export type TwatterAccountKind = "persona" | "character" | "random_user";
export type TwatterInteractionType = "like" | "repost" | "reply" | "vote";
export type TwatterPostSource = "manual" | "generated";
export type TwatterParticipantSelectionMode = "all" | "random_range" | "exact";
export type TwatterCarryoverTarget = "conversation" | "roleplay";

export type TwatterAccountSocialSettings = {
  following_account_ids: string[];
  following_account_timestamps: Record<string, string>;
  notifications_read_at?: string;
};

export type TwatterAccountProfileSettings = {
  location?: string;
  profile_generated?: boolean;
  profile_manually_edited?: boolean;
};

export type TwatterAccountSettings = {
  profile: TwatterAccountProfileSettings;
  social: TwatterAccountSocialSettings;
};

export type TwatterSettings = {
  refreshes_per_day: number;
  participant_selection_mode: TwatterParticipantSelectionMode;
  participant_min: number;
  participant_max: number;
  max_generated_posts_per_refresh: number;
  max_replies_per_refresh: number;
  max_reposts_per_refresh: number;
  max_likes_per_refresh: number;
  allow_random_users: boolean;
  invited_character_ids: string[];
  carryover_modes: TwatterCarryoverTarget[];
  carryover_hours: number;
  carryover_max_items: number;
  generation_connection_id: string | null;
  /** When set, overrides the default preset for `twatter_refresh`. */
  refresh_preset_id: string | null;
};

export type TwatterAccount = {
  id: string;
  kind: TwatterAccountKind;
  entity_id: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar: string | null;
  invited: boolean;
  settings: TwatterAccountSettings;
  created_at: string;
  updated_at: string;
};

export type TwatterAuthorSnapshot = {
  id: string;
  kind: TwatterAccountKind;
  entity_id: string;
  handle: string;
  display_name: string;
  avatar: string | null;
};

export type TwatterPollOption = {
  id: string;
  label: string;
};

export type TwatterPoll = {
  question: string;
  options: TwatterPollOption[];
};

export type TwatterPost = {
  id: string;
  author_account_id: string;
  content: string;
  image_url: string | null;
  parent_post_id: string | null;
  quote_post_id: string | null;
  source: TwatterPostSource;
  metadata: Record<string, unknown>;
  author_snapshot: TwatterAuthorSnapshot | null;
  created_at: string;
  updated_at: string;
};

export type TwatterInteraction = {
  id: string;
  actor_account_id: string;
  post_id: string;
  type: TwatterInteractionType;
  content: string | null;
  parent_interaction_id: string | null;
  actor_snapshot: TwatterAuthorSnapshot | null;
  created_at: string;
  updated_at: string;
};

export type TwatterDigestEntry = {
  id: string;
  account_ids: string[];
  content: string;
  created_at: string;
};

export type TwatterNotificationKind = "like" | "repost" | "reply" | "mention";

export type TwatterNotification = {
  id: string;
  kind: TwatterNotificationKind;
  actor_account_id: string;
  post_id: string;
  interaction_id: string | null;
  content: string;
  created_at: string;
};

export type TwatterRefreshSchedulerStatus = {
  state: "disabled" | "scheduled" | "due" | "retrying" | "completed";
  schedule_date: string;
  timezone: string;
  refreshes_per_day: number;
  scheduled_times: string[];
  completed_times: string[];
  completed_slots: number;
  successful_refreshes: number;
  next_refresh_at: string | null;
  next_attempt_at: string | null;
  last_automatic_refresh_at: string | null;
  last_error: string | null;
};

export type TwatterBootstrap = {
  settings: TwatterSettings;
  scheduler: TwatterRefreshSchedulerStatus;
  accounts: TwatterAccount[];
  posts: TwatterPost[];
  interactions: TwatterInteraction[];
  digests: TwatterDigestEntry[];
};

export const TWATTER_MAX_CONTENT = 4000;
export const TWATTER_MAX_REPLY_CONTENT = 2000;
export const TWATTER_FEED_LIMIT = 160;
export const TWATTER_CARRYOVER_TOKEN_BUDGET = 8192;
