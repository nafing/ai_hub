import type {
  TwatterAccount,
  TwatterInteraction,
  TwatterPost,
  TwatterSettings,
} from "@ai-hub/shared";
import { buildOptedInChatContext } from "./twatter-chat-context";
import type { TwatterService } from "./twatter.service";

/** Runtime context injected into the preset's Timeline Brief (`generator_brief`) marker. */
export async function buildTwatterRefreshBrief(input: {
  twatter: TwatterService;
  settings: TwatterSettings;
  accounts: TwatterAccount[];
  participantAccounts: TwatterAccount[];
  recentPosts: TwatterPost[];
  recentInteractions: TwatterInteraction[];
  personaAccount: TwatterAccount | null;
}): Promise<string> {
  const participantLines = input.participantAccounts.map(
    (account) =>
      `- ${account.handle} (${account.display_name}, ${account.kind}, entityId=${account.entity_id}): ${account.bio || "No bio yet."}`,
  );

  const recentLines = input.recentPosts.slice(0, 40).map((post) => {
    const author =
      post.author_snapshot?.handle ??
      input.accounts.find((a) => a.id === post.author_account_id)?.handle ??
      "@unknown";
    const imageNote = post.image_url ? " [has image]" : "";
    return `- postId=${post.id} ${author}: ${post.content}${imageNote}`;
  });

  const recentReplyLines = input.recentInteractions
    .filter((interaction) => interaction.type === "reply")
    .slice(0, 40)
    .map((interaction) => {
      const actor =
        interaction.actor_snapshot?.handle ??
        input.accounts.find((a) => a.id === interaction.actor_account_id)
          ?.handle ??
        "@unknown";
      return `- interactionId=${interaction.id} postId=${interaction.post_id} ${actor}: ${interaction.content ?? ""}`;
    });

  const limits = [
    `Max new posts: ${input.settings.max_generated_posts_per_refresh}`,
    `Max replies: ${input.settings.max_replies_per_refresh}`,
    `Max reposts: ${input.settings.max_reposts_per_refresh}`,
    `Max likes: ${input.settings.max_likes_per_refresh}`,
  ].join("\n");

  const invitedCharacterIds = new Set(input.settings.invited_character_ids);
  const chats = await input.twatter.listOptedInChats();
  const chatContext = await buildOptedInChatContext({
    chats,
    invitedCharacterIds,
    resolvePersonaName: (personaId) => input.twatter.resolvePersonaName(personaId),
    resolveCharacterName: (characterId) =>
      input.twatter.resolveCharacterName(characterId),
  });

  return [
    "Active participants (only these may author posts/interactions):",
    participantLines.join("\n") || "- none",
    "",
    input.personaAccount
      ? `Viewer persona (do NOT post as): ${input.personaAccount.handle} (${input.personaAccount.display_name}, entityId=${input.personaAccount.entity_id})`
      : "No active persona.",
    "",
    "Recent timeline:",
    recentLines.join("\n") || "- empty",
    "",
    "Recent reply interactions (for parentInteractionId):",
    recentReplyLines.join("\n") || "- none",
    "",
    "Opted-in chat context (chats with allow_twatter_references enabled):",
    chatContext,
    "",
    "Use @handle mentions when characters should tag each other or the viewer persona.",
    "Replies belong in interactions with type reply — never as new top-level posts.",
    "",
    "Limits:",
    limits,
  ].join("\n");
}

export function timelineRefreshMaxTokens(characterCount: number): number {
  return 4096 + Math.max(0, characterCount) * 1024;
}
