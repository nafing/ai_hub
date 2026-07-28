import type { ConversationCommandKey } from "./conversation-presence";
import { CONVERSATION_COMMAND_KEYS } from "./conversation-presence";

export type ConversationCommand =
  | {
      type: "react";
      emoji: string;
      targetName?: string;
      raw: string;
    }
  | {
      type: "schedule_update";
      status?: string;
      activity?: string;
      duration?: string;
      raw: string;
    }
  | {
      type: "memory";
      target: string;
      summary: string;
      raw: string;
    }
  | {
      type: "cross_post";
      target: string;
      raw: string;
    };

const QUOTED_PARAM_BLOCK = '(?:[^"\\]]|"(?:\\\\.|[^"\\\\])*")*';

const REACT_RE = new RegExp(
  `\\[react:\\s*(${QUOTED_PARAM_BLOCK})\\]`,
  "gi",
);
const SCHEDULE_RE = new RegExp(
  `\\[schedule_update:\\s*(${QUOTED_PARAM_BLOCK})\\]`,
  "gi",
);
const MEMORY_RE = new RegExp(
  `\\[memory:\\s*(${QUOTED_PARAM_BLOCK})\\]`,
  "gi",
);
const CROSS_POST_RE = new RegExp(
  `\\[cross_post:\\s*(${QUOTED_PARAM_BLOCK})\\]`,
  "gi",
);

function parseQuotedParam(params: string, key: string): string | undefined {
  const match = params.match(new RegExp(`${key}\\s*=\\s*"([^"]*)"`));
  return match?.[1];
}

function parseBareParam(params: string, key: string): string | undefined {
  const match = params.match(
    new RegExp(`${key}\\s*=\\s*([^,\\]]+)`),
  );
  return match?.[1]?.trim().replace(/^["']|["']$/g, "");
}

function readParam(params: string, key: string): string | undefined {
  return parseQuotedParam(params, key) ?? parseBareParam(params, key);
}

export function isConversationCommandEnabled(
  toggles: Partial<Record<ConversationCommandKey, boolean>> | undefined,
  key: ConversationCommandKey,
): boolean {
  if (!toggles) return true;
  return toggles[key] !== false;
}

/** Parse + strip built-in conversation command tags. */
export function parseConversationCommands(content: string): {
  cleanContent: string;
  commands: ConversationCommand[];
} {
  const commands: ConversationCommand[] = [];

  for (const match of content.matchAll(REACT_RE)) {
    const params = match[1] ?? "";
    const emoji = readParam(params, "emoji")?.trim();
    if (!emoji) continue;
    commands.push({
      type: "react",
      emoji,
      targetName: readParam(params, "to")?.trim(),
      raw: match[0],
    });
  }

  for (const match of content.matchAll(SCHEDULE_RE)) {
    const params = match[1] ?? "";
    commands.push({
      type: "schedule_update",
      status: readParam(params, "status")?.trim(),
      activity: readParam(params, "activity")?.trim(),
      duration: readParam(params, "duration")?.trim(),
      raw: match[0],
    });
  }

  for (const match of content.matchAll(MEMORY_RE)) {
    const params = match[1] ?? "";
    const target = readParam(params, "target")?.trim();
    const summary = readParam(params, "summary")?.trim();
    if (!target || !summary) continue;
    commands.push({
      type: "memory",
      target,
      summary,
      raw: match[0],
    });
  }

  for (const match of content.matchAll(CROSS_POST_RE)) {
    const params = match[1] ?? "";
    const target = readParam(params, "target")?.trim();
    if (!target) continue;
    commands.push({
      type: "cross_post",
      target,
      raw: match[0],
    });
  }

  const cleanContent = content
    .replace(REACT_RE, "")
    .replace(SCHEDULE_RE, "")
    .replace(MEMORY_RE, "")
    .replace(CROSS_POST_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { cleanContent, commands };
}

export function filterEnabledConversationCommands(
  commands: ConversationCommand[],
  toggles: Partial<Record<ConversationCommandKey, boolean>> | undefined,
): ConversationCommand[] {
  return commands.filter((command) => {
    const key = command.type as ConversationCommandKey;
    if (!CONVERSATION_COMMAND_KEYS.includes(key)) return false;
    return isConversationCommandEnabled(toggles, key);
  });
}

export function buildConversationCommandsReminder(input: {
  characterNames: string[];
  enabledKeys: ConversationCommandKey[];
}): string {
  const names =
    input.characterNames.map((name) => name.replace(/"/g, "'")).join(" | ") ||
    "character name";
  const lines = [
    "<conversation_commands>",
    "Optional hidden commands — use only when natural:",
  ];
  if (input.enabledKeys.includes("react")) {
    lines.push(
      `- [react: emoji="😂"] — react to the latest user message (optional to="Name").`,
    );
  }
  if (input.enabledKeys.includes("schedule_update")) {
    lines.push(
      `- [schedule_update: status="idle|dnd|online|offline", activity="short activity", duration="30m"] — update your presence.`,
    );
  }
  if (input.enabledKeys.includes("memory")) {
    lines.push(
      `- [memory: target="${names}" summary="durable fact"] — remember something about a character for later chats.`,
    );
  }
  if (input.enabledKeys.includes("cross_post")) {
    lines.push(
      `- [cross_post: target="Chat title or character"] — also post this reply into another shared conversation.`,
    );
  }
  lines.push(
    "Do not quote these tags in visible chat text.",
    "</conversation_commands>",
  );
  return lines.join("\n");
}

export function buildAboutMePromptBlock(input: {
  entries: Array<{ name: string; about: string }>;
}): string | null {
  const parts = input.entries
    .map((entry) => {
      const about = entry.about.trim();
      if (!about) return null;
      return `${entry.name}:\n${about}`;
    })
    .filter(Boolean);
  if (!parts.length) return null;
  return ["<about_me>", ...parts, "</about_me>"].join("\n");
}
