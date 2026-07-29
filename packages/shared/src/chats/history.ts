import type { ChatMessage } from "./types";
import { activeMessageAttachments } from "./attachments";

/** Active swipe text for a persisted chat message. */
export function activeMessageText(message: ChatMessage): string {
  const swipe = message.swipes[message.swipe_id];
  if (typeof swipe === "string") return swipe;
  return message.swipes[0] ?? "";
}

/**
 * Format messages for the `chat_history` preset marker.
 * Uses User / Char / System labels (SillyTavern-style).
 * When `nameByCharacterId` is set, each assistant turn uses that character's name.
 */
export function formatChatHistoryMarker(
  messages: ChatMessage[],
  options: {
    charName?: string;
    userName?: string;
    nameByCharacterId?: Map<string, string> | Record<string, string>;
    /**
     * When false, assistant lines use raw text (Marinara individual mode default).
     * User lines still use the persona label.
     */
    prefixSpeakerNames?: boolean;
    /** Conversation DMs: prefix lines with [HH:mm] / [DD.MM.YYYY] for model time awareness. */
    messengerTimestamps?: boolean;
    /** IANA timezone for messenger timestamps (falls back to local). */
    timezone?: string | null;
  } = {},
): string {
  const userLabel = options.userName?.trim() || "User";
  const charLabel = options.charName?.trim() || "Char";
  const prefixSpeakerNames = options.prefixSpeakerNames !== false;
  const messengerTimestamps = options.messengerTimestamps === true;
  const nameMap =
    options.nameByCharacterId instanceof Map
      ? options.nameByCharacterId
      : options.nameByCharacterId
        ? new Map(Object.entries(options.nameByCharacterId))
        : null;

  let previousDayKey: string | null = null;
  const lines: string[] = [];

  for (const message of messages) {
    const text = activeMessageText(message).trim();
    const attachmentNote = formatAttachmentNote(message);
    const body = [text, attachmentNote].filter(Boolean).join("\n");
    if (!body) continue;

    let line: string;
    if (message.role === "user") {
      line = `${userLabel}: ${body}`;
    } else if (message.role === "system") {
      line = `System: ${body}`;
    } else if (
      prefixSpeakerNames &&
      message.character_id &&
      nameMap?.has(message.character_id)
    ) {
      line = `${nameMap.get(message.character_id) || charLabel}: ${body}`;
    } else if (prefixSpeakerNames) {
      line = `${charLabel}: ${body}`;
    } else if (message.role === "assistant") {
      line = body;
    } else {
      line = `${charLabel}: ${body}`;
    }

    if (messengerTimestamps) {
      const parts = messengerTimestampParts(message.created_at, options.timezone);
      if (parts) {
        const stamps: string[] = [];
        if (parts.dayKey !== previousDayKey) {
          stamps.push(`[${parts.dateLabel}]`);
          previousDayKey = parts.dayKey;
        }
        stamps.push(`[${parts.timeLabel}]`);
        line = `${stamps.join(" ")} ${line}`;
      }
    }

    lines.push(line);
  }

  return lines.join("\n");
}

function messengerTimestampParts(
  iso: string,
  timezone?: string | null,
): { dayKey: string; dateLabel: string; timeLabel: string } | null {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const tz = timezone?.trim() || undefined;
  const dayKey = formatInTimeZone(date, tz, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const dateLabel = dayKey.replace(/\//g, ".");
  const timeLabel = formatInTimeZone(date, tz, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { dayKey, dateLabel, timeLabel };
}

function formatInTimeZone(
  date: Date,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    ...options,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

function formatAttachmentNote(message: ChatMessage): string | null {
  const attachments = activeMessageAttachments(message);
  if (!attachments.length) return null;
  const names = attachments
    .map((item) => item.name.trim() || (item.kind === "image" ? "image" : "file"))
    .filter(Boolean);
  if (names.length === 0) return "[attachment]";
  return `[attached: ${names.join(", ")}]`;
}
