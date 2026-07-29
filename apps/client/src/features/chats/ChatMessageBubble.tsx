import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconEye,
  IconFile,
  IconMoodSmile,
  IconPencil,
  IconPhoto,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import {
  activeMessageAttachments,
  activeMessageText,
  type ChatMessage,
  type PresetVariableValues,
} from "@ai-hub/shared";
import { ActionIcon, Button, Textarea, RuntimeText } from "@/components/ui";
import { api } from "@/lib/api";
import {
  chatAttachmentSrc,
  formatAttachmentSize,
} from "./attachment-url";
import { formatChatText } from "./formatChatText";
import { useChatTextFormat } from "./useChatTextFormat";
import { nameColorStyle } from "@/features/characters/characterColors";
import classes from "./ChatMessageBubble.module.css";

const QUICK_REACTIONS = [
  "😂",
  "❤️",
  "👍",
  "😮",
  "😢",
  "🔥",
  "👀",
  "💀",
  "✨",
  "🙏",
  "💯",
  "🫡",
] as const;

type ChatMessageBubbleProps = {
  message: ChatMessage;
  displayText: string;
  /** Persona / character display name shown next to the timestamp. */
  speakerName?: string | null;
  /** Optional CSS color or gradient for the speaker name. */
  nameColor?: string | null;
  /** Optional CSS color for quoted dialogue spans. */
  dialogueColor?: string | null;
  /** Optional CSS background for the message bubble. */
  messageBoxColor?: string | null;
  /** Stronger fill / blur when the chat has a stage background image. */
  elevated?: boolean;
  avatarUrl?: string | null;
  /** Substitutes `{{char}}` / `{{user}}` (and other macros) in the body. */
  macroValues?: PresetVariableValues;
  isStreaming?: boolean;
  disabled?: boolean;
  onSwipe?: (swipeId: number) => void;
  onEdit?: (content: string) => void;
  onRegenerate?: () => void;
  onGenerateImage?: () => void;
  onPeekPrompt?: () => void;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
};

function formatMessageTime(iso: string): string {
  const date = dayjs(iso);
  if (!date.isValid()) return "";
  const now = dayjs();
  if (date.isSame(now, "day")) return date.format("HH:mm");
  if (date.isSame(now, "year")) return date.format("D MMM, HH:mm");
  return date.format("D MMM YYYY, HH:mm");
}

