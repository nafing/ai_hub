import type { CreatePresetInput } from "./api";
import type { PresetCategory, Section, Variable } from "./types";
import { defaultPresetId } from "./defaults";
import {
  NSFW_CONTENT_RULES,
  NSFW_WRITING_RULES,
  ROLEPLAY_FORMATTING_RULES,
  ROLEPLAY_FORMATTING_REMINDER,
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
      "Creates SillyTavern-compatible character card(s). Modes via generation_mode: create, import, regenerate, rebuild, or field generate (default).",
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
      section("character_generator", "system", {
        kind: "prompt_block",
        name: "Generator System",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: `You are a character-card designer for interactive roleplay (SillyTavern / chara_card_v2 style).

{{genre}}
{{detail_level}}
{{language}}

A complete character card is a JSON object with exactly these fields:
{
  "name": "",
  "description": "",
  "appearance": "",
  "personality": "",
  "scenario": "",
  "first_mes": "",
  "mes_example": "",
  "creator_notes": "",
  "system_prompt": "",
  "post_history_instructions": "",
  "tags": [],
  "alternate_greetings": []
}

Field guidance:
- name: display name (may include titles).
- description: background, role, presence, and durable facts the model should know (not a full visual inventory).
- appearance: physical look and visual presentation — face, body, hair, clothing, distinctive details (useful for image prompts).
- personality: traits, speech patterns, values, flaws, boundaries.
- scenario: default scene setup with {{user}} and {{char}}.
- first_mes: opening beat in-character (narration + quoted speech); may use {{user}} / {{char}}.
- mes_example: 1–3 short exchanges; after {{user}}: / {{char}}: prefixes, use quoted dialogue and *italic* thoughts in the line body.
- creator_notes: OOC tips for the human player (not injected as lore).
- system_prompt: optional extra in-character directives; empty string if none.
- post_history_instructions: optional jailbreak/UJB-style reminders; empty if none.
- tags: short genre/trope tags.
- alternate_greetings: 0–3 alternate first messages.

${ROLEPLAY_FORMATTING_RULES}

Use this markup in first_mes, mes_example, and every alternate_greetings entry.

Multi-character detection (when generating full cards / all card fields):
- Read the Generator Brief AND any Reference Characters section.
- If either clearly describes TWO OR MORE distinct characters (duo, siblings, rivals, a named party, multiple proper names with separate identities, "X and Y", etc.), output one complete card per character.
- Do NOT collapse multiple people into a single card.
- If the source is about ONE character (or a single focus with unnamed extras), output exactly one card.
- Shared world: keep scenarios and relationships consistent across related cards; each first_mes should work as that character's opening.

Rules:
- Output ONLY valid JSON. No markdown fences, no commentary.
- Prefer original, specific details over generic tropes unless the brief demands them.
- Keep each card consistent: personality must match first_mes and mes_example voice.
- Use the Generator Brief as the primary concept; Persona is the player; Reference Characters are existing cards the new one(s) should fit with.
- Generate exactly what {{target_field}} asks for.
- Keep consistency with existing card fields that are not empty when editing a single character.

{{if generation_mode == create}}
Create mode:
- There is no imported source card — invent the cast from the Generator Brief.
- Reference Characters (if any) are existing library cards the new one(s) should fit with — do not copy them wholesale.
{{if name_seed}}
- Optional name seed for the primary / first character: "{{name_seed}}" (you may refine or rename if the brief implies otherwise).
{{/if}}
{{/if}}

{{if generation_mode == import}}
Import mode:
- The Reference Characters section lists the imported source card first, then any selected library characters as context.
- Output ONLY new card(s) for the imported source (characters being imported).
- Do NOT output copies or “updated” cards of the selected library references — they are context only and must not become extra new characters.
- Split or refine using the imported source (and brief). If TWO OR MORE distinct characters are present in the import, return one card each; if only one, return a one-item characters array.
{{/if}}

{{if generation_mode == regenerate}}
Regenerate mode (scope={{regenerate_scope}}):
- Targets are listed in Reference Characters and in the cast roster.
- Preserve distinct identities and relationships; keep the same cast size and order.
{{if regenerate_scope == concept}}
- Regenerate name, description, appearance, personality, and scenario for each.
- Keep first_mes, mes_example, alternate_greetings, tags, and advanced fields unless they contradict the new concepts.
{{else}}
- Rebuild each character card from scratch using the Generator Brief and reference cards.
{{/if}}
{{/if}}

{{if generation_mode == rebuild}}
Rebuild mode (scope={{rebuild_scope}}):
- Use Reference Characters / current card fields as the base to revise.
{{if rebuild_notes}}
- Extra direction: {{rebuild_notes}}
{{/if}}
{{/if}}

Runtime variables:
- Character name ({{char}}): {{char || (unnamed)}}
- Target: {{target_field}}
- Existing description: {{existing_description || (empty)}}
- Existing appearance: {{existing_appearance || (empty)}}
- Existing personality: {{existing_personality || (empty)}}
- Existing scenario: {{existing_scenario || (empty)}}
- Existing first_mes: {{existing_first_mes || (empty)}}
- Existing mes_example: {{existing_mes_example || (empty)}}
- Existing alternate_greetings: {{existing_alternate_greetings || (empty)}}`,
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
        content: `Generate "{{target_field}}".

{{if generation_mode == import}}
IMPORT WITH AI.

The Reference Characters section lists the imported source card first, then any selected library characters as context only.

Return only NEW card(s) for the imported source in {"characters":[...]}.
Do NOT return separate cards that duplicate or “update” the library reference characters.

If the imported source or Generator Brief describes TWO OR MORE distinct characters (separate names/identities), return multiple objects — one card each.
Do not collapse a duo/group into a single card.
If only one distinct character is present, return a one-item characters array.

Working name hint (may be one of several): {{char || (unnamed — may be one of several)}}
Each array item must be a complete card:
{ "name":"...", "description":"...", "appearance":"...", "personality":"...", "scenario":"...", "first_mes":"...", "mes_example":"...", "creator_notes":"...", "system_prompt":"", "post_history_instructions":"", "tags":[], "alternate_greetings":[] }
{{else}}
{{if generation_mode == create}}
CREATE WITH AI.

Build one or more new character cards from the Generator Brief (and optional Name seed).
There is no imported source card — invent the cast from the brief.
Reference Characters (if any) are existing library cards the new one(s) should fit with — do not copy them wholesale.

If the brief describes TWO OR MORE distinct characters (separate names/identities), you MUST return multiple objects in {"characters":[...]} — one card each.
Do not collapse a duo/group into a single card.
If only one distinct character is requested, return a one-item characters array.

{{if name_seed}}
Optional name seed for the primary / first character: "{{name_seed}}" (you may refine or rename if the brief implies otherwise).
{{/if}}

Working name hint (may be one of several): {{char || (unnamed — invent from brief; may be one of several)}}
Each array item must be a complete card:
{ "name":"...", "description":"...", "appearance":"...", "personality":"...", "scenario":"...", "first_mes":"...", "mes_example":"...", "creator_notes":"...", "system_prompt":"", "post_history_instructions":"", "tags":[], "alternate_greetings":[] }
{{else}}
{{if generation_mode == regenerate}}
{{if regenerate_scope == concept}}
REGENERATE CONCEPT for ALL {{cast_size}} selected characters in one pass.
Regenerate name, description, appearance, personality, and scenario for each.
Keep first_mes, mes_example, alternate_greetings, tags, and advanced fields unless they contradict the new concepts.
{{else}}
REGENERATE FULL CARD for ALL {{cast_size}} selected characters in one pass.
Rebuild each character card from scratch using the Generator Brief and reference cards.
{{/if}}
Preserve distinct identities and relationships; keep the same cast size and order.
Current roster (same order expected in output):
{{cast_roster}}
Return exactly {{cast_size}} objects in {"characters":[...]} — one per character, same order.
{{else}}
{{if generation_mode == rebuild}}
{{if rebuild_scope == concept_batch}}
REBUILD CONCEPT for ALL {{cast_size}} characters in one pass.
Regenerate name, description, appearance, personality, and scenario for each.
Keep first_mes, mes_example, alternate_greetings, tags, and advanced fields unless they contradict the new concepts.
Preserve distinct identities and relationships between characters; keep the same cast size and order.
Current roster (same order expected in output):
{{cast_roster}}
Return exactly {{cast_size}} objects in {"characters":[...]} — one per character, same order.
{{else}}
{{if rebuild_scope == concept}}
REBUILD CONCEPT only for this character: regenerate name, description, appearance, personality, and scenario.
Keep first_mes, mes_example, alternate_greetings, tags, and advanced fields unless they contradict the new concept.
Return a one-item {"characters":[...]} array.
{{else}}
{{if rebuild_scope == all}}
REBUILD this entire character card from scratch using the reference card(s) and brief.
Return a one-item {"characters":[...]} array.
{{else}}
Rebuild only the "{{target_field}}" field for this character.
{{/if}}
{{/if}}
{{/if}}
{{if rebuild_notes}}
Extra direction: {{rebuild_notes}}
{{/if}}
{{else}}
{{if target_field == all card fields}}
Inspect the Generator Brief and Reference Characters for how many distinct characters to create.

If ONE character: return
{"characters":[{ "name":"...", "description":"...", "appearance":"...", "personality":"...", "scenario":"...", "first_mes":"...", "mes_example":"...", "creator_notes":"...", "system_prompt":"", "post_history_instructions":"", "tags":[], "alternate_greetings":[] }]}

If TWO OR MORE distinct characters (named separately in the brief or reference card): return one full card object per character — never merge them into one:
{"characters":[ { /* character 1 */ }, { /* character 2 */ } ]}

Working name hint (may be one of several): {{char || (unnamed)}}
Each array item must be a complete card with all keys listed above.
{{else}}
{{if target_field == alternate_greetings}}
Return JSON for the single character "{{char || (unnamed)}}" only:
{"alternate_greetings":["greeting 1","greeting 2"]}
${ROLEPLAY_FORMATTING_REMINDER}
{{else}}
{{if target_field == first_mes}}
Return JSON for the single character "{{char || (unnamed)}}" only (one key):
{ "{{target_field}}": "..." }
${ROLEPLAY_FORMATTING_REMINDER}
{{else}}
{{if target_field == mes_example}}
Return JSON for the single character "{{char || (unnamed)}}" only (one key):
{ "{{target_field}}": "..." }
${ROLEPLAY_FORMATTING_REMINDER}
{{else}}
Return JSON for the single character "{{char || (unnamed)}}" only (one key):
{ "{{target_field}}": "..." }
{{/if}}
{{/if}}
{{/if}}
{{/if}}
{{/if}}
{{/if}}
{{/if}}
{{/if}}`,
      }),
    ],
  },

  {
    key: "persona_generator",
    name: "Default Persona Generator",
    description:
      "Creates a player persona ({{user}}) profile field-by-field from a brief and optional reference characters.",
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
      section("persona_generator", "system", {
        kind: "prompt_block",
        name: "Generator System",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: `You design player personas for interactive roleplay. The persona replaces {{user}} in chats — it is the human player character, not an NPC the AI puppets.

{{persona_focus}}
{{language}}

Runtime variables (filled by the hub when generating):
- Persona name: {{user || (unnamed)}}
- Target field to write: {{target_field}}
- Existing description: {{existing_description || (empty)}}
- Existing appearance: {{existing_appearance || (empty)}}
- Existing personality: {{existing_personality || (empty)}}

Use the Generator Brief and Reference Characters marker sections below as primary context.

Field meanings:
- description: background, role, and durable facts other characters would notice (not a full visual inventory).
- appearance: physical look and visual presentation — face, body, hair, clothing, distinctive details (useful for image prompts).
- personality: traits, speech habits, goals, soft limits the player wants respected.

Rules:
- Generate exactly what {{target_field}} asks for (one field, or description+appearance+personality when requested together).
- Keep consistency with any existing field that is not empty (overwrite only what was requested).
- Write in second or third person about the player character, never as an AI assistant.
- Do not invent NSFW content the brief did not imply.
- Keep the persona playable: clear hooks, not a novel.
- Output ONLY valid JSON. No markdown fences, no commentary.`,
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

{{if target_field == description, appearance, and personality}}
Return JSON with these keys:
{"description":"...","appearance":"...","personality":"..."}
{{else}}
Return JSON with only that key:
{ "{{target_field}}": "..." }
{{/if}}`,
      }),
    ],
  },

  {
    key: "lorebook_generator",
    name: "Default Lorebook Generator",
    description:
      "Generates world-info / lorebook entries (keys + content) from a setting brief.",
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
      section("lorebook_generator", "system", {
        kind: "prompt_block",
        name: "Generator System",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: `You are a lorebook / world-info author for interactive roleplay (character_book entry shape).

{{entry_scope}}
{{entry_depth}}
{{language}}

When the user describes a setting, faction, character roster, or lore dump, output a single JSON object:
{
  "name": "Lorebook title",
  "description": "Short summary of what this book covers",
  "entries": [
    {
      "keys": ["PrimaryKeyword", "Alias"],
      "secondary_keys": [],
      "content": "Facts injected when keys match.",
      "comment": "Optional editor note",
      "enabled": true,
      "constant": false,
      "selective": false,
      "insertion_order": 100,
      "position": "before_char",
      "case_sensitive": false
    }
  ]
}

Rules:
- Output ONLY valid JSON. No markdown fences, no commentary.
- keys: 1–5 distinctive trigger phrases (names, places, items). Prefer specific proper nouns over generic words.
- content: third-person encyclopedic facts. No player instructions. No {{user}}/{{char}} unless essential.
- Use constant:true only for always-on world rules that must always inject.
- Use selective:true with secondary_keys when an entry should fire only if a secondary cue also appears.
- insertion_order: lower numbers insert earlier; keep related entries clustered (e.g. 100, 110, 120).
- position: "before_char" for background lore, "after_char" for scene-local reminders.
- Do not invent contradictory canon; if the brief is vague, invent coherent placeholders and stay consistent across entries.
- Prefer the Generator Brief section as the setting dump; use Related Character when the book should orbit one card.`,
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
        content: `Create a lorebook JSON object from the Generator Brief (and Related Character if present). Output only the JSON object.`,
      }),
    ],
  },

  {
    key: "twatter_refresh",
    name: "Default Twatter Refresh",
    description:
      "Generates one batch of fictional Twatter timeline activity (posts, replies, likes, reposts, follows) for invited characters.",
    wrap_format: "xml",
    category: "twatter_refresh" satisfies PresetCategory,
    is_default: true,
    author: AUTHOR,
    groups: ["instructions"],
    variables: [languageVariable("twatter_refresh")],
    sections: [
      section("twatter_refresh", "system", {
        kind: "prompt_block",
        name: "Twatter System",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: `You write a fake social media timeline for AI Hub's in-app parody site called Twatter.

{{language}}

Rules:
- Structured actions are limited to posts, polls, follows, likes, reposts, replies, and poll votes.
- Generated interactions may target existing posts included in the Timeline Brief or posts you create in this response.
- When a character responds to an existing post or to a post created earlier in this same JSON batch, use an interaction with type "reply" and non-empty content. Do NOT create a new top-level post for a reply.
- To reply to a post you create in this batch, set targetTempId to that post's tempId and targetPostId to null.
- To reply to an existing timeline post, set targetPostId to its exact postId from the Timeline Brief and targetTempId to null.
- To respond directly to an existing comment, create a reply interaction for its post and set parentInteractionId to that comment's exact interactionId from the Timeline Brief.
- Never generate posts, replies, likes, reposts, poll votes, or follows as a persona account. Personas may only be mentioned or targeted by other accounts.
- Every persona account is a separate user identity.
- Never reuse the same message text for more than one post or reply by the same account.
- For each interaction, set either targetTempId or targetPostId and set the unused target field to null.
- pollOptionIndex must be a zero-based integer for votes and null for every other interaction.
- An exact @handle in post or reply text tags that active account.
- Characters should post like real people online — funny, messy, petty, affectionate, or dramatic as fits their bio.
- Return JSON only with keys: posts, interactions, follows, digests. No markdown fences or commentary.`,
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

Output only a JSON object:
{"posts":[{"tempId":"p1","authorHandle":"@name","content":"..."}],"interactions":[{"actorHandle":"@name","targetTempId":"p1","targetPostId":null,"type":"reply","content":"...","pollOptionIndex":null},{"actorHandle":"@name","targetPostId":"existing-post-id","targetTempId":null,"type":"like","pollOptionIndex":null}],"follows":[{"actorHandle":"@name","targetHandle":"@other"}],"digests":[{"accountEntityIds":["character-id"],"content":"short summary"}]}`,
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
      "Turns a brief (and optional character/persona context) into a detailed image-generation prompt.",
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
      section("image", "system", {
        kind: "prompt_block",
        name: "Image Prompt System",
        role: "system",
        group: "instructions",
        position: "ordered",
        content: `You write image-generation prompts for AI art models (OpenRouter / diffusion-style).

{{image_style}}
{{image_framing}}

Primary visual subject sources (prefer these in order):
1. Character Appearance: {{char_appearance || (not provided)}}
2. Persona Appearance: {{user_appearance || (not provided)}}
3. Image Brief + Character / Persona marker sections below.

Rules:
- Produce ONE detailed English prompt suitable to send directly to an image model.
- The Style line above is MANDATORY medium. If it asks for anime / illustration / painting / comic, the prompt MUST stay in that medium — never switch to photorealistic, DSLR, live-action, "real photo", or "authentic photography".
- Words like selfie / phone photo in the brief mean pose and framing only, not medium — keep the Style medium.
- When Character Appearance or Persona Appearance is provided, treat it as ground truth for look (face, body, hair, clothing, distinctive details). Do not invent conflicting features.
- Use Description / Personality only as light supporting context — never let them override Appearance.
- Describe subject, appearance, pose, expression, clothing, setting, lighting, camera/composition, and mood.
- Prefer concrete visual details over abstract personality talk.
- Do not include meta instructions ("generate an image of…"), markdown, or commentary.
- Do not mention artist names, logos, watermarks, or UI chrome.
- Keep the prompt under ~120 words unless the brief demands more detail.
- Respect NSFW only when the brief clearly asks for it; otherwise keep the image SFW.
- Output ONLY valid JSON:
{
  "prompt": "single image prompt string"
}`,
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
        content: `Write the image prompt.

Ground the subject look in Character Appearance / Persona Appearance when present. Use the Image Brief for pose and scene. Obey Style/Framing exactly (medium from Style is non-negotiable).

Output only:
{"prompt":"..."}`,
      }),
    ],
  },
];
