import { useMemo, useRef, useState } from "react";
import {
  TWATTER_MAX_CONTENT,
  type TwatterAccount,
  type TwatterInteraction,
  type TwatterPost,
  type TwatterTimelineTab,
} from "@ai-hub/shared";
import { Button, Select, Textarea, notifications } from "@/components/ui";
import { useCreateTwatterPost } from "./queries";
import classes from "./TwatterFeed.module.css";

type ComposePostProps = {
  personaId: string | null;
  personaAccount: TwatterAccount | null;
  accounts?: TwatterAccount[];
  replyToPost?: TwatterPost | null;
  onPosted?: () => void;
  onCancelReply?: () => void;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function ComposePost({
  personaId,
  personaAccount,
  accounts = [],
  replyToPost = null,
  onPosted,
  onCancelReply,
}: ComposePostProps) {
  const createMutation = useCreateTwatterPost();
  const [content, setContent] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = TWATTER_MAX_CONTENT - content.length;
  const mentionQuery = useMemo(() => {
    const match = /(?:^|\s)@([A-Za-z0-9_]*)$/u.exec(content);
    return match?.[1]?.toLowerCase() ?? null;
  }, [content]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return accounts
      .filter((account) => account.id !== personaAccount?.id)
      .filter((account) => {
        const handle = account.handle.replace(/^@+/u, "").toLowerCase();
        const name = account.display_name.toLowerCase();
        if (!mentionQuery) return true;
        return handle.includes(mentionQuery) || name.includes(mentionQuery);
      })
      .slice(0, 6);
  }, [accounts, mentionQuery, personaAccount?.id]);

  const pollValid =
    !pollEnabled ||
    (pollQuestion.trim().length > 0 &&
      pollOptions.filter((option) => option.trim()).length >= 2);

  const canPost =
    Boolean(personaId) &&
    content.trim().length > 0 &&
    pollValid &&
    !createMutation.isPending;

  function insertMention(account: TwatterAccount) {
    const handle = account.handle.startsWith("@")
      ? account.handle
      : `@${account.handle}`;
    setContent((current) =>
      current.replace(/(?:^|\s)@([A-Za-z0-9_]*)$/u, (full, _handle) => {
        const prefix = full.startsWith(" ") ? " " : "";
        return `${prefix}${handle} `;
      }),
    );
  }

  async function handleImageChange(file: File | null) {
    if (!file) {
      setImagePreview(null);
      setImageDataUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      notifications.show({
        title: "Invalid file",
        message: "Choose a PNG or JPEG image.",
        color: "yellow",
      });
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setImagePreview(dataUrl);
    setImageDataUrl(dataUrl);
  }

  function handleSubmit() {
    if (!personaId || !canPost) return;
    createMutation.mutate(
      {
        persona_id: personaId,
        content: content.trim(),
        parent_post_id: replyToPost?.id ?? null,
        image_url: imageDataUrl,
        poll: pollEnabled
          ? {
              question: pollQuestion.trim(),
              options: pollOptions.map((option) => option.trim()).filter(Boolean),
            }
          : null,
      },
      {
        onSuccess: () => {
          setContent("");
          setImagePreview(null);
          setImageDataUrl(null);
          setPollEnabled(false);
          setPollQuestion("");
          setPollOptions(["", ""]);
          notifications.show({
            title: "Posted",
            message: "Your Twatter update is live.",
            color: "green",
          });
          onPosted?.();
        },
        onError: (error) => {
          notifications.show({
            title: "Post failed",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  }

  if (!personaId) {
    return (
      <div className={classes.composeDisabled}>
        Choose an active persona to post on Twatter.
      </div>
    );
  }

  return (
    <div className={classes.compose}>
      {replyToPost ? (
        <div className={classes.replyBanner}>
          <span>
            Replying to{" "}
            {replyToPost.author_snapshot?.handle ??
              personaAccount?.handle ??
              "post"}
          </span>
          {onCancelReply ? (
            <button
              type="button"
              className={classes.replyCancel}
              onClick={onCancelReply}
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={classes.composeInputWrap}>
        <Textarea
          value={content}
          onChange={(event) =>
            setContent(event.target.value.slice(0, TWATTER_MAX_CONTENT))
          }
          placeholder="What's simmering? Use @handle to mention someone."
          rows={3}
          className={classes.composeInput}
        />
        {mentionSuggestions.length > 0 ? (
          <div className={classes.mentionSuggestions}>
            {mentionSuggestions.map((account) => (
              <button
                key={account.id}
                type="button"
                className={classes.mentionSuggestion}
                onClick={() => insertMention(account)}
              >
                <span>{account.display_name}</span>
                <span>{account.handle}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {imagePreview ? (
        <div className={classes.composeImagePreview}>
          <img src={imagePreview} alt="" />
          <button
            type="button"
            className={classes.composeImageRemove}
            onClick={() => {
              setImagePreview(null);
              setImageDataUrl(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            Remove image
          </button>
        </div>
      ) : null}

      {pollEnabled ? (
        <div className={classes.pollComposer}>
          <input
            type="text"
            className={classes.pollQuestionInput}
            value={pollQuestion}
            onChange={(event) => setPollQuestion(event.target.value)}
            placeholder="Poll question"
          />
          {pollOptions.map((option, index) => (
            <input
              key={index}
              type="text"
              className={classes.pollOptionInput}
              value={option}
              onChange={(event) =>
                setPollOptions((current) =>
                  current.map((value, optionIndex) =>
                    optionIndex === index ? event.target.value : value,
                  ),
                )
              }
              placeholder={`Option ${index + 1}`}
            />
          ))}
          {pollOptions.length < 4 ? (
            <Button
              type="button"
              variant="default"
              onClick={() => setPollOptions((current) => [...current, ""])}
            >
              Add option
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className={classes.composeFooter}>
        <div className={classes.composeTools}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className={classes.hiddenFileInput}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void handleImageChange(file);
            }}
          />
          <Button
            type="button"
            variant="default"
            onClick={() => fileInputRef.current?.click()}
          >
            Image
          </Button>
          <Button
            type="button"
            variant={pollEnabled ? "primary" : "default"}
            onClick={() => setPollEnabled((current) => !current)}
          >
            Poll
          </Button>
          <span
            className={
              remaining < 40 ? classes.charCountWarn : classes.charCount
            }
          >
            {remaining}
          </span>
        </div>
        <Button type="button" variant="primary" disabled={!canPost} onClick={handleSubmit}>
          {createMutation.isPending ? "Posting…" : "Post"}
        </Button>
      </div>
    </div>
  );
}

type TwatterTimelineProps = {
  tab: TwatterTimelineTab;
  personaId: string | null;
  personaAccount: TwatterAccount | null;
  accounts: TwatterAccount[];
  posts: TwatterPost[];
  interactions: TwatterInteraction[];
};

export function useFilteredTwatterPosts({
  tab,
  personaAccount,
  posts,
}: Pick<TwatterTimelineProps, "tab" | "personaAccount" | "posts">) {
  return useMemo(() => {
    const rootPosts = posts.filter((post) => !post.parent_post_id);
    if (tab === "main") return rootPosts;
    const following = new Set(
      personaAccount?.settings.social.following_account_ids ?? [],
    );
    return rootPosts.filter((post) => following.has(post.author_account_id));
  }, [tab, personaAccount, posts]);
}

export function PersonaPicker({
  personas,
  value,
  onChange,
}: {
  personas: Array<{ id: string; name: string }>;
  value: string | null;
  onChange: (personaId: string) => void;
}) {
  return (
    <Select
      data={personas.map((persona) => ({
        value: persona.id,
        label: persona.name || "Untitled persona",
      }))}
      value={value ?? ""}
      onChange={onChange}
      placeholder="Active persona"
    />
  );
}
