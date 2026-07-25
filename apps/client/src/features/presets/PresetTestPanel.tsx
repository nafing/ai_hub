import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  Accordion,
  Badge,
  Button,
  Code,
  Group,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlayerPlay } from "@tabler/icons-react";
import {
  buildPresetPromptContext,
  buildPromptMessages,
  PRESET_CATEGORY_LABELS,
  substituteVariables,
  type LlmChatMessage,
  type CreatePresetInput,
  type PresetCategory,
  type PresetVariableValues,
} from "@ai-hub/shared";
import { useConnections } from "@/features/connections/queries";
import { getCharacter } from "@/features/characters/api";
import { useCharacter, useCharacters } from "@/features/characters/queries";
import { getLorebook } from "@/features/lorebooks/api";
import { lorebookKeys, useLorebooks } from "@/features/lorebooks/queries";
import { usePersona, usePersonas } from "@/features/personas/queries";
import { useTestPreset } from "./queries";
import type { TestPresetResult } from "./api";

type PresetTestPanelProps = {
  presetId: string;
  values: CreatePresetInput;
  /** From Setup Variables — used for preview + test run substitution. */
  variableValues: PresetVariableValues;
};

function isChatCategory(category: PresetCategory): boolean {
  return category === "roleplay" || category === "conversation";
}

function isGeneratorCategory(category: PresetCategory): boolean {
  return (
    category === "character_generator" ||
    category === "persona_generator" ||
    category === "lorebook_generator"
  );
}

function usesReferenceCharacters(category: PresetCategory): boolean {
  return (
    category === "persona_generator" || category === "character_generator"
  );
}

const PERSONA_TARGET_FIELDS = [
  { value: "description", label: "description" },
  { value: "personality", label: "personality" },
  {
    value: "description and personality",
    label: "description and personality",
  },
];

const CHARACTER_TARGET_FIELDS = [
  { value: "description", label: "description" },
  { value: "personality", label: "personality" },
  { value: "scenario", label: "scenario" },
  { value: "first_mes", label: "first_mes" },
  { value: "mes_example", label: "mes_example" },
  { value: "alternate_greetings", label: "alternate_greetings" },
  { value: "all card fields", label: "all card fields" },
];

function defaultTargetField(category: PresetCategory): string {
  if (category === "character_generator") return "all card fields";
  if (category === "persona_generator") return "description";
  return "description";
}

