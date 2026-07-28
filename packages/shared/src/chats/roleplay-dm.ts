export type DirectMessageCommand = {
  type: "dm";
  character: string;
  message: string;
  raw: string;
  resolvedCharacterId?: string;
  resolvedCharacterName?: string;
};

export type RoleplayDmSource = {
  source_chat_id: string;
  source_user_message_id: string;
  target_character_id?: string;
};

const QUOTED_PARAM_BLOCK = '(?:[^"\\]]|"(?:\\\\.|[^"\\\\])*")*';
const DIRECT_MESSAGE_RE = new RegExp(
  `\\[dm:\\s*(${QUOTED_PARAM_BLOCK})\\]`,
  "gi",
);

const QUOTE_PAIRS: Record<string, string> = {
  '"': '"',
  "\u201c": "\u201d",
  "\u201d": "\u201d",
  "\u2018": "\u2019",
  "\u2019": "\u2019",
};

function parseQuotedParam(
  params: string,
  key: string,
  allowEmpty = false,
): string | undefined {
  const match = params.match(
    new RegExp(`${key}\\s*=\\s*(["\u201c\u201d\u2018\u2019])`),
  );
  if (!match || match.index === undefined) return undefined;

  const openingQuote = match[1] ?? '"';
  const closingQuote = QUOTE_PAIRS[openingQuote] ?? openingQuote;
  let rawValue = "";
  let index = match.index + match[0].length;

  while (index < params.length) {
    const char = params[index] ?? "";
    const nextChar = params[index + 1];

    if (char === "\\" && nextChar !== undefined) {
      rawValue += char + nextChar;
      index += 2;
      continue;
    }

    const remainder = params.slice(index + 1).trimStart();
    if (
      char === closingQuote &&
      (remainder.length === 0 ||
        remainder.startsWith(",") ||
        /^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(remainder))
    ) {
      break;
    }

    rawValue += char;
    index += 1;
  }

  if (index >= params.length) return undefined;

  const value = rawValue
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
  if (!allowEmpty && value.length === 0) return undefined;
  return value;
}

function normalizeDmTargetName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^il\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readCharacterName(data: unknown): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  const name = (data as { name?: unknown }).name;
  return typeof name === "string" ? name.trim() : "";
}

/** Parse Roleplay `[dm: character="…" message="…"]` commands. */
export function parseDirectMessageCommands(content: string): {
  cleanContent: string;
  commands: DirectMessageCommand[];
} {
  const commands: DirectMessageCommand[] = [];

  for (const match of content.matchAll(DIRECT_MESSAGE_RE)) {
    const params = match[1]!;
    const character = parseQuotedParam(params, "character");
    const message = parseQuotedParam(params, "message");
    const cleanMessage = message?.trim() ?? "";
    if (character && cleanMessage) {
      commands.push({
        type: "dm",
        character,
        message: cleanMessage,
        raw: match[0],
      });
    }
  }

  const cleanContent = content
    .replace(DIRECT_MESSAGE_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { cleanContent, commands };
}

export function resolveRoleplayDmTarget(
  requestedTarget: string,
  roleplayCharacters: Array<{ id: string; name: string }>,
  allCharacters: Array<{ id: string; data?: { name?: string } }>,
): { id: string; name: string } | null {
  const requestedId = requestedTarget.trim();
  const requestedKey = normalizeDmTargetName(requestedTarget);
  if (!requestedKey) return null;

  const roleplayTarget = roleplayCharacters.find(
    (character) =>
      character.id === requestedId ||
      normalizeDmTargetName(character.name) === requestedKey,
  );
  if (roleplayTarget) {
    return { id: roleplayTarget.id, name: roleplayTarget.name };
  }

  for (const candidate of allCharacters) {
    if (candidate.id === requestedId) {
      const name = readCharacterName(candidate.data).trim();
      return { id: candidate.id, name: name || requestedId };
    }
    const candidateName = readCharacterName(candidate.data);
    if (
      candidateName &&
      normalizeDmTargetName(candidateName) === requestedKey
    ) {
      return { id: candidate.id, name: candidateName };
    }
  }

  return null;
}

export function formatUnresolvedRoleplayDmFallback(
  command: DirectMessageCommand,
): string {
  const character = command.character.trim();
  const message = command.message.trim();
  if (!message) return "";
  return character ? `${character}: "${message}"` : message;
}

export function replaceRoleplayDmCommandText(
  source: string,
  command: DirectMessageCommand,
  replacement: string,
): string {
  if (command.raw && source.includes(command.raw)) {
    return source.replace(command.raw, replacement);
  }
  return source;
}

/** Marinara-style hidden command reminder injected into the roleplay prompt. */
export function buildRoleplayDmCommandReminder(input: {
  characterNames: string[];
  userName: string;
}): string {
  const dmTargetHint =
    input.characterNames.map((name) => name.replace(/"/g, "'")).join(" | ") ||
    "character name";
  const userName = input.userName.trim() || "the user";
  return [
    "<dm_commands>",
    "Optional hidden command — use only when it naturally fits the scene:",
    `- [dm: character="${dmTargetHint}" message="short text"] — only if a roleplay character sends ${userName} a direct message through a phone, communicator, letter app, terminal, or similar in-world channel. The hub strips the command from the roleplay reply and posts the full message into a private DM conversation with that character.`,
    "Only use one of the listed character names/IDs. Do not use this for incidental NPCs without a character card.",
    "Do not also quote the exact same direct-message text in the roleplay narration unless the user should see it in both places.",
    "</dm_commands>",
  ].join("\n");
}
