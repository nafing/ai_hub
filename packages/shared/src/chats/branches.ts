import type { ChatMessage } from "./types";

type RawChatMessage = ChatMessage & {
  parent_id?: string | null;
  parent_swipe_id?: number | null;
};

/** Fill missing parent links for legacy linear chats. */
export function normalizeChatMessages(
  messages: RawChatMessage[],
): ChatMessage[] {
  return messages.map((message, index, arr) => {
    if (message.parent_id !== undefined) {
      return {
        ...message,
        parent_id: message.parent_id,
        parent_swipe_id:
          message.parent_id == null
            ? null
            : (message.parent_swipe_id ?? 0),
      };
    }
    if (index === 0) {
      return { ...message, parent_id: null, parent_swipe_id: null };
    }
    const parent = arr[index - 1]!;
    return {
      ...message,
      parent_id: parent.id,
      parent_swipe_id: parent.swipe_id,
    };
  });
}

/** Parent fields for appending a message to the active branch tip. */
export function branchParentOf(
  messages: ChatMessage[],
): Pick<ChatMessage, "parent_id" | "parent_swipe_id"> {
  const visible = visibleChatMessages(messages);
  const last = visible[visible.length - 1];
  if (!last) return { parent_id: null, parent_swipe_id: null };
  return { parent_id: last.id, parent_swipe_id: last.swipe_id };
}

/**
 * Active swipe branch from the root: follow each message's current
 * `swipe_id` to the child created under that swipe.
 */
export function visibleChatMessages(messages: ChatMessage[]): ChatMessage[] {
  const normalized = normalizeChatMessages(messages);
  if (normalized.length === 0) return [];

  const childrenByKey = new Map<string, ChatMessage[]>();
  for (const message of normalized) {
    if (message.parent_id == null) continue;
    const key = branchChildKey(message.parent_id, message.parent_swipe_id ?? 0);
    const list = childrenByKey.get(key) ?? [];
    list.push(message);
    childrenByKey.set(key, list);
  }

  const roots = normalized.filter((message) => message.parent_id == null);
  let current: ChatMessage | undefined = roots[0] ?? normalized[0];
  const result: ChatMessage[] = [];
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    result.push(current);
    const children: ChatMessage[] =
      childrenByKey.get(branchChildKey(current.id, current.swipe_id)) ?? [];
    current = children[0];
  }

  return result;
}

/** Ancestors of a message along its stored parent links (excludes itself). */
export function ancestorChatMessages(
  messages: ChatMessage[],
  messageId: string,
): ChatMessage[] {
  const normalized = normalizeChatMessages(messages);
  const byId = new Map(normalized.map((message) => [message.id, message]));
  const target = byId.get(messageId);
  if (!target) return [];

  const chain: ChatMessage[] = [];
  let current: ChatMessage | undefined = target;
  const seen = new Set<string>();
  while (current?.parent_id && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }
  return chain.reverse();
}

/** Visible messages up to and including `messageId` (for regenerate UI). */
export function visibleChatMessagesThrough(
  messages: ChatMessage[],
  messageId: string,
): ChatMessage[] {
  const visible = visibleChatMessages(messages);
  const index = visible.findIndex((message) => message.id === messageId);
  if (index === -1) return visible;
  return visible.slice(0, index + 1);
}

/** Message id + all descendants (any swipe). */
export function chatMessageSubtreeIds(
  messages: ChatMessage[],
  rootId: string,
): Set<string> {
  const normalized = normalizeChatMessages(messages);
  const childrenByParent = new Map<string, string[]>();
  for (const message of normalized) {
    if (message.parent_id == null) continue;
    const list = childrenByParent.get(message.parent_id) ?? [];
    list.push(message.id);
    childrenByParent.set(message.parent_id, list);
  }

  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const childId of childrenByParent.get(id) ?? []) {
      stack.push(childId);
    }
  }
  return out;
}

/**
 * Drop a swipe and every message that continued from it.
 * Remaps later `parent_swipe_id` values on siblings of the removed swipe.
 */
export function removeChatMessageSwipe(
  messages: ChatMessage[],
  messageId: string,
  swipeId: number,
): ChatMessage[] {
  const normalized = normalizeChatMessages(messages);
  const target = normalized.find((message) => message.id === messageId);
  if (!target) return normalized;
  if (swipeId < 0 || swipeId >= target.swipes.length) return normalized;

  const dropIds = new Set<string>();
  for (const message of normalized) {
    if (
      message.parent_id === messageId &&
      (message.parent_swipe_id ?? 0) === swipeId
    ) {
      for (const id of chatMessageSubtreeIds(normalized, message.id)) {
        dropIds.add(id);
      }
    }
  }

  return normalized
    .filter((message) => !dropIds.has(message.id))
    .map((message) => {
      if (message.id === messageId) {
        const swipes = message.swipes.filter((_, index) => index !== swipeId);
        const nextSwipeId = Math.min(
          message.swipe_id > swipeId
            ? message.swipe_id - 1
            : message.swipe_id,
          Math.max(swipes.length - 1, 0),
        );
        return {
          ...message,
          swipes,
          swipe_id: Math.max(0, nextSwipeId),
        };
      }
      if (
        message.parent_id === messageId &&
        (message.parent_swipe_id ?? 0) > swipeId
      ) {
        return {
          ...message,
          parent_swipe_id: (message.parent_swipe_id ?? 0) - 1,
        };
      }
      return message;
    });
}

/** Remove a message and every descendant on any swipe. */
export function removeChatMessageSubtree(
  messages: ChatMessage[],
  messageId: string,
): ChatMessage[] {
  const normalized = normalizeChatMessages(messages);
  const dropIds = chatMessageSubtreeIds(normalized, messageId);
  return normalized.filter((message) => !dropIds.has(message.id));
}

function branchChildKey(parentId: string, parentSwipeId: number): string {
  return `${parentId}:${parentSwipeId}`;
}
