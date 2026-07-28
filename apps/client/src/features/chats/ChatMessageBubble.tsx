import { useState } from "react";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconEye,
  IconPencil,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { activeMessageText, type ChatMessage } from "@ai-hub/shared";
import { ActionIcon, Button, Textarea, RuntimeText } from "@/components/ui";
import { formatChatText } from "./formatChatText";
import classes from "./ChatMessageBubble.module.css";
import type { PresetVariableValues } from "@ai-hub/shared";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  displayText: string;
  /** Persona / character display name shown next to the timestamp. */
  speakerName?: string | null;
  /** Optional CSS color for the speaker name. */
  nameColor?: string | null;
  /** Optional CSS color for dialogue/body text. */
  dialogueColor?: string | null;
  avatarUrl?: string | null;
  /** Substitutes `{{char}}` / `{{user}}` (and other macros) in the body. */
  macroValues?: PresetVariableValues;
  isStreaming?: boolean;
  disabled?: boolean;
  onSwipe?: (swipeId: number) => void;
  onEdit?: (content: string) => void;
  onRegenerate?: () => void;
  onPeekPrompt?: () => void;
  onDelete?: () => void;
};

function formatMessageTime(iso: string): string {
  const date = dayjs(iso);
  if (!date.isValid()) return "";
  const now = dayjs();
  if (date.isSame(now, "day")) return date.format("HH:mm");
  if (date.isSame(now, "year")) return date.format("D MMM, HH:mm");
  return date.format("D MMM YYYY, HH:mm");
}

export function ChatMessageBubble({
  message,
  displayText,
  speakerName,
  nameColor,
  dialogueColor,
  avatarUrl,
  macroValues,
  isStreaming = false,
  disabled = false,
  onSwipe,
  onEdit,
  onRegenerate,
  onPeekPrompt,
  onDelete,
}: ChatMessageBubbleProps) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const isUser = message.role === "user";
  const swipeCount = message.swipes.length;
  const canSwipe = Boolean(onSwipe) && swipeCount > 1 && !isStreaming;
  const showActions = !isStreaming && !editing;

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
    <div
      className={[
        classes.root,
        message.hidden_from_prompt ? classes.rootHiddenFromPrompt : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[classes.card, isUser ? classes.cardUser : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={classes.header}>
          <span
            className={`${classes.avatar}${isUser ? ` ${classes.avatarUser}` : ""}`}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              name.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className={classes.meta}>
            <p
              className={classes.name}
              style={nameColor ? { color: nameColor } : undefined}
            >
              {name}
            </p>
            {timeLabel ? <p className={classes.time}>{timeLabel}</p> : null}
          </div>
        </div>

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

        {editing ? (
          <div className={classes.editStack}>
            <Textarea
              className={classes.textarea}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              autoFocus
            />
            <div className={classes.editActions}>
              <Button variant="default" type="button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" type="button"
                onClick={saveEdit}
                disabled={!draft.trim()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p
            className={classes.body}
            style={dialogueColor ? { color: dialogueColor } : undefined}
          >
            <RuntimeText
              values={macroValues}
              highlightUnresolved={false}
              format={formatChatText}
            >
              {bodyText}
            </RuntimeText>
            {isStreaming ? "▍" : ""}
          </p>
        )}

        {message.reactions && message.reactions.length > 0 ? (
          <div className={classes.reactions} aria-label="Reactions">
            {message.reactions.map((reaction, index) => (
              <span
                key={`${reaction.emoji}-${reaction.created_at}-${index}`}
                className={classes.reactionChip}
                title={reaction.character_id ?? undefined}
              >
                {reaction.emoji}
              </span>
            ))}
          </div>
        ) : null}

        {canSwipe || showActions ? (
          <div className={classes.actions}>
            {onEdit ? (
              <ActionIcon type="button" variant="ghost" title="Edit" aria-label="Edit" disabled={disabled} onClick={startEdit}>
                <IconPencil size={16} />
              </ActionIcon>
            ) : null}
            {onRegenerate ? (
              <ActionIcon type="button" variant="ghost" title="Regenerate" aria-label="Regenerate" disabled={disabled} onClick={onRegenerate}>
                <IconRefresh size={16} />
              </ActionIcon>
            ) : null}
            {onPeekPrompt ? (
              <ActionIcon type="button" variant="ghost" title="Peek prompt" aria-label="Peek prompt" disabled={disabled} onClick={onPeekPrompt}>
                <IconEye size={16} />
              </ActionIcon>
            ) : null}
            {onDelete ? (
              <ActionIcon type="button" variant="ghost" title="Delete" aria-label="Delete" disabled={disabled} onClick={onDelete}>
                <IconTrash size={16} />
              </ActionIcon>
            ) : null}
            {canSwipe ? (
              <>
                <ActionIcon type="button" variant="ghost" aria-label="Previous swipe" disabled={message.swipe_id <= 0 || disabled} onClick={() => onSwipe?.(message.swipe_id - 1)}
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <span className={classes.swipeCount}>
                  {message.swipe_id + 1} / {swipeCount}
                </span>
                <ActionIcon type="button" variant="ghost" aria-label="Next swipe" disabled={message.swipe_id>= swipeCount - 1 || disabled}
                  onClick={() => onSwipe?.(message.swipe_id + 1)}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
