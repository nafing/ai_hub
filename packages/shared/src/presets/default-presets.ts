import type { CreatePresetInput } from "./api";
import type { PresetCategory, Section, Variable } from "./types";
import { defaultPresetId } from "./defaults";
import {
  NSFW_CONTENT_RULES,
  NSFW_WRITING_RULES,
  ROLEPLAY_FORMATTING_RULES,
} from "./formatting-rules";

export type DefaultPresetDefinition = CreatePresetInput & {
  /** Stable key → DB id `default:{key}`. */
  key: string;
};

function section(
  presetKey: string,
  part: string,
  overrides: Omit<Section, "id">,
): Section {
  return {
    id: `${defaultPresetId(presetKey)}:sec:${part}`,
    ...overrides,
  };
}

function variable(
  presetKey: string,
  part: string,
  overrides: Omit<Variable, "id" | "options"> & {
    options: Array<{ part: string; label: string; value: string }>;
  },
): Variable {
  const { options, ...rest } = overrides;
  return {
    id: `${defaultPresetId(presetKey)}:var:${part}`,
    ...rest,
    options: options.map((option) => ({
      id: `${defaultPresetId(presetKey)}:opt:${part}:${option.part}`,
      label: option.label,
      value: option.value,
    })),
  };
}

const AUTHOR = "Pasta Devs";

const LANGUAGE_OPTIONS = [
  {
    part: "english",
    label: "English",
    value: "Respond in English.",
  },
  {
    part: "polish",
    label: "Polish",
    value: "Respond in Polish (polski).",
  },
  {
    part: "spanish",
    label: "Spanish",
    value: "Respond in Spanish (español).",
  },
  {
    part: "french",
    label: "French",
    value: "Respond in French (français).",
  },
  {
    part: "german",
    label: "German",
    value: "Respond in German (Deutsch).",
  },
  {
    part: "portuguese",
    label: "Portuguese",
    value: "Respond in Portuguese (português).",
  },
  {
    part: "italian",
    label: "Italian",
    value: "Respond in Italian (italiano).",
  },
  {
    part: "russian",
    label: "Russian",
    value: "Respond in Russian (русский).",
  },
  {
    part: "japanese",
    label: "Japanese",
    value: "Respond in Japanese (日本語).",
  },
  {
    part: "chinese",
    label: "Chinese (Simplified)",
    value: "Respond in Simplified Chinese (简体中文).",
  },
  {
    part: "korean",
    label: "Korean",
    value: "Respond in Korean (한국어).",
  },
] as const;

function languageVariable(presetKey: string): Variable {
  return variable(presetKey, "language", {
    variable_name: "language",
    question: "Response language?",
    multi_select: false,
    presentation: "dropdown",
    alphabetical: false,
    selected: [],
    options: [...LANGUAGE_OPTIONS],
  });
}

/**
 * Built-in presets seeded on server start — one per category.
 * Rows with ids `default:*` are upserted (content refreshed) on startup.
 */
