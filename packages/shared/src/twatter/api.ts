import type {
  TwatterAccount,
  TwatterBootstrap,
  TwatterInteraction,
  TwatterNotification,
  TwatterPost,
  TwatterSettings,
} from "./types";
export type TwatterSettingsUpdateInput = Partial<TwatterSettings>;

export type TwatterInviteInput = {
  character_id: string;
};

export type TwatterBulkInviteInput = {
  character_ids: string[];
};

export type CreateTwatterPostInput = {
  persona_id: string;
  content: string;
  parent_post_id?: string | null;
  quote_post_id?: string | null;
  poll?: { question: string; options: string[] } | null;
  /** Optional image URL for manual posts (http(s) or data URL). */
  image_url?: string | null;
};

export type UpdateTwatterPostInput = {
  content?: string;
};

export type CreateTwatterInteractionInput = {
  persona_id: string;
  type: "like" | "repost" | "reply" | "vote";
  content?: string | null;
  parent_interaction_id?: string | null;
  poll_option_id?: string | null;
};

export type RemoveTwatterInteractionInput = {
  persona_id: string;
  type: "like" | "repost";
};

export type TwatterAccountProfileUpdateInput = {
  display_name?: string;
  handle?: string;
  bio?: string;
  location?: string;
};

export type TwatterFollowUpdateInput = {
  persona_id: string;
  following: boolean;
};

export type TwatterRefreshInput = {
  persona_id?: string;
};

export type TwatterBootstrapResponse = TwatterBootstrap;

export type TwatterPostView = TwatterPost & {
  interactions: TwatterInteraction[];
};

export type TwatterAccountView = TwatterAccount & {
  posts: TwatterPost[];
};

export type TwatterTimelineTab = "main" | "following";

export type TwatterView =
  | "home"
  | "search"
  | "notifications"
  | "profile";

export type TwatterSearchResult = {
  accounts: TwatterAccount[];
  posts: TwatterPost[];
};

export type TwatterAccountProfile = TwatterAccount & {
  posts: TwatterPost[];
  liked_posts: TwatterPost[];
  media_posts: TwatterPost[];
  follower_count: number;
  following_count: number;
};

export type TwatterNotificationsResponse = {
  notifications: TwatterNotification[];
  unread_count: number;
};

export type TwatterMarkNotificationsReadInput = {
  persona_id: string;
};

export type TwatterSearchQuery = {
  q: string;
  limit?: number;
};
