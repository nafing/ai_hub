import type { ChatMessage, ChatMessageAttachment } from "./types";

/**
 * Attachments for the active swipe.
 * Legacy messages stored a flat `attachments` list shared by the whole turn —
 * those only belong to swipe 0 so regenerates do not inherit the first image.
 */
export function activeMessageAttachments(
  message: Pick<
    ChatMessage,
    "attachments" | "attachments_by_swipe" | "swipe_id"
  >,
): ChatMessageAttachment[] {
  const bySwipe = message.attachments_by_swipe;
  if (Array.isArray(bySwipe)) {
    const list = bySwipe[message.swipe_id];
    return Array.isArray(list) ? list : [];
  }
  if (message.attachments?.length) {
    return message.swipe_id === 0 ? message.attachments : [];
  }
  return [];
}

/** Set / replace attachments for one swipe; migrates legacy flat attachments. */
export function assignSwipeAttachments(
  message: ChatMessage,
  swipeId: number,
  attachments: ChatMessageAttachment[],
): ChatMessage {
  const count = Math.max(message.swipes.length, swipeId + 1, 1);
  const next: ChatMessageAttachment[][] = [];
  for (let index = 0; index < count; index += 1) {
    if (Array.isArray(message.attachments_by_swipe?.[index])) {
      next[index] = message.attachments_by_swipe![index]!;
    } else if (
      !message.attachments_by_swipe &&
      message.attachments?.length &&
      index === 0
    ) {
      next[index] = message.attachments;
    } else {
      next[index] = [];
    }
  }
  next[swipeId] = attachments;
  return {
    ...message,
    attachments_by_swipe: next,
    attachments: undefined,
  };
}

/** Drop attachments for a removed swipe index (after swipes array is spliced). */
export function removeSwipeAttachments(
  message: ChatMessage,
  swipeId: number,
): ChatMessage {
  let next: ChatMessage = message;
  if (!message.attachments_by_swipe && message.attachments?.length) {
    if (swipeId === 0) {
      next = {
        ...message,
        attachments: undefined,
        attachments_by_swipe: undefined,
      };
    } else {
      // Removing a later swipe; migrate legacy to by_swipe then splice.
      next = removeSwipeAttachments(
        {
          ...message,
          attachments_by_swipe: [message.attachments],
          attachments: undefined,
        },
        swipeId,
      );
      // Recursive call already stripped command tags.
      return next;
    }
  } else if (message.attachments_by_swipe) {
    next = {
      ...message,
      attachments_by_swipe: message.attachments_by_swipe.filter(
        (_, index) => index !== swipeId,
      ),
      attachments: undefined,
    };
  }
  return removeSwipeCommandTags(next, swipeId);
}

function removeSwipeCommandTags(
  message: ChatMessage,
  swipeId: number,
): ChatMessage {
  if (!message.command_tags_by_swipe) return message;
  return {
    ...message,
    command_tags_by_swipe: message.command_tags_by_swipe.filter(
      (_, index) => index !== swipeId,
    ),
  };
}

/** Raw command tags for the active swipe (Peek Prompt). */
export function activeMessageCommandTags(
  message: Pick<ChatMessage, "command_tags_by_swipe" | "swipe_id">,
): string[] {
  const bySwipe = message.command_tags_by_swipe;
  if (!Array.isArray(bySwipe)) return [];
  const list = bySwipe[message.swipe_id];
  return Array.isArray(list)
    ? list.filter(
        (tag): tag is string =>
          typeof tag === "string" && Boolean(tag.trim()),
      )
    : [];
}

/** Set / replace command tags for one swipe. */
export function assignSwipeCommandTags(
  message: ChatMessage,
  swipeId: number,
  tags: string[],
): ChatMessage {
  const count = Math.max(message.swipes.length, swipeId + 1, 1);
  const next: string[][] = [];
  for (let index = 0; index < count; index += 1) {
    if (Array.isArray(message.command_tags_by_swipe?.[index])) {
      next[index] = message.command_tags_by_swipe![index]!;
    } else {
      next[index] = [];
    }
  }
  next[swipeId] = tags;
  return {
    ...message,
    command_tags_by_swipe: next,
  };
}
