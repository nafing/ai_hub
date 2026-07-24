/**
 * Slash commands — SillyTavern-style `/` commands adapted for ai_hub.
 * Logic mirrors marinara `slash-commands.ts` for the portable subset.
 */

export type ChatSlashMode = "conversation" | "roleplay";

export type SlashCommandDef = {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  modes?: ChatSlashMode[];
  /** Executed client-side; does not fall through to normal send. */
  local?: boolean;
};

export type SlashCommandAction =
  | { type: "feedback"; message: string }
  | {
      type: "create_message";
      role: "user" | "assistant" | "system";
      content: string;
      characterId?: string | null;
    }
  | {
      type: "generate";
      userMessage?: string;
      forCharacterId?: string;
      generationGuide?: string;
      impersonate?: boolean;
      continueMessageId?: string;
    };

export type SlashCommandContext = {
  mode: ChatSlashMode;
  characters: Array<{ id: string; name: string }>;
  requiresManualGuideTarget?: boolean;
  latestAssistantMessageId?: string | null;
  lastMessageRole?: string | null;
};

export type SlashCommandResult = {
  handled: boolean;
  actions: SlashCommandAction[];
};

function normalizeTextForMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAvailableCharacterList(
  characters: Array<{ name: string }>,
): string {
  return characters.map((character) => character.name).join(", ");
}

function buildGuidedGenerationInstructionMessage(direction: string): string {
  return [
    "[Guided generation — follow this direction for the next reply.]",
    "Do not speak as {{user}}. Stay in character and advance the scene as instructed:",
    direction.trim(),
  ].join("\n");
}

function buildNarratorInstructionMessage(direction: string): string {
  return [
    "[Narrator instruction — do not include a reply from {{user}}.]",
    "Narrate and steer the scene in this direction:",
    direction.trim(),
  ].join("\n");
}

function trimGuideSeparator(value: string): string {
  return value.replace(/^\s*[:;,-]\s*/u, "").trim();
}

function guidedTargetRemainder(args: string): string | null {
  const trimmed = args.trim();
  const match =
    trimmed.match(/^(?:respond|reply|answer)\s+(?:for|as|from)\s+/iu) ??
    trimmed.match(/^(?:for|as|from)\s+/iu);
  return match ? trimmed.slice(match[0].length).trim() : null;
}

function splitLeadingQuotedTarget(
  value: string,
): { targetName: string; rest: string } | null {
  const match = value.match(/^["']([^"']+)["']([\s\S]*)$/u);
  if (!match) return null;
  return { targetName: match[1]!.trim(), rest: match[2] ?? "" };
}

function resolveGuidedCharacterTarget(
  args: string,
  characters: Array<{ id: string; name: string }> = [],
): { character: { id: string; name: string }; guideText: string } | null {
  const remainder = guidedTargetRemainder(args);
  if (!remainder) return null;

  const quotedTarget = splitLeadingQuotedTarget(remainder);
  if (quotedTarget) {
    const quotedName = normalizeTextForMatch(quotedTarget.targetName);
    const character = characters.find(
      (candidate) => normalizeTextForMatch(candidate.name) === quotedName,
    );
    return character
      ? { character, guideText: trimGuideSeparator(quotedTarget.rest) }
      : null;
  }

  const sortedCharacters = [...characters].sort(
    (a, b) =>
      normalizeTextForMatch(b.name).length - normalizeTextForMatch(a.name).length,
  );
  for (const character of sortedCharacters) {
    const normalizedName = normalizeTextForMatch(character.name);
    if (!normalizedName) continue;

    const words = Array.from(remainder.matchAll(/\S+/gu));
    for (const word of words) {
      const end = (word.index ?? 0) + word[0].length;
      const prefix = remainder.slice(0, end);
      const normalizedPrefix = normalizeTextForMatch(
        prefix.replace(/[:;,-]+$/u, ""),
      );
      if (normalizedPrefix === normalizedName) {
        return {
          character,
          guideText: trimGuideSeparator(remainder.slice(end)),
        };
      }
      if (!normalizedName.startsWith(normalizedPrefix)) break;
    }
  }

  return null;
}

function formatGuidedTargetHelp(
  characters: Array<{ name: string }>,
): string {
  const available = formatAvailableCharacterList(characters);
  return `Use /guided respond for <character> <direction>${
    available ? `\nAvailable: ${available}` : ""
  }`;
}

function parseDice(
  notation: string,
): { count: number; sides: number; modifier: number } | null {
  const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  return {
    count: parseInt(match[1] || "1", 10),
    sides: parseInt(match[2]!, 10),
    modifier: match[3] ? parseInt(match[3], 10) : 0,
  };
}

