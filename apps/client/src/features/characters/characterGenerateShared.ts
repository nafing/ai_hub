import type {
  CharacterCardData,
  PresetVariableValues,
  Variable,
} from "@ai-hub/shared";

export type ExtractedCharacterCard = {
  name?: string;
  description?: string;
  appearance?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  tags?: string[];
  alternate_greetings?: string[];
};

export function resolvePresetVariables(
  variables: Variable[],
): PresetVariableValues {
  const out: PresetVariableValues = {};
  for (const variable of variables) {
    const name = variable.variable_name.trim();
    if (!name) continue;
    const resolved = (variable.selected ?? [])
      .map((selected) => {
        const match = variable.options.find(
          (option) =>
            option.value === selected ||
            option.id === selected ||
            option.id.endsWith(`:${selected}`),
        );
        return match?.value ?? selected;
      })
      .filter(Boolean);
    if (resolved.length === 0) continue;
    out[name] = variable.multi_select ? resolved : resolved[0]!;
  }
  return out;
}

export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
  if (typeof value === "string" && value.trim()) {
    const items = value
      .split(/\n-{3,}\n/)
      .map((part) => part.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

/** Format greetings for generator prompt variables. Empty when none. */
export function formatAlternateGreetingsForPrompt(greetings: string[]): string {
  const cleaned = greetings.map((item) => item.trim()).filter(Boolean);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : "";
}

function cardHasContent(card: ExtractedCharacterCard): boolean {
  return Object.values(card).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  });
}

export function normalizeFullCard(
  record: Record<string, unknown>,
): ExtractedCharacterCard {
  return {
    name: asString(record.name),
    description: asString(record.description),
    appearance: asString(record.appearance),
    personality: asString(record.personality),
    scenario: asString(record.scenario),
    first_mes: asString(record.first_mes),
    mes_example: asString(record.mes_example),
    creator_notes: asString(record.creator_notes),
    system_prompt: asString(record.system_prompt),
    post_history_instructions: asString(record.post_history_instructions),
    tags: asStringArray(record.tags),
    alternate_greetings: asStringArray(record.alternate_greetings),
  };
}

/** Parse `{"characters":[...]}` , a bare array, or a legacy single card object. */
export function extractFullCards(raw: string): ExtractedCharacterCard[] {
  const text = stripCodeFence(raw);
  const parsed: unknown = JSON.parse(text);

  if (Array.isArray(parsed)) {
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
      .map(normalizeFullCard)
      .filter(cardHasContent);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Model did not return a JSON object");
  }

  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.characters)) {
    return record.characters
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
      .map(normalizeFullCard)
      .filter(cardHasContent);
  }

  const single = normalizeFullCard(record);
  return cardHasContent(single) ? [single] : [];
}

export function mergeExtractedIntoCardData(
  base: CharacterCardData,
  ai: ExtractedCharacterCard,
): CharacterCardData {
  return {
    ...base,
    ...(ai.name != null ? { name: ai.name } : {}),
    ...(ai.description != null ? { description: ai.description } : {}),
    ...(ai.appearance != null ? { appearance: ai.appearance } : {}),
    ...(ai.personality != null ? { personality: ai.personality } : {}),
    ...(ai.scenario != null ? { scenario: ai.scenario } : {}),
    ...(ai.first_mes != null ? { first_mes: ai.first_mes } : {}),
    ...(ai.mes_example != null ? { mes_example: ai.mes_example } : {}),
    ...(ai.creator_notes != null ? { creator_notes: ai.creator_notes } : {}),
    ...(ai.system_prompt != null ? { system_prompt: ai.system_prompt } : {}),
    ...(ai.post_history_instructions != null
      ? { post_history_instructions: ai.post_history_instructions }
      : {}),
    ...(ai.tags != null ? { tags: ai.tags } : {}),
    ...(ai.alternate_greetings != null
      ? { alternate_greetings: ai.alternate_greetings }
      : {}),
  };
}

export function extractedToCardData(
  ai: ExtractedCharacterCard,
): Partial<CharacterCardData> {
  return {
    name: ai.name ?? "Generated character",
    description: ai.description ?? "",
    appearance: ai.appearance ?? "",
    personality: ai.personality ?? "",
    scenario: ai.scenario ?? "",
    first_mes: ai.first_mes ?? "",
    mes_example: ai.mes_example ?? "",
    creator_notes: ai.creator_notes ?? "",
    system_prompt: ai.system_prompt ?? "",
    post_history_instructions: ai.post_history_instructions ?? "",
    tags: ai.tags ?? [],
    alternate_greetings: ai.alternate_greetings ?? [],
  };
}
