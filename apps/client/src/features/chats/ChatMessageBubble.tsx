import { useState } from "react";
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Collapse,
  Group,
  Stack,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
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
import {
  activeMessageText,
  type ChatMessage,
} from "@ai-hub/shared";
import { formatChatText } from "./formatChatText";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  displayText: string;
  /** Persona / character display name shown next to the timestamp. */
  speakerName?: string | null;
  avatarUrl?: string | null;
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
  avatarUrl,
  isStreaming = false,
  disabled = false,
  onSwipe,
  onEdit,
  onRegenerate,
  onPeekPrompt,
  onDelete,
}: ChatMessageBubbleProps) {
  const [thinkingOpen, { toggle: toggleThinking }] = useDisclosure(false);
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
    <Box
      style={{
        alignSelf: "stretch",
        width: "100%",
      }}
    >
      <Stack
        gap="sm"
        p="md"
        style={{
          borderRadius: 16,
          background: "var(--mantine-color-dark-7, var(--mantine-color-body))",
          border: "1px solid var(--mantine-color-dark-5, var(--mantine-color-default-border))",
        }}
      >
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <Avatar
            src={avatarUrl || undefined}
            radius="xl"
            size={40}
            color={isUser ? "blue" : "violet"}
          >
            {name.slice(0, 1).toUpperCase()}
          </Avatar>
          <Group gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }} pt={4}>
            <Text size="sm" fw={700} lineClamp={1}>
              {name}
            </Text>
            {timeLabel ? (
              <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                {timeLabel}
              </Text>
            ) : null}
          </Group>
        </Group>

        {message.thinking ? (
          <Box>
            <UnstyledButton onClick={toggleThinking}>
              <Group gap={4}>
                {thinkingOpen ? (
                  <IconChevronUp size={14} />
                ) : (
                  <IconChevronDown size={14} />
                )}
                <Text size="xs" c="dimmed">
                  Thinking
                </Text>
              </Group>
            </UnstyledButton>
            <Collapse expanded={thinkingOpen}>
              <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
                {message.thinking}
              </Text>
            </Collapse>
          </Box>
        ) : null}

        {editing ? (
          <Stack gap="xs">
            <Textarea
              autosize
              minRows={3}
              maxRows={16}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              autoFocus
            />
            <Group gap="xs" justify="flex-end">
              <Button
                size="xs"
                variant="default"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                onClick={saveEdit}
                disabled={!draft.trim()}
              >
                Save
              </Button>
            </Group>
          </Stack>
        ) : (
          <Text size="sm" style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
            {formatChatText(bodyText)}
            {isStreaming ? "▍" : ""}
          </Text>
        )}

        {canSwipe || showActions ? (
          <Group gap={4} wrap="nowrap">
            {onEdit ? (
              <Tooltip label="Edit">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Edit"
                  disabled={disabled}
                  onClick={startEdit}
                >
                  <IconPencil size={16} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            {onRegenerate ? (
              <Tooltip label="Regenerate">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Regenerate"
                  disabled={disabled}
                  onClick={onRegenerate}
                >
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            {onPeekPrompt ? (
              <Tooltip label="Peek prompt">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Peek prompt"
                  disabled={disabled}
                  onClick={onPeekPrompt}
                >
                  <IconEye size={16} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            {onDelete ? (
              <Tooltip label="Delete">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Delete"
                  disabled={disabled}
                  onClick={onDelete}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            {canSwipe ? (
              <>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Previous swipe"
                  disabled={message.swipe_id <= 0 || disabled}
                  onClick={() => onSwipe?.(message.swipe_id - 1)}
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                  {message.swipe_id + 1} / {swipeCount}
                </Text>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Next swipe"
                  disabled={message.swipe_id >= swipeCount - 1 || disabled}
                  onClick={() => onSwipe?.(message.swipe_id + 1)}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </>
            ) : null}
          </Group>
        ) : null}
      </Stack>
    </Box>
  );
}