function rollDice(count: number, sides: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unescapeCommandQuotedText(value: string): string {
  return value.replace(/\\(["'\u201c\u201d\u2018\u2019\\])/g, "$1");
}

function parseLeadingQuotedSegment(
  input: string,
): { value: string; rest: string } | null {
  const trimmed = input.trimStart();
  const quotePairs: Record<string, string> = {
    '"': '"',
    "'": "'",
    "\u201c": "\u201d",
    "\u2018": "\u2019",
  };
  const quote = trimmed[0];
  const closingQuote = quote ? quotePairs[quote] : undefined;
  if (!quote || !closingQuote) return null;

  let escaped = false;
  for (let i = 1; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === closingQuote) {
      return {
        value: unescapeCommandQuotedText(trimmed.slice(1, i)),
        rest: trimmed.slice(i + 1).trim(),
      };
    }
  }

  return null;
}

function stripSingleWrappingQuotePair(input: string): string {
  const trimmed = input.trim();
  const quotePairs: Record<string, string> = {
    '"': '"',
    "'": "'",
    "\u201c": "\u201d",
    "\u2018": "\u2019",
  };
  const opening = trimmed[0];
  const closing = opening ? quotePairs[opening] : undefined;
  if (opening && closing && trimmed.endsWith(closing) && trimmed.length >= 2) {
    return unescapeCommandQuotedText(trimmed.slice(1, -1)).trim();
  }
  return trimmed;
}

function parseCommandTokens(
  input: string,
): Array<{ value: string; quoted: boolean }> {
  const tokens: Array<{ value: string; quoted: boolean }> = [];
  const tokenPattern =
    /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|\u201c([^\u201d\\]*(?:\\.[^\u201d\\]*)*)\u201d|\u2018([^\u2019\\]*(?:\\.[^\u2019\\]*)*)\u2019|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(input))) {
    const quoted =
      match[1] !== undefined ||
      match[2] !== undefined ||
      match[3] !== undefined ||
      match[4] !== undefined;
    const raw = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? "").trim();
    if (!raw) continue;
    tokens.push({
      value: raw.replace(/\\(["'\u201c\u201d\u2018\u2019\\])/g, "$1"),
      quoted,
    });
  }
  return tokens;
}

function findSceneCharacter<T extends { name: string }>(
  characters: T[],
  name: string,
): T | null {
  const normalized = normalizeTextForMatch(name);
  if (!normalized) return null;
  return (
    characters.find(
      (character) => normalizeTextForMatch(character.name) === normalized,
    ) ??
    characters.find((character) =>
      normalizeTextForMatch(character.name).includes(normalized),
    ) ??
    null
  );
}

function resolveAsCommandTarget(
  args: string,
  characters: Array<{ id: string; name: string }>,
): {
  target: { id: string; name: string } | null;
  requestedName: string;
  message: string;
} {
  const trimmed = args.trim();
  if (!trimmed) return { target: null, requestedName: "", message: "" };

  const quotedTarget = parseLeadingQuotedSegment(trimmed);
  if (quotedTarget) {
    const target = findSceneCharacter(characters, quotedTarget.value);
    return {
      target,
      requestedName: quotedTarget.value,
      message: stripSingleWrappingQuotePair(quotedTarget.rest),
    };
  }

  const sortedCharacters = [...characters].sort(
    (a, b) => b.name.length - a.name.length,
  );
  for (const character of sortedCharacters) {
    const pattern = new RegExp(`^${escapeRegExp(character.name)}(?:\\s+|$)`, "iu");
    const match = trimmed.match(pattern);
    if (match) {
      return {
        target: character,
        requestedName: character.name,
        message: stripSingleWrappingQuotePair(
          trimmed.slice(match[0].length).trim(),
        ),
      };
    }
  }

  const tokens = parseCommandTokens(trimmed);
  for (let length = tokens.length; length >= 1; length -= 1) {
    const requestedName = tokens
      .slice(0, length)
      .map((token) => token.value)
      .join(" ")
      .trim();
    const target = findSceneCharacter(characters, requestedName);
    if (target) {
      return {
        target,
        requestedName,
        message: stripSingleWrappingQuotePair(
          tokens
            .slice(length)
            .map((token) => token.value)
            .join(" "),
        ),
      };
    }
  }

  const fallbackName = tokens[0]?.value ?? trimmed;
  return { target: null, requestedName: fallbackName, message: "" };
}

type ExecutableSlashCommand = SlashCommandDef & {
  execute: (
    args: string,
    ctx: SlashCommandContext,
  ) => Promise<SlashCommandResult>;
};

function isCommandAvailable(
  command: SlashCommandDef,
  mode: ChatSlashMode,
): boolean {
  if (command.modes && !command.modes.includes(mode)) return false;
  return true;
}

function buildSlashHelpText(mode: ChatSlashMode): string {
  const available = getAvailableSlashCommands(mode);
  return [
    "Available Commands:",
    "",
    ...available.map((command) => `${command.usage} - ${command.description}`),
  ].join("\n");
}

const COMMANDS: ExecutableSlashCommand[] = [
  {
    name: "help",
    description: "Show available slash commands",
    usage: "/help",
    local: true,
    async execute(_args, ctx) {
      return {
        handled: true,
        actions: [{ type: "feedback", message: buildSlashHelpText(ctx.mode) }],
      };
    },
  },
  {
    name: "roll",
    aliases: ["r", "dice"],
    description: "Roll dice (e.g. 2d6, 1d20+5)",
    usage: "/roll <notation>",
    local: true,
    async execute(args) {
      const notation = args.trim() || "1d20";
      const parsed = parseDice(notation);
      if (!parsed) {
        return {
          handled: true,
          actions: [
            {
              type: "feedback",
              message: `Invalid dice notation: ${notation}`,
            },
          ],
        };
      }
      const rolls = rollDice(parsed.count, parsed.sides);
      const sum = rolls.reduce((a, b) => a + b, 0) + parsed.modifier;
      const modStr =
        parsed.modifier > 0
          ? `+${parsed.modifier}`
          : parsed.modifier < 0
            ? `${parsed.modifier}`
            : "";
      const detail =
        parsed.count > 1
          ? ` [${rolls.join(", ")}]${modStr}`
          : modStr
            ? ` (${rolls[0]}${modStr})`
            : "";
      const text = `Dice **${notation}** → **${sum}**${detail}`;
      return {
        handled: true,
        actions: [
          { type: "create_message", role: "system", content: text },
        ],
      };
    },
  },
  {
    name: "sys",
    aliases: ["system"],
    description: "Insert a system message",
    usage: "/sys <message>",
    local: true,
    async execute(args) {
      if (!args.trim()) {
        return {
          handled: true,
          actions: [
            { type: "feedback", message: "Usage: /sys <message text>" },
          ],
        };
      }
      return {
        handled: true,
        actions: [
          {
            type: "create_message",
            role: "system",
            content: args.trim(),
          },
        ],
      };
    },
  },
  {
    name: "guided",
    aliases: ["narrator", "narrate", "nar"],
    description:
      "Steer the narrative — the AI will narrate events in the direction you describe",
    usage: "/guided [respond for <character>] <direction>",
    async execute(args, ctx) {
      if (!args.trim()) {
        return {
          handled: true,
          actions: [
            {
              type: "feedback",
              message: "Usage: /guided <direction to steer the narrative>",
            },
          ],
        };
      }

      const characters = ctx.characters;
      const targetedResponse = resolveGuidedCharacterTarget(args, characters);
      if (targetedResponse) {
        const generationGuide = targetedResponse.guideText
          ? buildGuidedGenerationInstructionMessage(targetedResponse.guideText)
          : undefined;
        return {
          handled: true,
          actions: [
            {
              type: "generate",
              forCharacterId: targetedResponse.character.id,
              ...(generationGuide ? { generationGuide } : {}),
            },
          ],
        };
      }

      if (
        guidedTargetRemainder(args) !== null ||
        ctx.requiresManualGuideTarget
      ) {
        return {
          handled: true,
          actions: [
            {
              type: "feedback",
              message: formatGuidedTargetHelp(characters),
            },
          ],
        };
      }

      return {
        handled: true,
        actions: [
          {
            type: "generate",
            generationGuide: buildNarratorInstructionMessage(args),
          },
        ],
      };
    },
  },
  {
    name: "continue",
    aliases: ["cont"],
    description: "Continue the AI response without sending a message",
    usage: "/continue",
    async execute(_args, ctx) {
      if (ctx.lastMessageRole === "assistant" && ctx.latestAssistantMessageId) {
        return {
          handled: true,
          actions: [
            {
              type: "generate",
              continueMessageId: ctx.latestAssistantMessageId,
            },
          ],
        };
      }
      if (!ctx.lastMessageRole) {
        return {
          handled: true,
          actions: [
            {
              type: "feedback",
              message: "There is no assistant message to continue.",
            },
          ],
        };
      }
      return {
        handled: true,
        actions: [{ type: "generate" }],
      };
    },
  },
  {
    name: "as",
    aliases: ["respond"],
    description:
      "Post a message as a character, or generate that character's next response",
    usage: '/as <character name> "message" | /as <character name>',
    async execute(args, ctx) {
      const characters = ctx.characters;
      const { target, requestedName, message } = resolveAsCommandTarget(
        args,
        characters,
      );
      if (!args.trim()) {
        return {
          handled: true,
          actions: [
            {
              type: "feedback",
              message: 'Usage: /as <character name> "message"',
            },
          ],
        };
      }
      if (!target) {
        return {
          handled: true,
          actions: [
            {
              type: "feedback",
              message: `Character "${requestedName || args.trim()}" not found. Available: ${
                characters.length > 0
                  ? formatAvailableCharacterList(characters)
                  : "(none)"
              }`,
            },
          ],
        };
      }

      if (message) {
        return {
          handled: true,
          actions: [
            {
              type: "create_message",
              role: "assistant",
              characterId: target.id,
              content: message,
            },
          ],
        };
      }

      return {
        handled: true,
        actions: [
          {
            type: "generate",
            forCharacterId: target.id,
          },
        ],
      };
    },
  },
  {
    name: "impersonate",
    aliases: ["imp"],
    description:
      "Generate a response as your character ({{user}}), optionally with a direction",
    usage: "/impersonate [direction]",
    async execute(args) {
      const direction = args.trim();
      return {
        handled: true,
        actions: [
          {
            type: "generate",
            impersonate: true,
            ...(direction ? { userMessage: direction } : {}),
          },
        ],
      };
    },
  },
  {
    name: "random",
    aliases: ["rand", "event"],
    description: "Introduce a random event to shake up the plot",
    usage: "/random",
    async execute() {
      return {
        handled: true,
        actions: [
          {
            type: "generate",
            userMessage:
              "[Narrator instruction — do not include a reply from {{user}}. Instead: And now, something completely different. Introduce a random, unexpected event to stir up the plot. Be creative and surprising — throw a curveball that keeps things interesting!]",
          },
        ],
      };
    },
  },
];

export function getAvailableSlashCommands(
  mode: ChatSlashMode = "roleplay",
): SlashCommandDef[] {
  return COMMANDS.filter((command) => isCommandAvailable(command, mode)).map(
    ({ execute: _execute, ...def }) => def,
  );
}

/** Find a matching command for the given input. */
export function matchSlashCommand(
  input: string,
  mode: ChatSlashMode = "roleplay",
): { command: ExecutableSlashCommand; args: string } | null {
  if (!input.startsWith("/")) return null;
  const spaceIdx = input.indexOf(" ");
  const cmdName = (
    spaceIdx === -1 ? input.slice(1) : input.slice(1, spaceIdx)
  ).toLowerCase();
  const args = spaceIdx === -1 ? "" : input.slice(spaceIdx + 1);

  for (const cmd of COMMANDS) {
    if (!isCommandAvailable(cmd, mode)) continue;
    if (cmd.name === cmdName || cmd.aliases?.includes(cmdName)) {
      return { command: cmd, args };
    }
  }
  return null;
}

/** Get all commands that match a partial prefix (for autocomplete). */
export function getSlashCompletions(
  partial: string,
  mode: ChatSlashMode = "roleplay",
): SlashCommandDef[] {
  if (!partial.startsWith("/")) return [];
  const rawPrefix = partial.slice(1);
  if (rawPrefix.includes(" ")) return [];
  const prefix = rawPrefix.trim().toLowerCase();
  const availableCommands = getAvailableSlashCommands(mode);
  if (!prefix) return availableCommands;
  return availableCommands.filter(
    (command) =>
      command.name.startsWith(prefix) ||
      command.aliases?.some((alias) => alias.startsWith(prefix)),
  );
}

export async function executeSlashCommand(
  input: string,
  ctx: SlashCommandContext,
): Promise<SlashCommandResult | null> {
  const matched = matchSlashCommand(input.trim(), ctx.mode);
  if (!matched) return null;
  return matched.command.execute(matched.args, ctx);
}

/**
 * Speaker-queue helper: only `/guided` (+ aliases) and `/impersonate` (+ aliases)
 * affect generation routing. Other slash commands are handled client-side.
 */
export function parseSlashCommand(text: string): {
  command: "guided" | "impersonate" | null;
  rest: string;
} {
  const matched = matchSlashCommand(text.trim());
  if (!matched) return { command: null, rest: text };
  if (matched.command.name === "guided") {
    return { command: "guided", rest: matched.args };
  }
  if (matched.command.name === "impersonate") {
    return { command: "impersonate", rest: matched.args };
  }
  return { command: null, rest: text };
}
