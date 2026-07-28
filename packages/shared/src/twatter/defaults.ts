import type {
  CreateTwatterInteractionInput,
  CreateTwatterPostInput,
  TwatterAccountProfileUpdateInput,
  TwatterSettingsUpdateInput,
  UpdateTwatterPostInput,
} from "./api";
import type {
  TwatterAccount,
  TwatterAccountSettings,
  TwatterAccountSocialSettings,
  TwatterInteractionType,
  TwatterSettings,
} from "./types";
import { TWATTER_MAX_REPLY_CONTENT } from "./types";

export const DEFAULT_TWATTER_SETTINGS: TwatterSettings = {
  refreshes_per_day: 2,
  participant_selection_mode: "random_range",
  participant_min: 2,
  participant_max: 5,
  max_generated_posts_per_refresh: 8,
  max_replies_per_refresh: 12,
  max_reposts_per_refresh: 4,
  max_likes_per_refresh: 18,
  allow_random_users: false,
  invited_character_ids: [],
  carryover_modes: [],
  carryover_hours: 48,
  carryover_max_items: 8,
  generation_connection_id: null,
  refresh_preset_id: null,
};

export const TWATTER_RANDOM_USERS = [
  {
    entity_id: "random_user:thread-countess",
    display_name: "Thread Countess",
    bio: "Chronically online textile hobbyist who treats every Twatter argument like court gossip.",
  },
  {
    entity_id: "random_user:packet-soup",
    display_name: "Packet Soup",
    bio: "Friendly lurker, recipe collector, and accidental drama amplifier.",
  },
  {
    entity_id: "random_user:orbit-notice",
    display_name: "Orbit Notice",
    bio: "Posts vague observations, likes too quickly, and follows anyone with interesting chaos.",
  },
  {
    entity_id: "random_user:glass-bulletin",
    display_name: "Glass Bulletin",
    bio: "Local rumor account with polished manners and questionable sources.",
  },
  {
    entity_id: "random_user:moth-hour",
    display_name: "Moth Hour",
    bio: "Night-scroller who replies with eerie encouragement and niche memes.",
  },
  {
    entity_id: "random_user:brine-index",
    display_name: "Brine Index",
    bio: "Overconfident commentator who keeps a spreadsheet of everyone else's scandals.",
  },
] as const;

export function twatterHandleFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return slug ? `@${slug}` : "@anon";
}

