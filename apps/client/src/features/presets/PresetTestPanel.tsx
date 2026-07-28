import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { IconPlayerPlay } from "@tabler/icons-react";
import {
  buildPresetPromptContext,
  buildPromptMessages,
  CHAT_PRESET_CATEGORIES,
  CHAT_SUMMARY_PRESET_CATEGORIES,
  PRESET_CATEGORY_LABELS,
  substituteVariables,
  type LlmChatMessage,
  type CreatePresetInput,
  type PresetCategory,
  type PresetVariableValues,
} from "@ai-hub/shared";
import {
  Button,
  Textarea,
  Accordion,
  MultiSelect,
  Select,
  TextInput,
  notifications,
  RuntimeText,
} from "@/components/ui";
import { useConnections } from "@/features/connections/queries";
import { getCharacter } from "@/features/characters/api";
import { useCharacter, useCharacters } from "@/features/characters/queries";
import { getLorebook } from "@/features/lorebooks/api";
import { lorebookKeys, useLorebooks } from "@/features/lorebooks/queries";
import { usePersona, usePersonas } from "@/features/personas/queries";
import { useTestPreset } from "./queries";
import type { TestPresetResult } from "./api";
import classes from "./PresetTestPanel.module.css";

type PresetTestPanelProps = {
  presetId: string;
  values: CreatePresetInput;
  /** From Setup Variables — used for preview + test run substitution. */
  variableValues: PresetVariableValues;
};

function isChatCategory(category: PresetCategory): boolean {
  return (CHAT_PRESET_CATEGORIES as readonly PresetCategory[]).includes(
    category,
  );
}

function isChatSummaryCategory(category: PresetCategory): boolean {
  return (CHAT_SUMMARY_PRESET_CATEGORIES as readonly PresetCategory[]).includes(
    category,
  );
}

function usesChatHistoryMarkers(category: PresetCategory): boolean {
  return isChatCategory(category) || isChatSummaryCategory(category);
}

function isGeneratorCategory(category: PresetCategory): boolean {
  return (
    category === "character_generator" ||
    category === "persona_generator" ||
    category === "lorebook_generator"
  );
}

function usesReferenceCharacters(category: PresetCategory): boolean {
  return category === "persona_generator" || category === "character_generator";
}

const PERSONA_TARGET_FIELDS = [
  {
    value: "description and personality",
    label: "description and personality",
  },
  { value: "description", label: "description" },
  { value: "personality", label: "personality" },
];

const CHARACTER_TARGET_FIELDS = [
  { value: "all card fields", label: "all card fields" },
  { value: "description", label: "description" },
  { value: "personality", label: "personality" },
  { value: "scenario", label: "scenario" },
  { value: "first_mes", label: "first_mes" },
  { value: "mes_example", label: "mes_example" },
  { value: "alternate_greetings", label: "alternate_greetings" },
];

