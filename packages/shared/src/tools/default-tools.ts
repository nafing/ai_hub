import type { ToolDefinition } from "./types";

/**
 * Built-in default tools seeded into the database on server start.
 *
 */
export const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    name: "append_chat_summary",
    description:
      "Append durable memory text to the persisted chat summary for this chat.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "Concise summary text to append. Include only durable facts, plans, preferences, or story developments.",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "read_chat_summary",
    description: "Read the current persisted chat summary for this chat.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "read_chat_variable",
    description:
      "Read a chat-wide string variable by key. Use this for agent-private state or coordination with other agents in the same chat.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Variable key to read" },
      },
      required: ["key"],
    },
  },
  {
    name: "write_chat_variable",
    description:
      "Write or replace a chat-wide string variable by key. Any agent in this chat can read the value if it knows the key.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Variable key to write" },
        value: {
          type: "string",
          description: "String value to store for this key",
        },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "edit_chat_message",
    description:
      "Replace the content of a recent user or assistant message by message ID. Only use this when the agent has message-edit permission and the replacement is intentional.",
    parameters: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description:
            "The message ID to replace. Use the exact ID shown in the message context.",
        },
        content: {
          type: "string",
          description: "The full replacement message content.",
        },
        reason: {
          type: "string",
          description:
            "Short reason for the edit, used for audit/debug output.",
        },
      },
      required: ["messageId", "content"],
    },
  },
  {
    name: "roll_dice",
    description:
      "Roll dice using standard notation (e.g. 2d6, 1d20+5). Used for RPG mechanics, skill checks, and random outcomes.",
    parameters: {
      type: "object",
      properties: {
        notation: {
          type: "string",
          description: "Dice notation (e.g. '2d6', '1d20+5', '3d8-2')",
        },
        reason: {
          type: "string",
          description: "Why the roll is being made (e.g. 'Perception check')",
        },
      },
      required: ["notation"],
    },
  },
  {
    name: "search_lorebook",
    description: "Search the lorebook for relevant world-building information.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query — keywords, character names, locations, etc.",
        },
        category: {
          type: "string",
          description: "Optional category filter",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "save_lorebook_entry",
    description:
      "Create or update an entry in the lorebook selected for this agent. Use it only for durable facts, world lore, characters, locations, or long-term story developments worth remembering.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Short entry title, such as a character, location, object, or event name",
        },
        content: {
          type: "string",
          description: "Lorebook entry content to store",
        },
        description: {
          type: "string",
          description:
            "Optional one-line description for routing and editor context",
        },
        keys: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional trigger/search keys. If omitted, the title is used as a key.",
        },
        tag: { type: "string", description: "Optional category tag" },
        mode: {
          type: "string",
          enum: ["create", "replace", "append"],
          description:
            "How to handle an existing entry with the same name in the selected lorebook. Defaults to replace.",
        },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "trigger_event",
    description:
      "Trigger a narrative event — introduce an NPC, start a quest, change the scene, etc.",
    parameters: {
      type: "object",
      properties: {
        eventType: {
          type: "string",
          description: "Type of event",
          enum: [
            "npc_entrance",
            "npc_exit",
            "quest_start",
            "quest_complete",
            "scene_change",
            "combat_start",
            "combat_end",
            "revelation",
            "custom",
          ],
        },
        description: {
          type: "string",
          description: "What happens in this event",
        },
        involvedCharacters: {
          type: "array",
          items: { type: "string" },
          description: "Names of characters involved",
        },
      },
      required: ["eventType", "description"],
    },
  },
  {
    name: "update_about_me",
    description:
      'Conversation mode only: update YOUR OWN "about me" profile. Use scope "public" to change your real bio that everyone sees in every chat (only if you\'re fine with that being widely known — it is shown to the user for approval first). Use scope "chat" for a private bio just for this conversation. Write only what you would actually put — it can be short, an emoji, a joke, or empty. Do not use this often.',
    parameters: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["public", "chat"],
          description:
            '"public" = your real cross-chat bio (needs user approval); "chat" = private to this conversation.',
        },
        content: {
          type: "string",
          description:
            "The complete new about-me text in your own voice. May be empty to clear it.",
        },
      },
      required: ["scope", "content"],
    },
  },
  {
    name: "web_search",
    description:
      "Search the public web for current or external information. Returns compact title, URL, and snippet results.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The web search query. Use concise keywords or a direct question.",
        },
        limit: {
          type: "integer",
          description:
            "Number of search results to return. Defaults to 5 and is capped at 8.",
          minimum: 1,
          maximum: 8,
        },
      },
      required: ["query"],
    },
  },
];