export function normalizeTwatterHandle(handle: string): string {
  const trimmed = handle.trim();
  if (!trimmed) return "@anon";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function defaultTwatterAccountSettings(): TwatterAccountSettings {
  return {
    profile: {},
    social: {
      following_account_ids: [],
      following_account_timestamps: {},
    },
  };
}

export function normalizeTwatterSettings(
  input: Partial<TwatterSettings> & Record<string, unknown> = {},
): TwatterSettings {
  return {
    refreshes_per_day:
      typeof input.refreshes_per_day === "number"
        ? Math.min(24, Math.max(0, input.refreshes_per_day))
        : DEFAULT_TWATTER_SETTINGS.refreshes_per_day,
    participant_selection_mode:
      input.participant_selection_mode === "all" ||
      input.participant_selection_mode === "exact" ||
      input.participant_selection_mode === "random_range"
        ? input.participant_selection_mode
        : DEFAULT_TWATTER_SETTINGS.participant_selection_mode,
    participant_min:
      typeof input.participant_min === "number"
        ? Math.max(1, input.participant_min)
        : DEFAULT_TWATTER_SETTINGS.participant_min,
    participant_max:
      typeof input.participant_max === "number"
        ? Math.max(1, input.participant_max)
        : DEFAULT_TWATTER_SETTINGS.participant_max,
    max_generated_posts_per_refresh:
      typeof input.max_generated_posts_per_refresh === "number"
        ? Math.max(0, input.max_generated_posts_per_refresh)
        : DEFAULT_TWATTER_SETTINGS.max_generated_posts_per_refresh,
    max_replies_per_refresh:
      typeof input.max_replies_per_refresh === "number"
        ? Math.max(0, input.max_replies_per_refresh)
        : DEFAULT_TWATTER_SETTINGS.max_replies_per_refresh,
    max_reposts_per_refresh:
      typeof input.max_reposts_per_refresh === "number"
        ? Math.max(0, input.max_reposts_per_refresh)
        : DEFAULT_TWATTER_SETTINGS.max_reposts_per_refresh,
    max_likes_per_refresh:
      typeof input.max_likes_per_refresh === "number"
        ? Math.max(0, input.max_likes_per_refresh)
        : DEFAULT_TWATTER_SETTINGS.max_likes_per_refresh,
    allow_random_users:
      typeof input.allow_random_users === "boolean"
        ? input.allow_random_users
        : DEFAULT_TWATTER_SETTINGS.allow_random_users,
    invited_character_ids: Array.isArray(input.invited_character_ids)
      ? input.invited_character_ids.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : DEFAULT_TWATTER_SETTINGS.invited_character_ids,
    carryover_modes: Array.isArray(input.carryover_modes)
      ? input.carryover_modes.filter(
          (mode): mode is "conversation" | "roleplay" =>
            mode === "conversation" || mode === "roleplay",
        )
      : DEFAULT_TWATTER_SETTINGS.carryover_modes,
    carryover_hours:
      typeof input.carryover_hours === "number"
        ? Math.max(1, input.carryover_hours)
        : DEFAULT_TWATTER_SETTINGS.carryover_hours,
    carryover_max_items:
      typeof input.carryover_max_items === "number"
        ? Math.max(1, input.carryover_max_items)
        : DEFAULT_TWATTER_SETTINGS.carryover_max_items,
    generation_connection_id:
      typeof input.generation_connection_id === "string"
        ? input.generation_connection_id
        : input.generation_connection_id === null
          ? null
          : DEFAULT_TWATTER_SETTINGS.generation_connection_id,
    refresh_preset_id:
      typeof input.refresh_preset_id === "string"
        ? input.refresh_preset_id
        : input.refresh_preset_id === null
          ? null
          : DEFAULT_TWATTER_SETTINGS.refresh_preset_id,
  };
}

export function mergeTwatterSettings(
  current: TwatterSettings,
  patch: TwatterSettingsUpdateInput,
): TwatterSettings {
  return normalizeTwatterSettings({ ...current, ...patch });
}

export function accountSnapshot(account: TwatterAccount) {
  return {
    id: account.id,
    kind: account.kind,
    entity_id: account.entity_id,
    handle: account.handle,
    display_name: account.display_name,
    avatar: account.avatar,
  };
}

export function normalizeTwatterContent(content: string, max = 4000): string {
  return content.trim().slice(0, max);
}

export function parseTwatterPollFromMetadata(
  metadata: Record<string, unknown>,
): { question: string; options: { id: string; label: string }[] } | null {
  const poll = metadata.poll;
  if (!poll || typeof poll !== "object") return null;
  const record = poll as Record<string, unknown>;
  const question = typeof record.question === "string" ? record.question.trim() : "";
  const options = Array.isArray(record.options)
    ? record.options.filter(
        (option): option is { id: string; label: string } =>
          Boolean(option) &&
          typeof option === "object" &&
          typeof (option as { id?: unknown }).id === "string" &&
          typeof (option as { label?: unknown }).label === "string",
      )
    : [];
  if (!question || options.length < 2) return null;
  return { question, options };
}

export function buildTwatterPollMetadata(input: {
  question: string;
  options: string[];
}): Record<string, unknown> {
  const question = input.question.trim();
  const options = input.options
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 4);
  return {
    poll: {
      question,
      options: options.map((label, index) => ({
        id: `opt_${index + 1}`,
        label,
      })),
    },
  };
}

export type TwatterGeneratedPost = {
  tempId?: string;
  authorHandle: string;
  content: string;
  poll?: { question: string; options: string[] } | null;
};

