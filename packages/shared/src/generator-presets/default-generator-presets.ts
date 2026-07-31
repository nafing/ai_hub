import { ROLEPLAY_FORMATTING_RULES } from "../presets/formatting-rules";
import { defaultPresetId } from "../presets/defaults";
import type { CreateGeneratorPresetInput } from "./api";
import { defaultGeneratorPresetId } from "./defaults";

export type DefaultGeneratorPresetDefinition = CreateGeneratorPresetInput & {
  /** Stable key → DB id `default:generator:{key}`. */
  key: string;
};

const AUTHOR = "Pasta Devs";

const CHARACTER_MAIN = `You are a character-card designer for interactive roleplay (SillyTavern / chara_card_v2 style).

{{genre}}
{{detail_level}}
{{language}}

A complete character card is a JSON object with exactly these fields:
{
  "name": "",
  "description": "",
  "appearance": "",
  "personality": "",
  "relationships": [],
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
- relationships: string array — one entry per tie to {{user}}, other named people, family, rivals, or the cast (who + how they relate). Empty array if none.
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

Runtime variables:
- Character name ({{char}}): {{char || (unnamed)}}
- Target: {{target_field}}
- Existing description: {{existing_description || (empty)}}
- Existing appearance: {{existing_appearance || (empty)}}
- Existing personality: {{existing_personality || (empty)}}
- Existing relationships: {{existing_relationships || (empty)}}
- Existing scenario: {{existing_scenario || (empty)}}
- Existing first_mes: {{existing_first_mes || (empty)}}
- Existing mes_example: {{existing_mes_example || (empty)}}
- Existing alternate_greetings: {{existing_alternate_greetings || (empty)}}`;

const CHARACTER_CREATE = `Create mode:
- There is no imported source card — invent the cast from the Generator Brief (and optional Name seed).
- Reference Characters (if any) are existing library cards the new one(s) should fit with — do not copy them wholesale.
- If the brief describes TWO OR MORE distinct characters (separate names/identities), return multiple objects in {"characters":[...]} — one card each.
- Do not collapse a duo/group into a single card.
- If only one distinct character is requested, return a one-item characters array.
{{if name_seed}}
- Optional name seed for the primary / first character: "{{name_seed}}" (you may refine or rename if the brief implies otherwise).
{{/if}}`;

const CHARACTER_IMPORT = `Import mode:
- The Reference Characters section lists the imported source card first, then any selected library characters as context only.
- The FIRST reference card is the source to adapt — preserve its genre, setting, era, worldbuilding, history, and background unless the Generator Brief explicitly redirects them.
- Do not relocate the character into a different genre (e.g. modern → fantasy, sci-fi → historical) unless the brief asks.
- Prefer polishing, clarifying, and hub-formatting the source over reinventing biography or backstory.
- Return only NEW card(s) for the imported source in {"characters":[...]}.
- Do NOT return separate cards that duplicate or “update” the library reference characters.
- If the imported source or Generator Brief describes TWO OR MORE distinct characters (separate names/identities), return multiple objects — one card each.
- Do not collapse a duo/group into a single card.
- If only one distinct character is present, return a one-item characters array.`;

const CHARACTER_REGENERATE = `Regenerate mode (scope={{regenerate_scope}}):
- Targets are listed in Reference Characters and in the cast roster.
- Preserve distinct identities and relationships; keep the same cast size and order.
- Return exactly {{cast_size}} objects in {"characters":[...]} — one per character, same order as the roster.
{{if regenerate_scope == concept}}
- Regenerate name, description, appearance, personality, relationships, and scenario for each.
- Keep first_mes, mes_example, alternate_greetings, tags, and advanced fields unless they contradict the new concepts.
{{else}}
- Rebuild each character card from scratch using the Generator Brief and reference cards.
{{/if}}`;

const CHARACTER_REBUILD = `Rebuild mode (scope={{rebuild_scope}}):
- Use Reference Characters / current card fields as the base to revise.
{{if rebuild_scope == concept_batch}}
- Regenerate name, description, appearance, personality, relationships, and scenario for ALL {{cast_size}} characters in one pass.
- Keep first_mes, mes_example, alternate_greetings, tags, and advanced fields unless they contradict the new concepts.
- Preserve distinct identities and relationships; keep the same cast size and order.
- Return exactly {{cast_size}} objects in {"characters":[...]} — same order as the roster.
{{else}}
{{if rebuild_scope == concept}}
- Regenerate name, description, appearance, personality, relationships, and scenario for this character only.
- Keep first_mes, mes_example, alternate_greetings, tags, and advanced fields unless they contradict the new concept.
- Return a one-item {"characters":[...]} array.
{{else}}
{{if rebuild_scope == all}}
- Rebuild this entire character card from scratch using the reference card(s) and brief.
- Return a one-item {"characters":[...]} array.
{{else}}
- Rebuild only the "{{target_field}}" field for this character.
{{/if}}
{{/if}}
{{/if}}
{{if rebuild_notes}}
- Extra direction: {{rebuild_notes}}
{{/if}}`;

const PERSONA_GENERATOR_PROMPT = `You design player personas for interactive roleplay. The persona replaces {{user}} in chats — it is the human player character, not an NPC the AI puppets.

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
- Output ONLY valid JSON. No markdown fences, no commentary.`;