function MessageReactPicker({
  disabled,
  onReact,
}: {
  disabled?: boolean;
  onReact: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(emoji: string) {
    onReact(emoji);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={classes.reactMenu}>
      <ActionIcon
        type="button"
        variant="ghost"
        size="sm"
        title="React"
        aria-label="React"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <IconMoodSmile size={14} />
      </ActionIcon>
      {open ? (
        <div className={classes.emojiPicker} role="menu">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              className={classes.emojiOption}
              aria-label={`React with ${emoji}`}
              disabled={disabled}
              onClick={() => pick(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChatMessageBubble({
  message,
  displayText,
  speakerName,
  nameColor,
  dialogueColor,
  messageBoxColor,
  elevated = false,
  avatarUrl,
  macroValues,
  isStreaming = false,
  disabled = false,
  onSwipe,
  onEdit,
  onRegenerate,
  onGenerateImage,
  onPeekPrompt,
  onDelete,
  onReact,
}: ChatMessageBubbleProps) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const isUser = message.role === "user";
  const textFormat = useChatTextFormat(isUser ? null : dialogueColor);
  const swipeCount = message.swipes.length;
  const canSwipe = Boolean(onSwipe) && swipeCount > 1 && !isStreaming;
  const showActions = !isStreaming && !editing;
  const hasToolbar = canSwipe || showActions;

  const fallbackName =
    message.role === "user"
      ? "You"
      : message.role === "system"
        ? "System"
        : "Assistant";
  const name = speakerName?.trim() || fallbackName;
  const timeLabel = formatMessageTime(message.created_at);
  const bodyText =
    displayText || (isStreaming ? "…" : activeMessageText(message));
  const apiBase = String(api.defaults.baseURL ?? "/v1/api");
  const attachments = activeMessageAttachments(message);
  const tint = !isUser ? messageBoxColor?.trim() : "";
  const cardStyle = tint
    ? ({ "--bubble-tint": tint } as CSSProperties)
    : undefined;

  function startEdit() {
    setDraft(activeMessageText(message));
    setEditing(true);
  }

  function saveEdit() {
    const next = draft.trim();
    if (!next) return;
    onEdit?.(next);
    setEditing(false);
  }

  return (
    <article
      className={[
        classes.root,
        isUser ? classes.rootUser : classes.rootAssistant,
        message.hidden_from_prompt ? classes.rootHiddenFromPrompt : "",
        elevated ? classes.rootElevated : "",
        isStreaming ? classes.rootStreaming : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          classes.card,
          tint ? classes.cardTinted : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={cardStyle}
      >
        <div className={classes.layout}>
          <div className={classes.top}>
            <span
              className={[
                classes.avatar,
                isUser ? classes.avatarUser : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                name.slice(0, 1).toUpperCase()
              )}
            </span>
            <header className={classes.header}>
              <div className={classes.meta}>
                <p
                  className={classes.name}
                  style={!isUser ? nameColorStyle(nameColor) : undefined}
                >
                  {name}
                </p>
                {timeLabel ? (
                  <time className={classes.time} dateTime={message.created_at}>
                    {timeLabel}
                  </time>
                ) : null}
                {isStreaming ? (
                  <span className={classes.streamingBadge}>Writing</span>
                ) : null}
              </div>
            </header>
          </div>

          <div className={classes.main}>
            {message.thinking ? (
              <div className={classes.thinking}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={classes.thinkingToggle}
                  onClick={() => setThinkingOpen((open) => !open)}
                  leftSection={
                    thinkingOpen ? (
                      <IconChevronUp size={14} />
                    ) : (
                      <IconChevronDown size={14} />
                    )
                  }
                >
                  Thinking
                </Button>
                {thinkingOpen ? (
                  <p className={classes.thinkingBody}>{message.thinking}</p>
                ) : null}
              </div>
            ) : null}

            {attachments.length > 0 ? (
              <div className={classes.attachments} aria-label="Attachments">
                {attachments.map((attachment) => {
                  const src = chatAttachmentSrc(attachment.url, apiBase);
                  if (attachment.kind === "image" && src) {
                    return (
                      <a
                        key={attachment.id}
                        className={classes.attachmentImageLink}
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          className={classes.attachmentImage}
                          src={src}
                          alt={attachment.name || "Attached image"}
                        />
                      </a>
                    );
                  }
                  return (
                    <a
                      key={attachment.id}
                      className={classes.attachmentFile}
                      href={src ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <IconFile size={16} aria-hidden />
                      <span className={classes.attachmentFileMeta}>
                        <span className={classes.attachmentFileName}>
                          {attachment.name || "File"}
                        </span>
                        {formatAttachmentSize(attachment.size) ? (
                          <span className={classes.attachmentFileSize}>
                            {formatAttachmentSize(attachment.size)}
                          </span>
                        ) : null}
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : null}

            {editing ? (
              <div className={classes.editStack}>
                <Textarea
                  className={classes.textarea}
                  value={draft}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  autoFocus
                />
                <div className={classes.editActions}>
                  <Button
                    variant="default"
                    type="button"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={saveEdit}
                    disabled={!draft.trim()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : bodyText.trim() || isStreaming ? (
              <div className={classes.body}>
                <RuntimeText
                  values={macroValues}
                  highlightUnresolved={false}
                  format={(resolved) => formatChatText(resolved, textFormat)}
                >
                  {bodyText}
                </RuntimeText>
                {isStreaming ? (
                  <span className={classes.caret} aria-hidden />
                ) : null}
              </div>
            ) : null}

            {message.reactions && message.reactions.length > 0 ? (
              <div className={classes.reactions} aria-label="Reactions">
                {message.reactions.map((reaction, index) => (
                  <span
                    key={`${reaction.emoji}-${reaction.created_at}-${index}`}
                    className={classes.reactionChip}
                    title={reaction.character_id ? undefined : "You"}
                  >
                    {reaction.emoji}
                  </span>
                ))}
              </div>
            ) : null}

            {hasToolbar ? (
              <div className={classes.toolbar}>
                {showActions && onReact ? (
                  <MessageReactPicker disabled={disabled} onReact={onReact} />
                ) : null}
                {showActions && onEdit ? (
                  <ActionIcon
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Edit"
                    aria-label="Edit"
                    disabled={disabled}
                    onClick={startEdit}
                  >
                    <IconPencil size={14} />
                  </ActionIcon>
                ) : null}
                {showActions && onRegenerate ? (
                  <ActionIcon
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Regenerate"
                    aria-label="Regenerate"
                    disabled={disabled}
                    onClick={onRegenerate}
                  >
                    <IconRefresh size={14} />
                  </ActionIcon>
                ) : null}
                {showActions && onGenerateImage ? (
                  <ActionIcon
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Generate image"
                    aria-label="Generate image"
                    disabled={disabled}
                    onClick={onGenerateImage}
                  >
                    <IconPhoto size={14} />
                  </ActionIcon>
                ) : null}
                {showActions && onPeekPrompt ? (
                  <ActionIcon
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Peek prompt"
                    aria-label="Peek prompt"
                    disabled={disabled}
                    onClick={onPeekPrompt}
                  >
                    <IconEye size={14} />
                  </ActionIcon>
                ) : null}
                {showActions && onDelete ? (
                  <ActionIcon
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Delete"
                    aria-label="Delete"
                    disabled={disabled}
                    onClick={onDelete}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                ) : null}
                {canSwipe ? (
                  <div className={classes.swipeGroup}>
                    <ActionIcon
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Previous swipe"
                      disabled={message.swipe_id <= 0 || disabled}
                      onClick={() => onSwipe?.(message.swipe_id - 1)}
                    >
                      <IconChevronLeft size={14} />
                    </ActionIcon>
                    <span className={classes.swipeCount}>
                      {message.swipe_id + 1}/{swipeCount}
                    </span>
                    <ActionIcon
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Next swipe"
                      disabled={
                        message.swipe_id >= swipeCount - 1 || disabled
                      }
                      onClick={() => onSwipe?.(message.swipe_id + 1)}
                    >
                      <IconChevronRight size={14} />
                    </ActionIcon>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