export type TwatterGeneratedInteraction = {
  actorHandle: string;
  targetTempId?: string | null;
  targetPostId?: string | null;
  parentInteractionId?: string | null;
  type: TwatterInteractionType;
  content?: string | null;
  pollOptionIndex?: number | null;
};

export type TwatterGeneratedFollow = {
  actorHandle: string;
  targetHandle: string;
};

export type TwatterGeneratedDigest = {
  accountEntityIds: string[];
  content: string;
};

export type TwatterGeneratedRefresh = {
  posts: TwatterGeneratedPost[];
  interactions: TwatterGeneratedInteraction[];
  follows: TwatterGeneratedFollow[];
  digests: TwatterGeneratedDigest[];
};

export function tryParseTwatterGeneratedRefresh(
  raw: string,
): TwatterGeneratedRefresh | null {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as Record<
      string,
      unknown
    >;
    return {
      posts: Array.isArray(parsed.posts)
        ? (parsed.posts as TwatterGeneratedPost[])
        : [],
      interactions: Array.isArray(parsed.interactions)
        ? (parsed.interactions as TwatterGeneratedInteraction[])
        : [],
      follows: Array.isArray(parsed.follows)
        ? (parsed.follows as TwatterGeneratedFollow[])
        : [],
      digests: Array.isArray(parsed.digests)
        ? (parsed.digests as TwatterGeneratedDigest[])
        : [],
    };
  } catch {
    return null;
  }
}

export function validateTwatterGeneratedRefresh(
  refresh: TwatterGeneratedRefresh,
  allowedActorHandles: ReadonlySet<string>,
): string | null {
  const hasActivity =
    refresh.posts.length +
      refresh.interactions.length +
      refresh.follows.length +
      refresh.digests.length >
    0;
  if (!hasActivity) return "the response contained no timeline activity";

  const hasUsableAttribution =
    refresh.posts.some((post) =>
      allowedActorHandles.has(normalizeTwatterHandle(post.authorHandle)),
    ) ||
    refresh.interactions.some((interaction) =>
      allowedActorHandles.has(normalizeTwatterHandle(interaction.actorHandle)),
    );
  return hasUsableAttribution
    ? null
    : "the response used no selected participant handle";
}

export function defaultCreatePostInput(
  overrides: Partial<CreateTwatterPostInput> = {},
): CreateTwatterPostInput {
  return {
    persona_id: "",
    content: "",
    parent_post_id: null,
    quote_post_id: null,
    poll: null,
    ...overrides,
  };
}

export function mergeAccountSocialSettings(
  current: TwatterAccountSocialSettings,
  patch: Partial<TwatterAccountSocialSettings>,
): TwatterAccountSocialSettings {
  return {
    following_account_ids:
      patch.following_account_ids ?? current.following_account_ids,
    following_account_timestamps:
      patch.following_account_timestamps ?? current.following_account_timestamps,
    notifications_read_at:
      patch.notifications_read_at ?? current.notifications_read_at,
  };
}

export function normalizeAccountProfileUpdate(
  input: TwatterAccountProfileUpdateInput,
): TwatterAccountProfileUpdateInput {
  return {
    display_name:
      typeof input.display_name === "string" ? input.display_name : undefined,
    handle: typeof input.handle === "string" ? input.handle : undefined,
    bio: typeof input.bio === "string" ? input.bio : undefined,
    location:
      typeof input.location === "string" ? input.location : undefined,
  };
}

export function normalizeUpdatePostInput(
  input: UpdateTwatterPostInput,
): UpdateTwatterPostInput {
  return {
    content:
      typeof input.content === "string"
        ? normalizeTwatterContent(input.content)
        : undefined,
  };
}

export function normalizeCreateInteractionInput(
  input: CreateTwatterInteractionInput,
): CreateTwatterInteractionInput {
  return {
    persona_id: input.persona_id,
    type: input.type,
    content:
      typeof input.content === "string"
        ? input.content.trim().slice(0, TWATTER_MAX_REPLY_CONTENT)
        : null,
    parent_interaction_id: input.parent_interaction_id ?? null,
  };
}