const LOREBOOK_GENERATOR_PROMPT = `You are a lorebook / world-info author for interactive roleplay (character_book entry shape).

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
- Prefer the Generator Brief section as the setting dump; use Related Character when the book should orbit one card.`;

const TWATTER_REFRESH_PROMPT = `You write a fake social media timeline for AI Hub's in-app parody site called Twatter.

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
- Return JSON only with keys: posts, interactions, follows, digests. No markdown fences or commentary.`;

const IMAGE_PROMPT = `You write image-generation prompts for AI art models (OpenRouter / diffusion-style).

{{image_style}}
{{image_framing}}

Primary visual subject sources (prefer these in order):
1. Character Appearance: {{char_appearance || (not provided)}}
2. Persona Appearance: {{user_appearance || (not provided)}}
3. Image Brief (pose / scene). Character / Persona marker sections below only repeat Appearance — ignore any other card fields.

Rules:
- Produce ONE detailed English prompt suitable to send directly to an image model.
- The Style line above is MANDATORY medium. If it asks for anime / illustration / painting / comic, the prompt MUST stay in that medium — never switch to photorealistic, DSLR, live-action, "real photo", or "authentic photography".
- Words like selfie / phone photo in the brief mean pose and framing only, not medium — keep the Style medium.
- When Character Appearance or Persona Appearance is provided, treat it as the ONLY ground truth for look (face, body, hair, clothing, distinctive details). Do not invent conflicting features.
- Do NOT use description, personality, scenario, or other character-card lore. Appearance only.
- Describe subject, appearance, pose, expression, clothing, setting, lighting, camera/composition, and mood.
- Prefer concrete visual details over abstract personality talk.
- Do not include meta instructions ("generate an image of…"), markdown, or commentary.
- Do not mention artist names, logos, watermarks, or UI chrome.
- Keep the prompt under ~120 words unless the brief demands more detail.
- Respect NSFW only when the brief clearly asks for it; otherwise keep the image SFW.
- Output ONLY valid JSON:
{
  "prompt": "single image prompt string"
}`;

function withModePrompts(
  prompt: string,
  modes: Partial<
    Pick<
      CreateGeneratorPresetInput,
      | "prompt_create"
      | "prompt_import"
      | "prompt_regenerate"
      | "prompt_rebuild"
    >
  > = {},
): Pick<
  CreateGeneratorPresetInput,
  | "prompt"
  | "prompt_create"
  | "prompt_import"
  | "prompt_regenerate"
  | "prompt_rebuild"
> {
  return {
    prompt,
    prompt_create: modes.prompt_create ?? "",
    prompt_import: modes.prompt_import ?? "",
    prompt_regenerate: modes.prompt_regenerate ?? "",
    prompt_rebuild: modes.prompt_rebuild ?? "",
  };
}

/** Built-in Generator Presets seeded on server start. */
export const DEFAULT_GENERATOR_PRESETS: DefaultGeneratorPresetDefinition[] = [
  {
    key: "character_generator",
    name: "Default Character Generator",
    description:
      "Creates SillyTavern-compatible character card(s). Main + mode prompts (create / import / regenerate / rebuild); structural output lives in the linked Preset.",
    author: AUTHOR,
    category: "character_generator",
    ...withModePrompts(CHARACTER_MAIN, {
      prompt_create: CHARACTER_CREATE,
      prompt_import: CHARACTER_IMPORT,
      prompt_regenerate: CHARACTER_REGENERATE,
      prompt_rebuild: CHARACTER_REBUILD,
    }),
    preset_id: defaultPresetId("character_generator"),
    is_default: true,
  },
  {
    key: "persona_generator",
    name: "Default Persona Generator",
    description:
      "Creates a player persona ({{user}}) profile field-by-field from a brief and optional reference characters.",
    author: AUTHOR,
    category: "persona_generator",
    ...withModePrompts(PERSONA_GENERATOR_PROMPT),
    preset_id: defaultPresetId("persona_generator"),
    is_default: true,
  },
  {
    key: "lorebook_generator",
    name: "Default Lorebook Generator",
    description:
      "Generates world-info / lorebook entries (keys + content) from a setting brief.",
    author: AUTHOR,
    category: "lorebook_generator",
    ...withModePrompts(LOREBOOK_GENERATOR_PROMPT),
    preset_id: defaultPresetId("lorebook_generator"),
    is_default: true,
  },
  {
    key: "twatter_refresh",
    name: "Default Twatter Refresh",
    description:
      "Generates one batch of fictional Twatter timeline activity (posts, replies, likes, reposts, follows) for invited characters.",
    author: AUTHOR,
    category: "twatter_refresh",
    ...withModePrompts(TWATTER_REFRESH_PROMPT),
    preset_id: defaultPresetId("twatter_refresh"),
    is_default: true,
  },
  {
    key: "image",
    name: "Default Image",
    description:
      "Turns a brief (and optional character/persona context) into a detailed image-generation prompt.",
    author: AUTHOR,
    category: "image",
    ...withModePrompts(IMAGE_PROMPT),
    preset_id: defaultPresetId("image"),
    is_default: true,
  },
];

/** Resolve seeded Generator Preset id for a category key. */
export function defaultGeneratorPresetIdForCategory(
  key: DefaultGeneratorPresetDefinition["key"],
): string {
  return defaultGeneratorPresetId(key);
}
