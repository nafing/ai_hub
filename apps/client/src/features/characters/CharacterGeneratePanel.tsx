import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Group,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSparkles } from "@tabler/icons-react";
import {
  buildPresetPromptContext,
  defaultCharacter,
  type PresetVariableValues,
  type Variable,
} from "@ai-hub/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useConnections } from "@/features/connections/queries";
import { createCharacter, getCharacter } from "@/features/characters/api";
import { characterKeys, useCharacters } from "@/features/characters/queries";
import { AlternateGreetingsEditor } from "@/features/characters/AlternateGreetingsEditor";
import {
  extractFullCards,
  formatAlternateGreetingsForPrompt,
  resolvePresetVariables,
  stripCodeFence,
  type ExtractedCharacterCard,
} from "@/features/characters/characterGenerateShared";
import { getPersona } from "@/features/personas/api";
import { usePersonas } from "@/features/personas/queries";
import { runGenerator } from "@/features/generators/api";
import {
  useDefaultPreset,
  usePreset,
  usePresets,
} from "@/features/presets/queries";

export type CharacterCardGenerateField =
  | "description"
  | "personality"
  | "scenario"
  | "first_mes"
  | "mes_example"
  | "alternate_greetings"
  | "all";

const TARGET_FIELD_ALL = "all card fields";

const STRING_CARD_FIELDS = [
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
] as const;

type StringCardField = (typeof STRING_CARD_FIELDS)[number];

type CharacterGeneratePanelProps = {
  characterName: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  alternateGreetings: string[];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPersonalityChange: (value: string) => void;
  onScenarioChange: (value: string) => void;
  onFirstMesChange: (value: string) => void;
  onMesExampleChange: (value: string) => void;
  onAlternateGreetingsChange: (value: string[]) => void;
};

function targetFieldValue(field: CharacterCardGenerateField): string {
  return field === "all" ? TARGET_FIELD_ALL : field;
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

function extractGeneratedCard(
  raw: string,
  field: CharacterCardGenerateField,
): ExtractedCharacterCard {
  const text = stripCodeFence(raw);
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not object");
    }
    const record = parsed as Record<string, unknown>;
    if (field === "alternate_greetings") {
      const greetings = asStringArray(record.alternate_greetings);
      return greetings ? { alternate_greetings: greetings } : {};
    }
    const value = asString(record[field]);
    return value ? { [field]: value } : {};
  } catch {
    if (field === "alternate_greetings") return {};
    return { [field]: text };
  }
}

function buildGeneratorVariables(options: {
  field: CharacterCardGenerateField;
  characterName: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  alternateGreetings: string[];
  presetVariables: Variable[];
}): PresetVariableValues {
  return {
    ...resolvePresetVariables(options.presetVariables),
    char: options.characterName.trim() || "(unnamed)",
    target_field: targetFieldValue(options.field),
    existing_description: options.description.trim() || "(none yet)",
    existing_personality: options.personality.trim() || "(none yet)",
    existing_scenario: options.scenario.trim() || "(none yet)",
    existing_first_mes: options.first_mes.trim() || "(none yet)",
    existing_mes_example: options.mes_example.trim() || "(none yet)",
    existing_alternate_greetings: formatAlternateGreetingsForPrompt(
      options.alternateGreetings,
    ),
  };
}

