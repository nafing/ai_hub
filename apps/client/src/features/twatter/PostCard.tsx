import { useMemo, useState } from "react";
import {
  IconHeart,
  IconHeartFilled,
  IconMessageCircle,
  IconRepeat,
  IconTrash,
} from "@tabler/icons-react";
import {
  parseTwatterPollFromMetadata,
  type TwatterAccount,
  type TwatterInteraction,
  type TwatterPost,
} from "@ai-hub/shared";
import { ActionIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
import { personaAvatarSrc } from "@/features/personas/avatar-url";
import { twatterPostImageSrc } from "./image-url";
import { TwatterMentionText } from "./TwatterMentionText";
import {
  useCreateTwatterInteraction,
  useDeleteTwatterPost,
  useRemoveTwatterInteraction,
} from "./queries";
import classes from "./TwatterFeed.module.css";

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type PostCardProps = {
  post: TwatterPost;
  accounts: TwatterAccount[];
  interactions: TwatterInteraction[];
  personaId: string | null;
  personaAccount: TwatterAccount | null;
  onReply?: (post: TwatterPost) => void;
  onMentionClick?: (accountId: string) => void;
  onAuthorClick?: (accountId: string) => void;
};

export function PostCard({
  post,
  accounts,
  interactions,
  personaId,
  personaAccount,
  onReply,
  onMentionClick,
  onAuthorClick,
}: PostCardProps) {
  const createInteraction = useCreateTwatterInteraction();
  const removeInteraction = useRemoveTwatterInteraction();
  const deleteMutation = useDeleteTwatterPost();

  const postInteractions = useMemo(
    () => interactions.filter((item) => item.post_id === post.id),
    [interactions, post.id],
  );

  const author =
    post.author_snapshot ??
    accounts.find((account) => account.id === post.author_account_id);

  const avatarSrc = useMemo(() => {
    const base = String(api.defaults.baseURL);
    if (!author) return null;
    if (author.kind === "persona") {
      const account = accounts.find((item) => item.id === author.id);
      return personaAvatarSrc(account?.avatar, base);
    }
    if (author.kind === "character") {
      const account = accounts.find((item) => item.id === author.id);
      return characterAvatarSrc(account?.avatar, base);
    }
    return null;
  }, [author, accounts]);

  const imageSrc = twatterPostImageSrc(post.image_url, String(api.defaults.baseURL));
  const poll = parseTwatterPollFromMetadata(post.metadata);
  const votes = postInteractions.filter((item) => item.type === "vote");
  const personaVote = personaAccount
    ? votes.find((item) => item.actor_account_id === personaAccount.id)
    : null;

  const initial = (author?.display_name || "?").slice(0, 1).toUpperCase();
  const likes = postInteractions.filter((item) => item.type === "like");
  const reposts = postInteractions.filter((item) => item.type === "repost");
  const replies = postInteractions.filter((item) => item.type === "reply");

  const personaLiked = personaAccount
    ? likes.some((item) => item.actor_account_id === personaAccount.id)
    : false;
  const personaReposted = personaAccount
    ? reposts.some((item) => item.actor_account_id === personaAccount.id)
    : false;
  const isOwnPost = personaAccount?.id === post.author_account_id;

  function toggle(type: "like" | "repost") {
    if (!personaId) return;
    if (
      (type === "like" && personaLiked) ||
      (type === "repost" && personaReposted)
    ) {
      removeInteraction.mutate({
        postId: post.id,
        input: { persona_id: personaId, type },
      });
      return;
    }
    createInteraction.mutate({
      postId: post.id,
      input: { persona_id: personaId, type },
    });
  }

  function vote(optionId: string) {
    if (!personaId || personaVote) return;
    createInteraction.mutate({
      postId: post.id,
      input: {
        persona_id: personaId,
        type: "vote",
        poll_option_id: optionId,
      },
    });
  }

  const totalVotes = votes.length;

  return (
    <article className={classes.post}>
      <div className={classes.postMain}>
        <button
          type="button"
          className={classes.avatarButton}
          onClick={() => author && onAuthorClick?.(author.id)}
          disabled={!author || !onAuthorClick}
        >
          {avatarSrc ? (
            <img
              className={classes.avatar}
              src={avatarSrc}
              alt=""
              width={40}
              height={40}
            />
          ) : (
            <span className={classes.avatarFallback} aria-hidden>
              {initial}
            </span>
          )}
        </button>

        <div className={classes.postBody}>
          <header className={classes.postHeader}>
            <button
              type="button"
              className={classes.postNameButton}
              onClick={() => author && onAuthorClick?.(author.id)}
              disabled={!author || !onAuthorClick}
            >
              <span className={classes.postName}>
                {author?.display_name || "Anonymous"}
              </span>
            </button>
            <span className={classes.postHandle}>{author?.handle}</span>
            <span className={classes.postDot} aria-hidden>
              ·
            </span>
            <time className={classes.postTime} dateTime={post.created_at}>
              {formatRelativeTime(post.created_at)}
            </time>
          </header>

          <p className={classes.postContent}>
            <TwatterMentionText
              text={post.content}
              accounts={accounts}
              onMentionClick={onMentionClick}
            />
          </p>

          {imageSrc ? (
            <img className={classes.postImage} src={imageSrc} alt="" />
          ) : null}

          {poll ? (
            <div className={classes.pollBlock}>
              <p className={classes.pollQuestion}>{poll.question}</p>
              {poll.options.map((option) => {
                const optionVotes = votes.filter(
                  (voteItem) => voteItem.content === option.id,
                ).length;
                const percent =
                  totalVotes > 0
                    ? Math.round((optionVotes / totalVotes) * 100)
                    : 0;
                const selected = personaVote?.content === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={
                      selected ? classes.pollOptionSelected : classes.pollOption
                    }
                    disabled={!personaId || Boolean(personaVote)}
                    onClick={() => vote(option.id)}
                  >
                    <span className={classes.pollOptionLabel}>{option.label}</span>
                    {totalVotes > 0 ? (
                      <span className={classes.pollOptionMeta}>
                        {percent}% · {optionVotes}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              <span className={classes.pollTotal}>{totalVotes} votes</span>
            </div>
          ) : null}

          {replies.length > 0 ? (
            <div className={classes.replyList}>
              {replies.map((reply) => (
                <div key={reply.id} className={classes.replyCard}>
                  <span className={classes.replyHandle}>
                    {reply.actor_snapshot?.handle ?? "@unknown"}
                  </span>
                  <span>
                    <TwatterMentionText
                      text={reply.content ?? ""}
                      accounts={accounts}
                      onMentionClick={onMentionClick}
                    />
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className={classes.postActions}>
            <button
              type="button"
              className={classes.actionBtn}
              disabled={!personaId}
              onClick={() => onReply?.(post)}
              aria-label="Reply"
            >
              <IconMessageCircle size={17} />
              {replies.length > 0 ? (
                <span className={classes.actionCount}>{replies.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              className={classes.actionBtn}
              disabled={!personaId}
              onClick={() => toggle("repost")}
              aria-label="Repost"
            >
              <IconRepeat size={17} />
              {reposts.length > 0 ? (
                <span className={classes.actionCount}>{reposts.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              className={`${classes.actionBtn} ${personaLiked ? classes.actionLiked : classes.actionLike}`}
              disabled={!personaId}
              onClick={() => toggle("like")}
              aria-label="Like"
            >
              {personaLiked ? <IconHeartFilled size={17} /> : <IconHeart size={17} />}
              {likes.length > 0 ? (
                <span className={classes.actionCount}>{likes.length}</span>
              ) : null}
            </button>
            {isOwnPost ? (
              <ActionIcon
                type="button"
                variant="ghostDanger"
                aria-label="Delete post"
                disabled={deleteMutation.isPending || !personaId}
                onClick={() =>
                  personaId &&
                  deleteMutation.mutate({ id: post.id, personaId })
                }
                className={classes.deleteBtn}
              >
                <IconTrash size={15} />
              </ActionIcon>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