function defaultTargetField(category: PresetCategory): string {
  if (category === "character_generator") return "all card fields";
  if (category === "persona_generator") return "description and personality";
  return "description";
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={classes.field}>
      <span className={classes.fieldLabel}>{label}</span>
      {hint ? <span className={classes.fieldHint}>{hint}</span> : null}
      {children}
      {error ? <span className={classes.fieldError}>{error}</span> : null}
    </div>
  );
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
  const [targetField, setTargetField] = useState<string>(
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
      next.existing_description = existingDescription.trim();
      next.existing_personality = existingPersonality.trim();
    }

    if (category === "character_generator") {
      if (charNameOverride.trim()) {
        next.char = charNameOverride.trim();
      }
      if (targetField) next.target_field = targetField;
      next.existing_description = existingDescription.trim();
      next.existing_personality = existingPersonality.trim();
      next.existing_scenario = existingScenario.trim();
      next.existing_first_mes = existingFirstMes.trim();
      next.existing_mes_example = existingMesExample.trim();
      next.existing_alternate_greetings = existingAlternateGreetings.trim();
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
          category === "persona_generator" || category === "character_generator"
            ? null
            : (characterQuery.data ?? null),
        persona:
          category === "persona_generator" ? null : (personaQuery.data ?? null),
        variables: runtimeVariables,
        generatorBrief: isGeneratorCategory(category)
          ? generatorBrief || null
          : null,
        referenceCharacterList: usesReferenceCharacters(category)
          ? referenceCharacters
          : null,
        lorebooks: isChatCategory(category) ? lorebooks : null,
        chatHistory: usesChatHistoryMarkers(category)
          ? chatHistory || null
          : null,
        chatSummary: usesChatHistoryMarkers(category)
          ? chatSummary || null
          : null,
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
  }, [values.wrap_format, values.sections, promptContext, userMessage]);

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

  const connectionError = connectionsQuery.isError
    ? "Failed to load connections"
    : !connectionsQuery.isLoading && !connectionsQuery.data?.length
      ? "Create a connection first"
      : undefined;

  return (
    <div className={classes.stack}>
      <p className={classes.muted}>
        Test the current (unsaved) draft as a {categoryLabel} preset. Controls
        below match this category&apos;s markers and placeholders (same context
        as Generate with AI where applicable).
      </p>

      <div className={`${classes.grid} ${classes.grid2}`}>
        <Field
          label="Connection"
          hint="Defaults to the active connection."
          error={connectionError}
        >
          <Select
            placeholder={
              connectionsQuery.isLoading
                ? "Loading connections…"
                : "Default connection"
            }
            data={(connectionsQuery.data ?? []).map((connection) => ({
              value: connection.id,
              label: `${connection.name || "Untitled"}${connection.is_default ? " (default)" : ""}${connection.model ? ` · ${connection.model}` : ""}`,
            }))}
            value={resolvedConnectionId ?? ""}
            onChange={setConnectionId}
            searchable
            disabled={!connectionsQuery.data?.length}
            error={Boolean(connectionError)}
          />
        </Field>

        {category === "persona_generator" ? (
          <Field label="Persona name" hint={<RuntimeText text="Fills {{user}}." />}>
            <TextInput
              value={personaNameOverride}
              onChange={(event) =>
                setPersonaNameOverride(event.currentTarget.value)
              }
              placeholder="Test persona"
            />
          </Field>
        ) : (
          <Field
            label="Persona"
            hint={<RuntimeText text="Fills {{user}} and the Persona marker." />}
            error={
              personasQuery.isError ? "Failed to load personas" : undefined
            }
          >
            <Select
              placeholder={
                personasQuery.isLoading ? "Loading personas…" : "Select persona"
              }
              data={(personasQuery.data ?? []).map((persona) => ({
                value: persona.id,
                label: `${persona.name || "untitled"}${persona.is_default ? " (default)" : ""}`,
              }))}
              value={personaId ?? ""}
              onChange={(value) => setPersonaId(value || null)}
              searchable
              clearable
              disabled={!personasQuery.data?.length}
              error={personasQuery.isError}
            />
          </Field>
        )}

        {category === "character_generator" ? (
          <Field label="Character name" hint={<RuntimeText text="Fills {{char}}." />}>
            <TextInput
              value={charNameOverride}
              onChange={(event) =>
                setCharNameOverride(event.currentTarget.value)
              }
              placeholder="Test character"
            />
          </Field>
        ) : null}

        {category === "persona_generator" ? (
          <Field label="Target field" hint={<RuntimeText text="Fills {{target_field}}." />}>
            <Select
              data={PERSONA_TARGET_FIELDS}
              value={targetField}
              onChange={setTargetField}
            />
          </Field>
        ) : null}

        {category === "character_generator" ? (
          <Field label="Target field" hint={<RuntimeText text="Fills {{target_field}}." />}>
            <Select
              data={CHARACTER_TARGET_FIELDS}
              value={targetField}
              onChange={setTargetField}
              searchable
            />
          </Field>
        ) : null}

        {category === "lorebook_generator" || isChatCategory(category) ? (
          <Field
            label="Character"
            hint={
              category === "lorebook_generator" ? (
                "Fills Character Info (optional related card)."
              ) : (
                <RuntimeText text="Fills {{char}}, Character Info, and Dialogue Examples." />
              )
            }
            error={
              charactersQuery.isError ? "Failed to load characters" : undefined
            }
          >
            <Select
              placeholder={
                charactersQuery.isLoading
                  ? "Loading characters…"
                  : "Select character"
              }
              data={characterOptions}
              value={characterId ?? ""}
              onChange={(value) => setCharacterId(value || null)}
              searchable
              clearable
              disabled={!charactersQuery.data?.length}
              error={charactersQuery.isError}
            />
          </Field>
        ) : null}

        {usesReferenceCharacters(category) ? (
          <Field
            label="Reference characters"
            hint="Fills the Reference Characters marker."
            error={
              charactersQuery.isError ? "Failed to load characters" : undefined
            }
          >
            <MultiSelect
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
              error={charactersQuery.isError}
            />
          </Field>
        ) : null}

        {isChatCategory(category) ? (
          <Field
            label="Lorebooks"
            hint="Fills Lorebook markers (enabled entries)."
            error={
              lorebooksQuery.isError ? "Failed to load lorebooks" : undefined
            }
          >
            <MultiSelect
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
              error={lorebooksQuery.isError}
            />
          </Field>
        ) : null}
      </div>

      {isGeneratorCategory(category) ? (
        <Field label="Generator brief" hint="Fills the Generator Brief marker.">
          <Textarea
            className={classes.textarea}
            value={generatorBrief}
            onChange={(event) => setGeneratorBrief(event.currentTarget.value)}
            placeholder="Concept / setting dump for the generator…"
          />
        </Field>
      ) : null}

      {category === "persona_generator" ? (
        <div className={`${classes.grid} ${classes.grid2}`}>
          <Field
            label="Existing description"
            hint={<RuntimeText text="Fills {{existing_description}}." />}
          >
            <Textarea
              className={classes.textarea}
              value={existingDescription}
              onChange={(event) =>
                setExistingDescription(event.currentTarget.value)
              }
              placeholder="(none yet)"
            />
          </Field>
          <Field
            label="Existing personality"
            hint={<RuntimeText text="Fills {{existing_personality}}." />}
          >
            <Textarea
              className={classes.textarea}
              value={existingPersonality}
              onChange={(event) =>
                setExistingPersonality(event.currentTarget.value)
              }
              placeholder="(none yet)"
            />
          </Field>
        </div>
      ) : null}

      {category === "character_generator" ? (
        <Accordion>
          <Accordion.Item value="existing">
            <Accordion.Control>
              Existing card fields (optional)
            </Accordion.Control>
            <Accordion.Panel>
              <div className={classes.stack}>
                <div className={`${classes.grid} ${classes.grid2}`}>
                  <Field
                    label="Existing description"
                    hint={<RuntimeText text="Fills {{existing_description}}." />}
                  >
                    <Textarea
                      className={classes.textarea}
                      value={existingDescription}
                      onChange={(event) =>
                        setExistingDescription(event.currentTarget.value)
                      }
                      placeholder="(none yet)"
                    />
                  </Field>
                  <Field
                    label="Existing personality"
                    hint={<RuntimeText text="Fills {{existing_personality}}." />}
                  >
                    <Textarea
                      className={classes.textarea}
                      value={existingPersonality}
                      onChange={(event) =>
                        setExistingPersonality(event.currentTarget.value)
                      }
                      placeholder="(none yet)"
                    />
                  </Field>
                  <Field
                    label="Existing scenario"
                    hint={<RuntimeText text="Fills {{existing_scenario}}." />}
                  >
                    <Textarea
                      className={classes.textarea}
                      value={existingScenario}
                      onChange={(event) =>
                        setExistingScenario(event.currentTarget.value)
                      }
                      placeholder="(none yet)"
                    />
                  </Field>
                  <Field
                    label="Existing first_mes"
                    hint={<RuntimeText text="Fills {{existing_first_mes}}." />}
                  >
                    <Textarea
                      className={classes.textarea}
                      value={existingFirstMes}
                      onChange={(event) =>
                        setExistingFirstMes(event.currentTarget.value)
                      }
                      placeholder="(none yet)"
                    />
                  </Field>
                  <Field
                    label="Existing mes_example"
                    hint={<RuntimeText text="Fills {{existing_mes_example}}." />}
                  >
                    <Textarea
                      className={classes.textarea}
                      value={existingMesExample}
                      onChange={(event) =>
                        setExistingMesExample(event.currentTarget.value)
                      }
                      placeholder="(none yet)"
                    />
                  </Field>
                  <Field
                    label="Existing alternate greetings"
                    hint={<RuntimeText text="Fills {{existing_alternate_greetings}}." />}
                  >
                    <Textarea
                      className={classes.textarea}
                      value={existingAlternateGreetings}
                      onChange={(event) =>
                        setExistingAlternateGreetings(event.currentTarget.value)
                      }
                      placeholder="(none yet)"
                    />
                  </Field>
                </div>
              </div>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      ) : null}

      {usesChatHistoryMarkers(category) ? (
        <div className={`${classes.grid} ${classes.grid2}`}>
          <Field label="Chat summary" hint="Fills the Chat Summary marker.">
            <Textarea
              className={classes.textarea}
              value={chatSummary}
              onChange={(event) => setChatSummary(event.currentTarget.value)}
              placeholder="Earlier arc summary…"
            />
          </Field>
          <Field label="Chat history" hint="Fills the Chat History marker.">
            <Textarea
              className={classes.textarea}
              value={chatHistory}
              onChange={(event) => setChatHistory(event.currentTarget.value)}
              placeholder={"{{user}}: …\n{{char}}: …"}
            />
          </Field>
        </div>
      ) : null}

      <Field
        label="Extra user message"
        hint={
          isGeneratorCategory(category) ? (
            "Optional — appended after the preset (many generators already include a user section)."
          ) : (
            <RuntimeText text="Appended after the preset prompt as a user turn. Supports {{user}} / {{char}}." />
          )
        }
      >
        <Textarea
          className={classes.textarea}
          value={userMessage}
          onChange={(event) => setUserMessage(event.currentTarget.value)}
        />
      </Field>

      <div>
        <Button
          type="button"
          variant="primary"
          leftSection={<IconPlayerPlay size={16} />}
          loading={testMutation.isPending}
          onClick={() => void handleRun()}
          disabled={!resolvedConnectionId || testMutation.isPending}
        >
          {testMutation.isPending ? "Running…" : "Run test"}
        </Button>
      </div>

      <Accordion defaultValue="preview">
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
              <span className={classes.resultControl}>
                Result
                {result.model ? (
                  <span className={classes.badge}>{result.model}</span>
                ) : null}
              </span>
            </Accordion.Control>
            <Accordion.Panel>
              <div className={classes.stack}>
                {result.thinking ? (
                  <div className={classes.block}>
                    <span className={classes.blockTitle}>Thinking</span>
                    <pre className={classes.code}>{result.thinking}</pre>
                  </div>
                ) : null}
                <div className={classes.block}>
                  <span className={classes.blockTitle}>Reply</span>
                  <pre className={classes.code}>
                    <RuntimeText
                      as="span"
                      text={result.content || result.reply || "(empty)"}
                    />
                  </pre>
                </div>
                {result.finishReason ? (
                  <p className={classes.finishReason}>
                    finish_reason: {result.finishReason}
                  </p>
                ) : null}
              </div>
            </Accordion.Panel>
          </Accordion.Item>
        ) : null}
      </Accordion>
    </div>
  );
}

function MessageList({ messages }: { messages: LlmChatMessage[] }) {
  if (messages.length === 0) {
    return (
      <p className={classes.muted}>
        No messages yet. Add sections or a user message.
      </p>
    );
  }

  return (
    <div className={classes.messageList}>
      {messages.map((message, index) => (
        <div key={`${message.role}-${index}`} className={classes.block}>
          <span className={`${classes.badge} ${classes.badgeOutline}`}>
            {message.role}
          </span>
          <pre className={classes.code}>
            <RuntimeText as="span" text={message.content} />
          </pre>
        </div>
      ))}
    </div>
  );
}