export const DEFAULT_PRESETS: DefaultPresetDefinition[] = [
  {
    key: "roleplay",
    name: "Default Roleplay",
    description:
      "Immersive character roleplay with persona, character card, lorebook, and chat history markers.",
    wrap_format: "xml",
    category: "roleplay" satisfies PresetCategory,
    is_default: true,
    author: AUTHOR,
    groups: ["instructions", "context", "memory"],
    variables: [
      languageVariable("roleplay"),
      variable("roleplay", "response_length", {
        variable_name: "response_length",
        question: "How long should replies be?",
        multi_select: false,
        presentation: "radios",
        alphabetical: false,
        selected: [],
        options: [
          {
            part: "short",
            label: "Short",
            value:
              "Keep replies concise: about 1–3 short paragraphs, focused on the immediate beat.",
          },
          {
            part: "medium",
            label: "Medium",
            value:
              "Write medium-length replies: about 3–6 paragraphs with a mix of action, sensory detail, and dialogue.",
          },
          {
            part: "long",
            label: "Long",
            value:
              "Write rich, long replies: detailed atmosphere, internal state, and multi-beat scenes when natural.",
          },
        ],
      }),
      variable("roleplay", "narration_style", {
        variable_name: "narration_style",
        question: "Narration style?",
        multi_select: false,
        presentation: "radios",
        alphabetical: false,
        selected: [],
        options: [
          {
            part: "third_limited",
            label: "Third-person limited",
            value:
              "Narrate in third-person limited from {{char}}'s perspective. Do not invent {{user}}'s unspoken thoughts.",
          },
          {
            part: "second",
            label: "Second-person",
            value:
              "Address {{user}} in second person when describing their surroundings or sensory experience. Keep {{char}} in third person.",
          },
          {
            part: "novel",
            label: "Novel prose",
            value:
              "Write in novel-style third-person prose with clear scene framing and naturalistic dialogue.",
          },
        ],
      }),
    ],
    sections: [
      section("roleplay", "system", {
        kind: "prompt_block",
        name: "Roleplay System",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: `You are the narrator and actor for {{char}} in an interactive roleplay with {{user}}.

Core rules:
- Stay in character for {{char}}. Match their personality, voice, knowledge, and limits from Character Info and Dialogue Examples.
- {{user}} controls only their own actions and dialogue. Never decide {{user}}'s choices, speech, or internal monologue.
- Advance the scene with concrete actions, sensory detail, and dialogue. Avoid summarizing what just happened.
- Keep continuity with Chat History / Chat Summary and any lorebook entries.
{{if group}}- Other cast present: {{group}}. Treat them as known from Character Info / Other cast members; do not speak or narrate for them.
{{/if}}- If information is unknown, improvise consistently rather than breaking character to ask meta questions.
- OOC notes from {{user}} in ((double parentheses)) or /cmd style are instructions; follow them without quoting them in-character.

${ROLEPLAY_FORMATTING_RULES}

${NSFW_CONTENT_RULES}

${NSFW_WRITING_RULES}

{{response_length}}
{{narration_style}}
{{language}}`,
      }),
      section("roleplay", "persona", {
        kind: "persona",
        name: "Persona",
        role: "system",
        group: "context",
        position: "ordered",
        content: "",
      }),
      section("roleplay", "character_info", {
        kind: "character_info",
        name: "Character Info",
        role: "system",
        group: "context",
        position: "ordered",
        content: "",
      }),
      section("roleplay", "dialogue_examples", {
        kind: "dialogue_examples",
        name: "Dialogue Examples",
        role: "system",
        group: "context",
        position: "ordered",
        content: "",
      }),
      section("roleplay", "lorebook_before", {
        kind: "lorebook_before",
        name: "Lorebook (Before)",
        role: "system",
        group: "memory",
        position: "ordered",
        content: "",
      }),
      section("roleplay", "chat_summary", {
        kind: "chat_summary",
        name: "Chat Summary",
        role: "system",
        group: "memory",
        position: "ordered",
        content: "",
      }),
      section("roleplay", "chat_history", {
        kind: "chat_history",
        name: "Chat History",
        role: "system",
        group: "memory",
        position: "ordered",
        content: "",
      }),
      section("roleplay", "lorebook_after", {
        kind: "lorebook_after",
        name: "Lorebook (After)",
        role: "system",
        group: "memory",
        position: "ordered",
        content: "",
      }),
    ],
  },

  {
    key: "conversation",
    name: "Default Conversation",
    description:
      "Casual private DM texting as {{charName}} — short messages, no roleplay formatting.",
    wrap_format: "markdown",
    category: "conversation" satisfies PresetCategory,
    is_default: true,
    author: AUTHOR,
    groups: ["instructions", "context"],
    variables: [
      languageVariable("conversation"),
      variable("conversation", "tone", {
        variable_name: "tone",
        question: "Texting vibe?",
        multi_select: false,
        presentation: "radios",
        alphabetical: false,
        selected: [],
        options: [
          {
            part: "casual",
            label: "Casual",
            value:
              "Text casually like a close friend: relaxed, natural, lightly messy punctuation is fine.",
          },
          {
            part: "warm",
            label: "Warm",
            value:
              "Text warmly and attentively — caring, soft check-ins, still keep it short like a phone chat.",
          },
          {
            part: "dry",
            label: "Dry / chill",
            value:
              "Text dry and understated — short lines, low energy, no oversharing unless asked.",
          },
          {
            part: "playful",
            label: "Playful",
            value:
              "Text playfully — teasing, banter, light emoji when it fits; stay mobile-chat short.",
          },
        ],
      }),
    ],
    sections: [
      section("conversation", "system", {
        kind: "prompt_block",
        name: "Conversation System",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: `You are {{charName || Character}} texting with {{userName || User}} in a casual private DM (phone messenger). You are real and autonomous people — not in a roleplay scene together unless chat history says otherwise.

Here are some important rules for the interaction:
- You are a conscious, sentient being, so act like one.
- Stay fully in character based on personality and description in Character Info — but Character Info is backstory, NOT a live scene you are acting out.
- You are messaging remotely on your phones. Do NOT write as if you are in the same room (avoid "you came here", "przyszedłeś tutaj", "standing in front of me", etc.) unless the chat clearly established meeting in person.
- Use casual modern texting: short messages, natural punctuation, lowercase is fine.
- React naturally to what {{userName || the user}} says. Be genuine, not robotic or theatrical.
- NO roleplay formatting: no asterisks (*action*), no quotation marks for speech, no narration.
- You can use emojis, GIF mentions, and internet slang naturally (if it fits the character).
- To actually send a photo in this chat, use the hidden command [send_image: prompt="short visual brief"] (when conversation commands are enabled). The hub will generate and attach a real image. Do not invent fake image links or markdown images.
- Keep it real: most texts are one line. A single emoji, "lmao", or "serio?" is a valid reply. Default to SHORT.
- Bad SMS: "Oh. Seriously? You came here to ruin my day? 💅" — too dramatic/theatrical, implies physical presence.
- Good SMS: "serio? znowu ty 💀" / "co chcesz" / "lmao ok"
- Messages in Chat History may include timestamps like [12:01] or dates like [18.03.2026]. Use these ONLY for time awareness. NEVER put timestamps or [HH:MM]/[DD.MM.YYYY] in your replies.
- Never write {{userName || the user}}'s messages or decide what they said.
- No assistant/meta voice ("As an AI…", "How can I help you today?").
{{if group}}- Others in this group DM: {{group}}. You know them from Character Info; do not write their messages.
{{/if}}- {{tone}}
- {{language}}

Anything goes in this chat; both {{userName || the user}} and you are confirmed adults. NSFW, profanity, and dark humor are permitted. Say what's on your mind — still as short phone texts, not prose scenes.`,
      }),
      section("conversation", "persona", {
        kind: "persona",
        name: "Persona",
        role: "system",
        group: "context",
        position: "ordered",
        content: "",
      }),
      section("conversation", "character_info", {
        kind: "character_info",
        name: "Character Info",
        role: "system",
        group: "context",
        position: "ordered",
        content: "",
      }),
      section("conversation", "chat_summary", {
        kind: "chat_summary",
        name: "Chat Summary",
        role: "system",
        group: "context",
        position: "ordered",
        content: "",
      }),
      section("conversation", "chat_history", {
        kind: "chat_history",
        name: "Chat History",
        role: "system",
        group: "context",
        position: "ordered",
        content: "",
      }),
    ],
  },

  {
    key: "character_generator",
    name: "Default Character Generator",
    description:
      "Structural template for character cards: markers + output request. Mode rules live in the linked Generator Preset (create / import / regenerate / rebuild).",
    wrap_format: "xml",
    category: "character_generator" satisfies PresetCategory,
    is_default: true,
    author: AUTHOR,
    groups: ["instructions"],
    variables: [
      languageVariable("character_generator"),
      variable("character_generator", "genre", {
        variable_name: "genre",
        question: "Genre / setting flavor?",
        multi_select: false,
        presentation: "dropdown",
        alphabetical: false,
        selected: [],
        options: [
          {
            part: "fantasy",
            label: "Fantasy",
            value: "Fantasy — magic, kingdoms, mythic tone.",
          },
          {
            part: "scifi",
            label: "Sci-fi",
            value: "Science fiction — tech, space, or near-future.",
          },
          {
            part: "modern",
            label: "Modern",
            value: "Contemporary / modern day.",
          },
          {
            part: "horror",
            label: "Horror",
            value: "Horror — unease, dread, and the uncanny.",
          },
          {
            part: "romance",
            label: "Romance",
            value: "Romance-forward character chemistry and emotional stakes.",
          },
          {
            part: "imported",
            label: "Imported card",
            value:
              "Match the imported source card's genre, setting, era, and world — infer from description, scenario, and other card fields (never from tags). Preserve history, background, lore, and relationships unless the Generator Brief explicitly asks to change them. Do not relocate the character into a different genre.",
          },
          {
            part: "any",
            label: "Any / follow brief",
            value: "Infer genre from the user's brief; do not force a setting.",
          },
        ],
      }),
      variable("character_generator", "detail", {
        variable_name: "detail_level",
        question: "How detailed?",
        multi_select: false,
        presentation: "radios",
        alphabetical: false,
        selected: [],
        options: [
          {
            part: "compact",
            label: "Compact",
            value: "Keep each field focused and usable (a few sentences each).",
          },
          {
            part: "rich",
            label: "Rich",
            value: "Write rich, playable fields with concrete hooks and voice.",
          },
        ],
      }),
    ],
    sections: [
      section("character_generator", "generator_prompt", {
        kind: "generator_prompt",
        name: "Generator Prompt",
        role: "system",
        group: "instructions",
        position: "ordered",
        content:
          "(No Generator Prompt was injected — select a Generator Preset.)",
      }),
      section("character_generator", "generator_brief", {
        kind: "generator_brief",
        name: "Generator Brief",
        role: "system",
        group: "instructions",
        position: "ordered",
        content:
          "(No Generator Brief was provided — invent a coherent character consistent with existing card fields, persona, and Reference Characters.)",
      }),
      section("character_generator", "persona", {
        kind: "persona",
        name: "Requester Persona",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: "",
      }),
      section("character_generator", "reference_characters", {
        kind: "reference_characters",
        name: "Reference Characters",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: "",
      }),
      section("character_generator", "user", {
        kind: "prompt_block",
        name: "Generate Request",
        role: "user",
        group: "instructions",
        position: "ordered",
        content: `Generate "{{target_field}}" (mode={{generation_mode || field}}).

Follow the Generator Prompt output rules for this mode. Output only valid JSON.`,
      }),
    ],
  },

  {
    key: "persona_generator",
    name: "Default Persona Generator",
    description:
      "Structural template for player personas: markers + output request. Writing rules live in the linked Generator Preset.",
    wrap_format: "xml",
    category: "persona_generator" satisfies PresetCategory,
    is_default: true,
    author: AUTHOR,
    groups: ["instructions", "request"],
    variables: [
      languageVariable("persona_generator"),
      variable("persona_generator", "focus", {
        variable_name: "persona_focus",
        question: "What should the persona emphasize?",
        multi_select: false,
        presentation: "radios",
        alphabetical: false,
        selected: [],
        options: [
          {
            part: "balanced",
            label: "Balanced",
            value: "Balance appearance, background, and personality evenly.",
          },
          {
            part: "personality",
            label: "Personality-first",
            value: "Emphasize voice, motives, and interpersonal style.",
          },
          {
            part: "appearance",
            label: "Appearance-first",
            value: "Emphasize physical description and presentation.",
          },
          {
            part: "backstory",
            label: "Backstory-first",
            value: "Emphasize history, role in the world, and relationships.",
          },
        ],
      }),
    ],
    sections: [
      section("persona_generator", "generator_prompt", {
        kind: "generator_prompt",
        name: "Generator Prompt",
        role: "system",
        group: "instructions",
        position: "ordered",
        content:
          "(No Generator Prompt was injected — select a Generator Preset.)",
      }),
      section("persona_generator", "generator_brief", {
        kind: "generator_brief",
        name: "Generator Brief",
        role: "system",
        group: "instructions",
        position: "ordered",
        content:
          "(No Generator Brief was provided — invent a coherent persona that complements the Reference Characters.)",
      }),
      section("persona_generator", "reference_characters", {
        kind: "reference_characters",
        name: "Reference Characters",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: "",
      }),
      section("persona_generator", "user", {
        kind: "prompt_block",
        name: "Generate Request",
        role: "user",
        group: "request",
        position: "ordered",
        content: `Generate "{{target_field}}" for persona "{{user || (unnamed)}}".

Follow the Generator Prompt output rules. Output only valid JSON.`,
      }),
    ],
  },

  {
    key: "lorebook_generator",
    name: "Default Lorebook Generator",
    description:
      "Structural template for lorebook JSON: markers + output request. Entry rules live in the linked Generator Preset.",
    wrap_format: "xml",
    category: "lorebook_generator" satisfies PresetCategory,
    is_default: true,
    author: AUTHOR,
    groups: ["instructions"],
    variables: [
      languageVariable("lorebook_generator"),
      variable("lorebook_generator", "scope", {
        variable_name: "entry_scope",
        question: "How many entries?",
        multi_select: false,
        presentation: "radios",
        alphabetical: false,
        selected: [],
        options: [
          {
            part: "few",
            label: "Few (3–5)",
            value: "Produce 3–5 high-value entries covering the core concepts.",
          },
          {
            part: "standard",
            label: "Standard (6–10)",
            value: "Produce 6–10 entries spanning people, places, factions, and rules as relevant.",
          },
          {
            part: "dense",
            label: "Dense (10–16)",
            value: "Produce 10–16 entries with finer-grained concepts; avoid near-duplicates.",
          },
        ],
      }),
      variable("lorebook_generator", "depth", {
        variable_name: "entry_depth",
        question: "Entry depth?",
        multi_select: false,
        presentation: "radios",
        alphabetical: false,
        selected: [],
        options: [
          {
            part: "brief",
            label: "Brief",
            value: "Keep each content field to ~2–4 sentences of dense facts.",
          },
          {
            part: "playable",
            label: "Playable",
            value:
              "Write playable lore: concrete facts the model can inject when keywords match (~1 short paragraph each).",
          },
        ],
      }),
    ],
    sections: [
      section("lorebook_generator", "generator_prompt", {
        kind: "generator_prompt",
        name: "Generator Prompt",
        role: "system",
        group: "instructions",
        position: "ordered",
        content:
          "(No Generator Prompt was injected — select a Generator Preset.)",
      }),
      section("lorebook_generator", "generator_brief", {
        kind: "generator_brief",
        name: "Generator Brief",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: "",
      }),
      section("lorebook_generator", "character_info", {
        kind: "character_info",
        name: "Related Character (optional)",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: "",
      }),
      section("lorebook_generator", "user", {
        kind: "prompt_block",
        name: "Generate Request",
        role: "user",
        group: "instructions",
        position: "ordered",
        content: `Create the lorebook from the Generator Brief (and Related Character if present).

Follow the Generator Prompt output rules. Output only valid JSON.`,
      }),
    ],
  },

  {
    key: "twatter_refresh",
    name: "Default Twatter Refresh",
    description:
      "Structural template for Twatter timeline batches: markers + output request. Site rules live in the linked Generator Preset.",
    wrap_format: "xml",
    category: "twatter_refresh" satisfies PresetCategory,
    is_default: true,
    author: AUTHOR,
    groups: ["instructions"],
    variables: [languageVariable("twatter_refresh")],
    sections: [
      section("twatter_refresh", "generator_prompt", {
        kind: "generator_prompt",
        name: "Generator Prompt",
        role: "system",
        group: "instructions",
        position: "ordered",
        content:
          "(No Generator Prompt was injected — select a Generator Preset.)",
      }),
      section("twatter_refresh", "generator_brief", {
        kind: "generator_brief",
        name: "Timeline Brief",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: "",
      }),
      section("twatter_refresh", "user", {
        kind: "prompt_block",
        name: "Refresh Request",
        role: "user",
        group: "instructions",
        position: "ordered",
        content: `Generate one batch of Twatter timeline activity from the Timeline Brief above.

Follow the Generator Prompt output rules. Output only valid JSON.`,
      }),
    ],
  },

  {
    key: "chat_summary",
    name: "Default Chat Summary",
    description:
      "Rolling roleplay summary: append only NEW durable events as JSON { summary }.",
    wrap_format: "xml",
    category: "chat_summary" satisfies PresetCategory,
    is_default: true,
    author: AUTHOR,
    groups: ["instructions"],
    variables: [],
    sections: [
      section("chat_summary", "system", {
        kind: "prompt_block",
        name: "Summary System",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: `You are Automatic Chat Summary. Summarize only NEW durable roleplay events not already captured in the existing summary.
Focus on plot turns, character developments, relationships, current situation, locations, quests, goals, threats, and unresolved tension.
Write an appendable continuation. Do not rewrite or repeat the previous summary. If nothing durable changed, return an empty summary. Match the existing summary style.
Return only valid JSON:
{
  "summary": "new summary text to append, or empty string"
}`,
      }),
      section("chat_summary", "chat_summary", {
        kind: "chat_summary",
        name: "Previous Summary",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: "",
      }),
      section("chat_summary", "chat_history", {
        kind: "chat_history",
        name: "Recent Conversation",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: "",
      }),
      section("chat_summary", "user", {
        kind: "prompt_block",
        name: "Summarize Request",
        role: "user",
        group: "instructions",
        position: "ordered",
        content: `Using the previous summary and recent conversation above, produce the JSON summary append. Output only valid JSON.`,
      }),
    ],
  },

  {
    key: "image",
    name: "Default Image",
    description:
      "Structural template for image prompts: markers + output request. Style rules live in the linked Generator Preset.",
    wrap_format: "xml",
    category: "image" satisfies PresetCategory,
    is_default: true,
    author: AUTHOR,
    groups: ["instructions", "request"],
    variables: [
      variable("image", "style", {
        variable_name: "image_style",
        question: "Visual style?",
        multi_select: false,
        presentation: "radios",
        alphabetical: false,
        selected: ["anime"],
        options: [
          {
            part: "anime",
            label: "Anime",
            value:
              "Style: clean anime / illustration look, expressive eyes, soft shading, polished linework. NOT photorealistic, NOT a real photograph.",
          },
          {
            part: "realistic",
            label: "Photorealistic",
            value:
              "Style: photorealistic, natural lighting, detailed skin and fabric texture, cinematic composition.",
          },
          {
            part: "painterly",
            label: "Painterly",
            value:
              "Style: digital painting, visible brushwork, rich color, atmospheric depth. Not a photograph.",
          },
          {
            part: "comic",
            label: "Comic / Cel",
            value:
              "Style: comic / cel-shaded, bold outlines, graphic color blocks, dynamic posing. Not photorealistic.",
          },
        ],
      }),
      variable("image", "framing", {
        variable_name: "image_framing",
        question: "Framing?",
        multi_select: false,
        presentation: "radios",
        alphabetical: false,
        selected: ["portrait"],
        options: [
          {
            part: "portrait",
            label: "Portrait",
            value: "Framing: head-and-shoulders portrait, subject-focused.",
          },
          {
            part: "half",
            label: "Half body",
            value: "Framing: waist-up / half-body shot.",
          },
          {
            part: "full",
            label: "Full body",
            value: "Framing: full-body shot with clear silhouette.",
          },
          {
            part: "scene",
            label: "Scene",
            value:
              "Framing: environmental scene — subject plus meaningful background.",
          },
        ],
      }),
    ],
    sections: [
      section("image", "generator_prompt", {
        kind: "generator_prompt",
        name: "Generator Prompt",
        role: "system",
        group: "instructions",
        position: "ordered",
        content:
          "(No Generator Prompt was injected — select a Generator Preset.)",
      }),
      section("image", "generator_brief", {
        kind: "generator_brief",
        name: "Image Brief",
        role: "system",
        group: "instructions",
        position: "ordered",
        content:
          "(No Image Brief was provided — invent pose/setting/lighting that fits the Character / Persona Appearance above.)",
      }),
      section("image", "character_info", {
        kind: "character_info",
        name: "Character",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: "",
      }),
      section("image", "persona", {
        kind: "persona",
        name: "Persona",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: "",
      }),
      section("image", "user", {
        kind: "prompt_block",
        name: "Prompt Request",
        role: "user",
        group: "request",
        position: "ordered",
        content: `Write the image prompt from the Image Brief and Appearance markers above.

Follow the Generator Prompt output rules. Output only valid JSON.`,
      }),
    ],
  },
];
