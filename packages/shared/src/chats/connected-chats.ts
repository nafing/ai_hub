import { activeMessageText } from "./history";
import { compileChatSummaryEntries } from "./summary/entries";
import type { Chat, ChatMessage } from "./types";

export const CONNECTED_NOTES_BUDGET_CHARS = 4000;
export const CONNECTED_RECENT_MESSAGE_LIMIT = 20;
export const CONNECTED_MESSAGE_CHAR_LIMIT = 500;

const INFLUENCE_RE = /<influence>([\s\S]*?)<\/influence>/gi;
const NOTE_RE = /<note>([\s\S]*?)<\/note>/gi;
const OOC_RE = /<ooc>([\s\S]*?)<\/ooc>/gi;

function estimateChars(items: string[]): number {
  return items.reduce((sum, item) => sum + item.length, 0);
}

export function pruneConnectedNotes(
  notes: string[],
  budget = CONNECTED_NOTES_BUDGET_CHARS,
): string[] {
  const cleaned = notes.map((note) => note.trim()).filter(Boolean);
  if (!cleaned.length) return [];
  const kept: string[] = [];
  for (let i = cleaned.length - 1; i >= 0; i -= 1) {
    const next = [cleaned[i]!, ...kept];
    if (estimateChars(next) > budget && kept.length > 0) break;
    kept.unshift(cleaned[i]!);
  }
  return kept;
}

export function normalizeConnectedNotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return pruneConnectedNotes(
    value.filter((item): item is string => typeof item === "string"),
  );
}

export function normalizeConnectedInfluences(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(-40);
}

export function parseConnectedSideEffectTags(content: string): {
  cleanContent: string;
  influences: string[];
  notes: string[];
} {
  const influences: string[] = [];
  const notes: string[] = [];
  let cleanContent = content;

  cleanContent = cleanContent.replace(INFLUENCE_RE, (_match, body: string) => {
    const text = String(body ?? "").trim();
    if (text) influences.push(text);
    return "";
  });
  cleanContent = cleanContent.replace(NOTE_RE, (_match, body: string) => {
    const text = String(body ?? "").trim();
    if (text) notes.push(text);
    return "";
  });

  return {
    cleanContent: cleanContent.replace(/\n{3,}/g, "\n\n").trim(),
    influences,
    notes,
  };
}

export function parseOocTags(content: string): {
  cleanContent: string;
  oocBodies: string[];
} {
  const oocBodies: string[] = [];
  const cleanContent = content.replace(OOC_RE, (_match, body: string) => {
    const text = String(body ?? "").trim();
    if (text) oocBodies.push(text);
    return "";
  });
  return {
    cleanContent: cleanContent.replace(/\n{3,}/g, "\n\n").trim(),
    oocBodies,
  };
}

function formatRecentLines(input: {
  messages: ChatMessage[];
  personaName?: string;
  nameByCharacterId?: Map<string, string>;
  recentLimit?: number;
}): string[] {
  const recent = input.messages
    .filter((message) => !message.hidden_from_prompt)
    .slice(-(input.recentLimit ?? CONNECTED_RECENT_MESSAGE_LIMIT));
  const lines: string[] = [];
  for (const message of recent) {
    const speaker =
      message.role === "user"
        ? input.personaName?.trim() || "User"
        : message.character_id
          ? (input.nameByCharacterId?.get(message.character_id) ??
            message.character_id)
          : message.role === "system"
            ? "System"
            : "Narrator";
    const text = activeMessageText(message)
      .trim()
      .slice(0, CONNECTED_MESSAGE_CHAR_LIMIT);
    if (!text) continue;
    lines.push(`[${speaker}]: ${text}`);
  }
  return lines;
}

/**
 * Conversation → linked roleplay: inject recent story context.
 */
export function buildConnectedLinkedRoleplayBlock(input: {
  roleplayChat: Chat;
  personaName?: string;
  nameByCharacterId?: Map<string, string>;
  recentLimit?: number;
}): string | null {
  const chat = input.roleplayChat;
  if (chat.mode !== "roleplay") return null;
  const title = (chat.title || "Connected roleplay").replace(/"/g, "'");
  const summary =
    chat.summary?.trim() ||
    compileChatSummaryEntries(chat.summary_entries ?? []).trim() ||
    "";
  const lines = formatRecentLines({
    messages: chat.messages,
    personaName: input.personaName,
    nameByCharacterId: input.nameByCharacterId,
    recentLimit: input.recentLimit,
  });
  if (!summary && !lines.length) return null;

  const parts = [
    `<ConnectedRoleplay title="${title}">`,
    `You have access to context from the linked roleplay "${title}".`,
    `Recent messages from that roleplay are provided so you can naturally reference or discuss events happening there.`,
  ];
  if (summary) {
    parts.push("<Summary>", summary, "</Summary>");
  }
  if (lines.length) {
    parts.push("<RecentMessages>", ...lines, "</RecentMessages>");
  }
  parts.push("</ConnectedRoleplay>");
  return parts.join("\n");
}

export function buildConnectedLinkInstructions(input: {
  roleplayTitle: string;
  influenceEnabled: boolean;
  noteEnabled: boolean;
}): string | null {
  if (!input.influenceEnabled && !input.noteEnabled) return null;
  const title = input.roleplayTitle.replace(/"/g, "'");
  const lines = [
    "<ConnectedRoleplayInstructions>",
    `You have access to a connected roleplay: "${title}".`,
  ];
  if (input.influenceEnabled) {
    lines.push(
      "",
      "If something said in THIS conversation should affect the roleplay, include an influence tag (stripped from visible text):",
      "<influence>what should happen or change in the roleplay</influence>",
      "Use sparingly — only when conversation content genuinely should cross into the story.",
    );
  }
  if (input.noteEnabled) {
    lines.push(
      "",
      "For durable facts the roleplay should keep remembering across many turns, use a note instead:",
      "<note>fact, decision, promise, or detail to remember</note>",
    );
  }
  lines.push("</ConnectedRoleplayInstructions>");
  return lines.join("\n");
}

export function buildConnectedInfluencesBlock(influences: string[]): string | null {
  const cleaned = influences.map((item) => item.trim()).filter(Boolean);
  if (!cleaned.length) return null;
  return [
    "<ooc_influences>",
    "The following influences came from a linked conversation. Incorporate them naturally into the next roleplay beat, then continue as usual:",
    ...cleaned.map((item) => `- ${item}`),
    "</ooc_influences>",
  ].join("\n");
}

export function buildConnectedNotesBlock(notes: string[]): string | null {
  const cleaned = pruneConnectedNotes(notes);
  if (!cleaned.length) return null;
  return [
    "<conversation_notes>",
    "Durable notes from a linked conversation. Keep them in mind for this roleplay:",
    ...cleaned.map((item) => `- ${item}`),
    "</conversation_notes>",
  ].join("\n");
}

export function buildConnectedOocInstruction(): string {
  return [
    "<ooc_instruction>",
    "You can send an out-of-character note into the linked conversation with:",
    "<ooc>short message for the conversation chat</ooc>",
    "The tag is stripped from the roleplay reply. Use sparingly.",
    "</ooc_instruction>",
  ].join("\n");
}