export function CharacterGeneratePanel({
  characterName,
  description,
  personality,
  scenario,
  first_mes,
  mes_example,
  alternateGreetings,
  onNameChange,
  onDescriptionChange,
  onPersonalityChange,
  onScenarioChange,
  onFirstMesChange,
  onMesExampleChange,
  onAlternateGreetingsChange,
}: CharacterGeneratePanelProps) {
  const queryClient = useQueryClient();
  const connectionsQuery = useConnections();
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const presetsQuery = usePresets();
  const defaultPresetQuery = useDefaultPreset("character_generator");

  const defaultConnectionId =
    connectionsQuery.data?.find((connection) => connection.is_default)?.id ??
    connectionsQuery.data?.[0]?.id ??
    null;

  const defaultPersonaId =
    personasQuery.data?.find((persona) => persona.is_default)?.id ?? null;

  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [presetInitialized, setPresetInitialized] = useState(false);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [personaInitialized, setPersonaInitialized] = useState(false);
  const [referenceCharacterIds, setReferenceCharacterIds] = useState<string[]>(
    [],
  );
  const [brief, setBrief] = useState("");
  const [pendingField, setPendingField] =
    useState<CharacterCardGenerateField | null>(null);

  useEffect(() => {
    if (presetInitialized) return;
    if (defaultPresetQuery.data?.id) {
      setPresetId(defaultPresetQuery.data.id);
      setPresetInitialized(true);
      return;
    }
    if (defaultPresetQuery.isError || defaultPresetQuery.isSuccess) {
      const fallback = (presetsQuery.data ?? []).find(
        (preset) => preset.category === "character_generator",
      );
      if (fallback) {
        setPresetId(fallback.id);
        setPresetInitialized(true);
      } else if (presetsQuery.isSuccess || presetsQuery.isError) {
        setPresetInitialized(true);
      }
    }
  }, [
    presetInitialized,
    defaultPresetQuery.data,
    defaultPresetQuery.isError,
    defaultPresetQuery.isSuccess,
    presetsQuery.data,
    presetsQuery.isSuccess,
    presetsQuery.isError,
  ]);

  useEffect(() => {
    if (personaInitialized || !personasQuery.data) return;
    if (defaultPersonaId) setPersonaId(defaultPersonaId);
    setPersonaInitialized(true);
  }, [personaInitialized, personasQuery.data, defaultPersonaId]);

  const resolvedConnectionId = connectionId ?? defaultConnectionId;
  const presetDetailQuery = usePreset(presetId ?? undefined);

  const presetOptions = useMemo(() => {
    const characterPresets = (presetsQuery.data ?? []).filter(
      (preset) => preset.category === "character_generator",
    );
    const list =
      characterPresets.length > 0
        ? characterPresets
        : (presetsQuery.data ?? []);
    return list.map((preset) => ({
      value: preset.id,
      label: `${preset.name || "untitled"}${preset.is_default ? " (default)" : ""}${preset.category !== "character_generator" ? ` · ${preset.category}` : ""}`,
    }));
  }, [presetsQuery.data]);

  const characterOptions = useMemo(
    () =>
      (charactersQuery.data ?? []).map((character) => ({
        value: character.id,
        label: character.name || character.id,
      })),
    [charactersQuery.data],
  );

  function applyExtracted(extracted: ExtractedCharacterCard) {
    if (extracted.name) onNameChange(extracted.name);
    if (extracted.description) onDescriptionChange(extracted.description);
    if (extracted.personality) onPersonalityChange(extracted.personality);
    if (extracted.scenario) onScenarioChange(extracted.scenario);
    if (extracted.first_mes) onFirstMesChange(extracted.first_mes);
    if (extracted.mes_example) onMesExampleChange(extracted.mes_example);
    if (extracted.alternate_greetings) {
      onAlternateGreetingsChange(extracted.alternate_greetings);
    }
  }

  async function persistExtraCharacters(cards: ExtractedCharacterCard[]) {
    if (cards.length === 0) return [] as string[];
    const createdNames: string[] = [];
    for (const card of cards) {
      const name = card.name?.trim() || "Generated character";
      await createCharacter(
        defaultCharacter({
          data: {
            name,
            description: card.description ?? "",
            personality: card.personality ?? "",
            scenario: card.scenario ?? "",
            first_mes: card.first_mes ?? "",
            mes_example: card.mes_example ?? "",
            creator_notes: card.creator_notes ?? "",
            system_prompt: card.system_prompt ?? "",
            post_history_instructions: card.post_history_instructions ?? "",
            tags: card.tags ?? [],
            alternate_greetings: card.alternate_greetings ?? [],
          },
        }),
      );
      createdNames.push(name);
    }
    void queryClient.invalidateQueries({ queryKey: characterKeys.list() });
    return createdNames;
  }

  async function handleGenerate(field: CharacterCardGenerateField) {
    if (!resolvedConnectionId) {
      notifications.show({
        title: "No connection",
        message: "Select a connection first.",
        color: "red",
      });
      return;
    }

    const preset = presetDetailQuery.data;
    if (!presetId || !preset) {
      notifications.show({
        title: "No preset",
        message: "Select a Character Generator preset first.",
        color: "red",
      });
      return;
    }

    setPendingField(field);
    try {
      const [persona, referenceCharacters] = await Promise.all([
        personaId ? getPersona(personaId) : Promise.resolve(null),
        Promise.all(referenceCharacterIds.map((id) => getCharacter(id))),
      ]);
      const promptContext = buildPresetPromptContext({
        generatorBrief:
          brief.trim() ||
          "(no brief — invent a coherent character consistent with existing card fields, persona, and reference characters)",
        persona,
        referenceCharacterList: referenceCharacters,
        variables: buildGeneratorVariables({
          field,
          characterName,
          description,
          personality,
          scenario,
          first_mes,
          mes_example,
          alternateGreetings,
          presetVariables: preset.variables,
        }),
      });

      const result = await runGenerator({
        category: "character_generator",
        connectionId: resolvedConnectionId,
        presetId: preset.id,
        variables: promptContext.variables,
        markers: promptContext.markers,
      });

      const raw = result.content || result.reply || "";

      if (field === "all") {
        const cards = extractFullCards(raw);
        if (cards.length === 0) {
          throw new Error("Model returned an empty result");
        }
        const [first, ...rest] = cards;
        applyExtracted(first!);
        const createdNames = await persistExtraCharacters(rest);
        if (createdNames.length > 0) {
          notifications.show({
            title: `Generated ${cards.length} characters`,
            message: `Applied “${first!.name || characterName || "current"}” to this form. Created: ${createdNames.join(", ")}. Save this form to keep the first card.`,
            color: "green",
          });
        } else {
          notifications.show({
            title: "Generated",
            message: "Card fields updated — save the character to keep it.",
            color: "green",
          });
        }
      } else if (field === "alternate_greetings") {
        const extracted = extractGeneratedCard(raw, field);
        if (!extracted.alternate_greetings?.length) {
          throw new Error("Model returned an empty result");
        }
        applyExtracted(extracted);
        notifications.show({
          title: "Generated",
          message:
            "Alternate greetings updated — save the character to keep it.",
          color: "green",
        });
      } else {
        const extracted = extractGeneratedCard(raw, field);
        const value = extracted[field];
        if (!value) throw new Error("Model returned an empty result");
        applyExtracted({ [field]: value });
        const labels: Record<
          Exclude<CharacterCardGenerateField, "all">,
          string
        > = {
          description: "Description",
          personality: "Personality",
          scenario: "Scenario",
          first_mes: "First message",
          mes_example: "Example messages",
          alternate_greetings: "Alternate greetings",
        };
        notifications.show({
          title: "Generated",
          message: `${labels[field]} updated — save the character to keep it.`,
          color: "green",
        });
      }
    } catch (error) {
      notifications.show({
        title: "Generate failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setPendingField(null);
    }
  }

  const generateDisabled =
    pendingField != null ||
    !resolvedConnectionId ||
    !presetId ||
    presetDetailQuery.isLoading;

  const fieldRows: Array<{
    field: StringCardField;
    label: string;
    description: string;
    value: string;
    onChange: (value: string) => void;
    minRows: number;
  }> = [
    {
      field: "description",
      label: "Description",
      description: "Main character definition / appearance / lore.",
      value: description,
      onChange: onDescriptionChange,
      minRows: 4,
    },
    {
      field: "personality",
      label: "Personality",
      description: "Traits / voice — same field as Card.",
      value: personality,
      onChange: onPersonalityChange,
      minRows: 3,
    },
    {
      field: "scenario",
      label: "Scenario",
      description: "Default scene setup — same field as Card.",
      value: scenario,
      onChange: onScenarioChange,
      minRows: 3,
    },
    {
      field: "first_mes",
      label: "First message",
      description: "Opening greeting (first_mes).",
      value: first_mes,
      onChange: onFirstMesChange,
      minRows: 4,
    },
    {
      field: "mes_example",
      label: "Example messages",
      description: "Dialogue examples (mes_example).",
      value: mes_example,
      onChange: onMesExampleChange,
      minRows: 4,
    },
  ];

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Uses the selected Character Generator preset. If the brief describes
        multiple distinct characters, Generate all card fields applies the first
        to this form and creates the rest as new characters. Remember to Save
        the current form after generating.
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Select
          label="Connection"
          description="Defaults to the active connection."
          placeholder={
            connectionsQuery.isLoading
              ? "Loading connections…"
              : "Select connection"
          }
          data={(connectionsQuery.data ?? []).map((connection) => ({
            value: connection.id,
            label: `${connection.name || "Untitled"}${connection.is_default ? " (default)" : ""}${connection.model ? ` · ${connection.model}` : ""}`,
          }))}
          value={resolvedConnectionId}
          onChange={setConnectionId}
          searchable
          clearable={false}
          allowDeselect={false}
          disabled={!connectionsQuery.data?.length}
          error={
            connectionsQuery.isError
              ? "Failed to load connections"
              : !connectionsQuery.isLoading && !connectionsQuery.data?.length
                ? "Create a connection first"
                : undefined
          }
        />
        <Select
          label="Preset"
          description="Prefer presets in the Character Generator category."
          placeholder={
            presetsQuery.isLoading ? "Loading presets…" : "Select preset"
          }
          data={presetOptions}
          value={presetId}
          onChange={setPresetId}
          searchable
          clearable={false}
          allowDeselect={false}
          disabled={!presetOptions.length}
          error={
            presetsQuery.isError
              ? "Failed to load presets"
              : presetDetailQuery.isError
                ? "Failed to load preset details"
                : !presetsQuery.isLoading && !presetOptions.length
                  ? "No presets available"
                  : undefined
          }
        />
        <Select
          label="Persona"
          description="Optional — fills `{{user}}` and the Persona marker."
          placeholder={
            personasQuery.isLoading ? "Loading personas…" : "Select persona"
          }
          data={(personasQuery.data ?? []).map((persona) => ({
            value: persona.id,
            label: `${persona.name || "untitled"}${persona.is_default ? " (default)" : ""}`,
          }))}
          value={personaId}
          onChange={setPersonaId}
          searchable
          clearable
          disabled={!personasQuery.data?.length}
          error={personasQuery.isError ? "Failed to load personas" : undefined}
        />

        <MultiSelect
          label="Reference characters"
          description="Fills the Reference Characters marker."
          placeholder={
            charactersQuery.isLoading
              ? "Loading characters…"
              : "Select characters"
          }
          clearable
          data={characterOptions}
          value={referenceCharacterIds}
          onChange={setReferenceCharacterIds}
          disabled={!characterOptions.length}
          error={
            charactersQuery.isError ? "Failed to load characters" : undefined
          }
        />
      </SimpleGrid>

      <Textarea
        label="Generator brief"
        description="Fills the Generator Brief marker — the character concept."
        autosize
        minRows={4}
        value={brief}
        onChange={(event) => setBrief(event.currentTarget.value)}
        placeholder="e.g. A soft-spoken clockmaker who repairs forbidden automata; dry wit, ink-stained hands…"
      />

      <Group justify="flex-end">
        <Button
          size="xs"
          variant="light"
          leftSection={<IconSparkles size={14} />}
          loading={pendingField === "all"}
          disabled={generateDisabled}
          onClick={() => void handleGenerate("all")}
        >
          Generate all card fields
        </Button>
      </Group>

      {fieldRows.map((row) => (
        <Stack key={row.field} gap="xs">
          <Group justify="space-between" align="flex-end" wrap="nowrap">
            <Text size="sm" fw={500}>
              {row.label}
            </Text>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconSparkles size={14} />}
              loading={pendingField === row.field}
              disabled={generateDisabled}
              onClick={() => void handleGenerate(row.field)}
            >
              Generate
            </Button>
          </Group>
          <Textarea
            description={row.description}
            autosize
            minRows={row.minRows}
            value={row.value}
            onChange={(event) => row.onChange(event.currentTarget.value)}
          />
        </Stack>
      ))}

      <AlternateGreetingsEditor
        value={alternateGreetings}
        onChange={onAlternateGreetingsChange}
        minRows={4}
        action={
          <Button
            size="xs"
            variant="light"
            leftSection={<IconSparkles size={14} />}
            loading={pendingField === "alternate_greetings"}
            disabled={generateDisabled}
            onClick={() => void handleGenerate("alternate_greetings")}
          >
            Generate
          </Button>
        }
      />
    </Stack>
  );
}