export function PresetTestPanel({
  presetId,
  values,
  variableValues,
}: PresetTestPanelProps) {
  const category = values.category;
  const connectionsQuery = useConnections();
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const lorebooksQuery = useLorebooks();
  const testMutation = useTestPreset(presetId);

  const defaultConnectionId =
    connectionsQuery.data?.find((connection) => connection.is_default)?.id ??
    connectionsQuery.data?.[0]?.id ??
    null;

  const defaultPersonaId =
    personasQuery.data?.find((persona) => persona.is_default)?.id ?? null;

  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [personaInitialized, setPersonaInitialized] = useState(false);
  const [referenceCharacterIds, setReferenceCharacterIds] = useState<string[]>(
    [],
  );
  const [lorebookIds, setLorebookIds] = useState<string[]>([]);
  const [generatorBrief, setGeneratorBrief] = useState("");
  const [chatHistory, setChatHistory] = useState("");
  const [chatSummary, setChatSummary] = useState("");
  const [personaNameOverride, setPersonaNameOverride] = useState("");
  const [charNameOverride, setCharNameOverride] = useState("");
  const [targetField, setTargetField] = useState<string | null>(
    defaultTargetField(category),
  );
  const [existingDescription, setExistingDescription] = useState("");
  const [existingPersonality, setExistingPersonality] = useState("");
  const [existingScenario, setExistingScenario] = useState("");
  const [existingFirstMes, setExistingFirstMes] = useState("");
  const [existingMesExample, setExistingMesExample] = useState("");
  const [existingAlternateGreetings, setExistingAlternateGreetings] =
    useState("");
  const [userMessage, setUserMessage] = useState("");
  const [result, setResult] = useState<TestPresetResult | null>(null);

  useEffect(() => {
    setTargetField(defaultTargetField(category));
  }, [category]);

  useEffect(() => {
    if (personaInitialized || !personasQuery.data) return;
    if (defaultPersonaId) {
      setPersonaId(defaultPersonaId);
    }
    setPersonaInitialized(true);
  }, [personaInitialized, personasQuery.data, defaultPersonaId]);

  const resolvedConnectionId = connectionId ?? defaultConnectionId;
  const characterQuery = useCharacter(characterId ?? undefined);
  const personaQuery = usePersona(personaId ?? undefined);

  const referenceCharacterQueries = useQueries({
    queries: referenceCharacterIds.map((id) => ({
      queryKey: ["characters", "detail", id] as const,
      queryFn: () => getCharacter(id),
    })),
  });

  const lorebookDetailQueries = useQueries({
    queries: lorebookIds.map((id) => ({
      queryKey: lorebookKeys.detail(id),
      queryFn: () => getLorebook(id),
    })),
  });

  const referenceCharacters = useMemo(
    () =>
      referenceCharacterQueries
        .map((query) => query.data)
        .filter((character): character is NonNullable<typeof character> =>
          Boolean(character),
        ),
    [referenceCharacterQueries],
  );

  const lorebooks = useMemo(
    () =>
      lorebookDetailQueries
        .map((query) => query.data)
        .filter((book): book is NonNullable<typeof book> => Boolean(book)),
    [lorebookDetailQueries],
  );

  const runtimeVariables = useMemo((): PresetVariableValues => {
    const next: PresetVariableValues = { ...variableValues };

    if (category === "persona_generator") {
      if (personaNameOverride.trim()) {
        next.user = personaNameOverride.trim();
      }
      if (targetField) next.target_field = targetField;
      next.existing_description =
        existingDescription.trim() || "(none yet)";
      next.existing_personality =
        existingPersonality.trim() || "(none yet)";
    }

    if (category === "character_generator") {
      if (charNameOverride.trim()) {
        next.char = charNameOverride.trim();
      }
      if (targetField) next.target_field = targetField;
      next.existing_description =
        existingDescription.trim() || "(none yet)";
      next.existing_personality =
        existingPersonality.trim() || "(none yet)";
      next.existing_scenario = existingScenario.trim() || "(none yet)";
      next.existing_first_mes = existingFirstMes.trim() || "(none yet)";
      next.existing_mes_example =
        existingMesExample.trim() || "(none yet)";
      next.existing_alternate_greetings =
        existingAlternateGreetings.trim() || "(none yet)";
    }

    return next;
  }, [
    variableValues,
    category,
    personaNameOverride,
    charNameOverride,
    targetField,
    existingDescription,
    existingPersonality,
    existingScenario,
    existingFirstMes,
    existingMesExample,
    existingAlternateGreetings,
  ]);

  const promptContext = useMemo(
    () =>
      buildPresetPromptContext({
        character:
          category === "persona_generator" ||
          category === "character_generator"
            ? null
            : (characterQuery.data ?? null),
        persona:
          category === "persona_generator"
            ? null
            : (personaQuery.data ?? null),
        variables: runtimeVariables,
        generatorBrief: isGeneratorCategory(category)
          ? generatorBrief || null
          : null,
        referenceCharacterList: usesReferenceCharacters(category)
          ? referenceCharacters
          : null,
        lorebooks: isChatCategory(category) ? lorebooks : null,
        chatHistory: isChatCategory(category) ? chatHistory || null : null,
        chatSummary: isChatCategory(category) ? chatSummary || null : null,
      }),
    [
      category,
      characterQuery.data,
      personaQuery.data,
      runtimeVariables,
      generatorBrief,
      referenceCharacters,
      lorebooks,
      chatHistory,
      chatSummary,
    ],
  );

  const previewMessages = useMemo(() => {
    const promptMessages = buildPromptMessages(
      {
        wrap_format: values.wrap_format,
        sections: values.sections,
      },
      {
        variables: promptContext.variables,
        markers: promptContext.markers,
      },
    );
    const trimmed = userMessage.trim();
    const resolvedUser = trimmed
      ? substituteVariables(trimmed, promptContext.variables).trim()
      : "";
    return resolvedUser
      ? [...promptMessages, { role: "user" as const, content: resolvedUser }]
      : promptMessages;
  }, [
    values.wrap_format,
    values.sections,
    promptContext,
    userMessage,
  ]);

  async function handleRun() {
    try {
      const next = await testMutation.mutateAsync({
        connectionId: resolvedConnectionId ?? undefined,
        variables: promptContext.variables,
        markers: promptContext.markers,
        userMessage: userMessage.trim() || undefined,
        draft: {
          wrap_format: values.wrap_format,
          sections: values.sections,
        },
      });
      setResult(next);
    } catch (error) {
      const message =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "message" in error.response.data
          ? Array.isArray(error.response.data.message)
            ? error.response.data.message.join(", ")
            : String(error.response.data.message)
          : error instanceof Error
            ? error.message
            : "Unknown error";
      notifications.show({
        title: "Test failed",
        message,
        color: "red",
      });
    }
  }

  const categoryLabel = PRESET_CATEGORY_LABELS[category] ?? category;
  const characterOptions = (charactersQuery.data ?? []).map((character) => ({
    value: character.id,
    label: character.name || "untitled",
  }));

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Test the current (unsaved) draft as a {categoryLabel} preset. Controls
        below match this category&apos;s markers and placeholders (same context
        as Generate with AI where applicable).
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Select
          label="Connection"
          description="Defaults to the active connection."
          placeholder={
            connectionsQuery.isLoading
              ? "Loading connections…"
              : "Default connection"
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

        {category === "persona_generator" ? (
          <TextInput
            label="Persona name"
            description="Fills `{{user}}`."
            value={personaNameOverride}
            onChange={(event) =>
              setPersonaNameOverride(event.currentTarget.value)
            }
            placeholder="Test persona"
          />
        ) : (
          <Select
            label="Persona"
            description="Fills `{{user}}` and the Persona marker."
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
            error={
              personasQuery.isError ? "Failed to load personas" : undefined
            }
          />
        )}

        {category === "character_generator" ? (
          <TextInput
            label="Character name"
            description="Fills `{{char}}`."
            value={charNameOverride}
            onChange={(event) =>
              setCharNameOverride(event.currentTarget.value)
            }
            placeholder="Test character"
          />
        ) : null}

        {category === "persona_generator" ? (
          <Select
            label="Target field"
            description="Fills `{{target_field}}`."
            data={PERSONA_TARGET_FIELDS}
            value={targetField}
            onChange={setTargetField}
            allowDeselect={false}
          />
        ) : null}

        {category === "character_generator" ? (
          <Select
            label="Target field"
            description="Fills `{{target_field}}`."
            data={CHARACTER_TARGET_FIELDS}
            value={targetField}
            onChange={setTargetField}
            allowDeselect={false}
            searchable
          />
        ) : null}

        {category === "lorebook_generator" || isChatCategory(category) ? (
          <Select
            label="Character"
            description={
              category === "lorebook_generator"
                ? "Fills Character Info (optional related card)."
                : "Fills `{{char}}`, Character Info, and Dialogue Examples."
            }
            placeholder={
              charactersQuery.isLoading
                ? "Loading characters…"
                : "Select character"
            }
            data={characterOptions}
            value={characterId}
            onChange={setCharacterId}
            searchable
            clearable
            disabled={!charactersQuery.data?.length}
            error={
              charactersQuery.isError ? "Failed to load characters" : undefined
            }
          />
        ) : null}

        {usesReferenceCharacters(category) ? (
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
            disabled={!charactersQuery.data?.length}
            error={
              charactersQuery.isError ? "Failed to load characters" : undefined
            }
          />
        ) : null}

        {isChatCategory(category) ? (
          <MultiSelect
            label="Lorebooks"
            description="Fills Lorebook markers (enabled entries)."
            placeholder={
              lorebooksQuery.isLoading
                ? "Loading lorebooks…"
                : "Select lorebooks"
            }
            searchable
            clearable
            data={(lorebooksQuery.data ?? []).map((book) => ({
              value: book.id,
              label: `${book.name || "untitled"}${book.enabled === false ? " (disabled)" : ""}`,
            }))}
            value={lorebookIds}
            onChange={setLorebookIds}
            disabled={!lorebooksQuery.data?.length}
            error={
              lorebooksQuery.isError ? "Failed to load lorebooks" : undefined
            }
          />
        ) : null}
      </SimpleGrid>

      {isGeneratorCategory(category) ? (
        <Textarea
          label="Generator brief"
          description="Fills the Generator Brief marker."
          autosize
          minRows={3}
          value={generatorBrief}
          onChange={(event) => setGeneratorBrief(event.currentTarget.value)}
          placeholder="Concept / setting dump for the generator…"
        />
      ) : null}

      {category === "persona_generator" ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Textarea
            label="Existing description"
            description="Fills `{{existing_description}}`."
            autosize
            minRows={2}
            value={existingDescription}
            onChange={(event) =>
              setExistingDescription(event.currentTarget.value)
            }
            placeholder="(none yet)"
          />
          <Textarea
            label="Existing personality"
            description="Fills `{{existing_personality}}`."
            autosize
            minRows={2}
            value={existingPersonality}
            onChange={(event) =>
              setExistingPersonality(event.currentTarget.value)
            }
            placeholder="(none yet)"
          />
        </SimpleGrid>
      ) : null}

      {category === "character_generator" ? (
        <Accordion variant="separated">
          <Accordion.Item value="existing">
            <Accordion.Control>
              Existing card fields (optional)
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Textarea
                    label="Existing description"
                    description="Fills `{{existing_description}}`."
                    autosize
                    minRows={2}
                    value={existingDescription}
                    onChange={(event) =>
                      setExistingDescription(event.currentTarget.value)
                    }
                    placeholder="(none yet)"
                  />
                  <Textarea
                    label="Existing personality"
                    description="Fills `{{existing_personality}}`."
                    autosize
                    minRows={2}
                    value={existingPersonality}
                    onChange={(event) =>
                      setExistingPersonality(event.currentTarget.value)
                    }
                    placeholder="(none yet)"
                  />
                  <Textarea
                    label="Existing scenario"
                    description="Fills `{{existing_scenario}}`."
                    autosize
                    minRows={2}
                    value={existingScenario}
                    onChange={(event) =>
                      setExistingScenario(event.currentTarget.value)
                    }
                    placeholder="(none yet)"
                  />
                  <Textarea
                    label="Existing first_mes"
                    description="Fills `{{existing_first_mes}}`."
                    autosize
                    minRows={2}
                    value={existingFirstMes}
                    onChange={(event) =>
                      setExistingFirstMes(event.currentTarget.value)
                    }
                    placeholder="(none yet)"
                  />
                  <Textarea
                    label="Existing mes_example"
                    description="Fills `{{existing_mes_example}}`."
                    autosize
                    minRows={2}
                    value={existingMesExample}
                    onChange={(event) =>
                      setExistingMesExample(event.currentTarget.value)
                    }
                    placeholder="(none yet)"
                  />
                  <Textarea
                    label="Existing alternate greetings"
                    description="Fills `{{existing_alternate_greetings}}`."
                    autosize
                    minRows={2}
                    value={existingAlternateGreetings}
                    onChange={(event) =>
                      setExistingAlternateGreetings(
                        event.currentTarget.value,
                      )
                    }
                    placeholder="(none yet)"
                  />
                </SimpleGrid>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      ) : null}

      {isChatCategory(category) ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Textarea
            label="Chat summary"
            description="Fills the Chat Summary marker."
            autosize
            minRows={3}
            value={chatSummary}
            onChange={(event) => setChatSummary(event.currentTarget.value)}
            placeholder="Earlier arc summary…"
          />
          <Textarea
            label="Chat history"
            description="Fills the Chat History marker."
            autosize
            minRows={3}
            value={chatHistory}
            onChange={(event) => setChatHistory(event.currentTarget.value)}
            placeholder={"{{user}}: …\n{{char}}: …"}
          />
        </SimpleGrid>
      ) : null}

      <Textarea
        label="Extra user message"
        description={
          isGeneratorCategory(category)
            ? "Optional — appended after the preset (many generators already include a user section)."
            : "Appended after the preset prompt as a user turn. Supports `{{user}}` / `{{char}}`."
        }
        autosize
        minRows={2}
        value={userMessage}
        onChange={(event) => setUserMessage(event.currentTarget.value)}
      />

      <Group>
        <Button
          type="button"
          leftSection={<IconPlayerPlay size={16} />}
          onClick={() => void handleRun()}
          loading={testMutation.isPending}
          disabled={!resolvedConnectionId}
        >
          Run test
        </Button>
      </Group>

      <Accordion variant="separated" defaultValue="preview">
        <Accordion.Item value="preview">
          <Accordion.Control>
            Prompt preview ({previewMessages.length} messages)
          </Accordion.Control>
          <Accordion.Panel>
            <MessageList messages={previewMessages} />
          </Accordion.Panel>
        </Accordion.Item>

        {result ? (
          <Accordion.Item value="result">
            <Accordion.Control>
              Result
              {result.model ? (
                <Badge ml="xs" size="sm" variant="light">
                  {result.model}
                </Badge>
              ) : null}
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                {result.thinking ? (
                  <Stack gap={4}>
                    <Text size="sm" fw={600}>
                      Thinking
                    </Text>
                    <Code block style={{ whiteSpace: "pre-wrap" }}>
                      {result.thinking}
                    </Code>
                  </Stack>
                ) : null}
                <Stack gap={4}>
                  <Text size="sm" fw={600}>
                    Reply
                  </Text>
                  <Code block style={{ whiteSpace: "pre-wrap" }}>
                    {result.content || result.reply || "(empty)"}
                  </Code>
                </Stack>
                {result.finishReason ? (
                  <Text size="xs" c="dimmed">
                    finish_reason: {result.finishReason}
                  </Text>
                ) : null}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ) : null}
      </Accordion>
    </Stack>
  );
}

function MessageList({ messages }: { messages: LlmChatMessage[] }) {
  if (messages.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No messages yet. Add sections or a user message.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {messages.map((message, index) => (
        <Stack key={`${message.role}-${index}`} gap={4}>
          <Badge size="sm" variant="outline" w="fit-content">
            {message.role}
          </Badge>
          <Code block style={{ whiteSpace: "pre-wrap" }}>
            {message.content}
          </Code>
        </Stack>
      ))}
    </Stack>
  );
}
