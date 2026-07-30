import type {
  TwatterAccount,
  TwatterInteraction,
  TwatterNotification,
  TwatterPost,
} from "./types";
import { normalizeTwatterHandle } from "./defaults";
import { twatterTextMentionsHandle } from "./mentions";

export type { TwatterNotificationKind, TwatterNotification } from "./types";

export function buildTwatterNotifications(input: {
  personaAccount: TwatterAccount;
  posts: TwatterPost[];
  interactions: TwatterInteraction[];
  accounts: TwatterAccount[];
  readAt?: string | null;
}): TwatterNotification[] {
  const { personaAccount, posts, interactions, accounts } = input;
  const readAtMs = input.readAt ? Date.parse(input.readAt) : 0;
  const personaHandle = normalizeTwatterHandle(personaAccount.handle);
  const personaPostIds = new Set(
    posts
      .filter((post) => post.author_account_id === personaAccount.id)
      .map((post) => post.id),
  );
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const notifications: TwatterNotification[] = [];

  for (const interaction of interactions) {
    if (interaction.actor_account_id === personaAccount.id) continue;
    const actor = accountById.get(interaction.actor_account_id);
    const actorLabel = actor?.handle ?? "@unknown";

    if (
      (interaction.type === "like" || interaction.type === "repost") &&
      personaPostIds.has(interaction.post_id)
    ) {
      notifications.push({
        id: `${interaction.type}:${interaction.id}`,
        kind: interaction.type,
        actor_account_id: interaction.actor_account_id,
        post_id: interaction.post_id,
        interaction_id: interaction.id,
        content: `${actorLabel} ${interaction.type === "like" ? "liked" : "reposted"} your post`,
        created_at: interaction.created_at,
      });
      continue;
    }

    if (interaction.type === "reply") {
      const mentionsPersona = twatterTextMentionsHandle(
        interaction.content,
        personaHandle,
      );
      const repliesToPersonaPost = personaPostIds.has(interaction.post_id);

      if (repliesToPersonaPost || mentionsPersona) {
        notifications.push({
          id: `reply:${interaction.id}`,
          kind: mentionsPersona && !repliesToPersonaPost ? "mention" : "reply",
          actor_account_id: interaction.actor_account_id,
          post_id: interaction.post_id,
          interaction_id: interaction.id,
          content: `${actorLabel} replied: ${(interaction.content ?? "").slice(0, 120)}`,
          created_at: interaction.created_at,
        });
      }
      continue;
    }
  }

  for (const post of posts) {
    if (post.author_account_id === personaAccount.id) continue;
    if (!twatterTextMentionsHandle(post.content, personaHandle)) continue;
    notifications.push({
      id: `mention:post:${post.id}`,
      kind: "mention",
      actor_account_id: post.author_account_id,
      post_id: post.id,
      interaction_id: null,
      content: `${post.author_snapshot?.handle ?? "@unknown"} mentioned you`,
      created_at: post.created_at,
    });
  }

  notifications.sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );

  if (!readAtMs) return notifications;
  return notifications.filter(
    (notification) => Date.parse(notification.created_at) > readAtMs,
  );
}

export function countUnreadTwatterNotifications(input: {
  personaAccount: TwatterAccount;
  posts: TwatterPost[];
  interactions: TwatterInteraction[];
  accounts: TwatterAccount[];
}): number {
  const readAt = input.personaAccount.settings.social.notifications_read_at;
  return buildTwatterNotifications({ ...input, readAt }).length;
}
