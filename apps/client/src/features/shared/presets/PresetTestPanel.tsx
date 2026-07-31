import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { IconPlayerPlay } from "@tabler/icons-react";
import {
  buildPresetPromptContext,
  buildPromptMessages,
  CHAT_PRESET_CATEGORIES,
  CHAT_SUMMARY_PRESET_CATEGORIES,
  GENERATOR_CATEGORIES,
  GENERATOR_PRESET_PROMPT_MODES,
  PRESET_CATEGORY_LABELS,
  resolveGeneratorPresetPrompt,
  substituteVariables,
  type GeneratorCategory,
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
import { useConnectionSelectOptions } from "@/features/api-queries/connections/queries";
import { getCharacter } from "@/features/api-queries/characters/api";
import { useCharacter, useCharacters } from "@/features/api-queries/characters/queries";
import { useGeneratorPresetSelection } from "@/features/shared/generator-presets/useGeneratorPresetSelection";
import { getLorebook } from "@/features/api-queries/lorebooks/api";
import { lorebookKeys, useLorebooks } from "@/features/api-queries/lorebooks/queries";
import { usePersona, usePersonas } from "@/features/api-queries/personas/queries";
import { useTestPreset } from "@/features/api-queries/presets/queries";
import type { TestPresetResult } from "@/features/api-queries/presets/api";
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

function isGeneratorCategory(category: PresetCategory): category is GeneratorCategory {
  return (GENERATOR_CATEGORIES as readonly PresetCategory[]).includes(category);
}

function usesReferenceCharacters(category: PresetCategory): boolean {
  return category === "persona_generator" || category === "character_generator";
}

function usesCharacterCard(category: PresetCategory): boolean {
  return (
    category === "lorebook_generator" ||
    category === "image" ||
    isChatCategory(category)
  );
}

const GENERATION_MODE_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
    { value: "", label: "Field generate (main prompt only)" },
    ...GENERATOR_PRESET_PROMPT_MODES.map((mode) => ({
      value: mode,
      label: mode,
    })),
  ];

const PERSONA_TARGET_FIELDS = [
  {
    value: "description, appearance, and personality",
    label: "description, appearance, and personality",
  },
  { value: "description", label: "description" },
  { value: "appearance", label: "appearance" },
  { value: "personality", label: "personality" },
];

const CHARACTER_TARGET_FIELDS = [
  { value: "all card fields", label: "all card fields" },
  { value: "description", label: "description" },
  { value: "appearance", label: "appearance" },
  { value: "personality", label: "personality" },
  { value: "relationships", label: "relationships" },
  { value: "scenario", label: "scenario" },
  { value: "first_mes", label: "first_mes" },
  { value: "mes_example", label: "mes_example" },
  { value: "alternate_greetings", label: "alternate_greetings" },
];

function defaultTargetField(category: PresetCategory): string {
  if (category === "character_generator") return "all card fields";
  if (category === "persona_generator")
    return "description, appearance, and personality";
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
  const generatorCategory: GeneratorCategory = isGeneratorCategory(category)
    ? category
    : "character_generator";
  const connectionsQuery = useConnectionSelectOptions("llm");
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const lorebooksQuery = useLorebooks();
  const testMutation = useTestPreset(presetId);
  const generatorSelection = useGeneratorPresetSelection(generatorCategory);
  const {
    generatorPresetId,
    setGeneratorPresetId,
    generatorPreset,
    generatorPresetOptions,
    selectError: generatorPresetError,
    isListLoading: generatorListLoading,
  } = generatorSelection;

  const defaultConnectionId = connectionsQuery.defaultId || null;

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
  const [generationMode, setGenerationMode] = useState<string>("");
  const [chatHistory, setChatHistory] = useState("");
  const [chatSummary, setChatSummary] = useState("");
  const [personaNameOverride, setPersonaNameOverride] = useState("");
  const [charNameOverride, setCharNameOverride] = useState("");
  const [targetField, setTargetField] = useState<string>(
    defaultTargetField(category),
  );
  const [existingDescription, setExistingDescription] = useState("");
  const [existingAppearance, setExistingAppearance] = useState("");
  const [existingPersonality, setExistingPersonality] = useState("");
  const [existingRelationships, setExistingRelationships] = useState("");
  const [existingScenario, setExistingScenario] = useState("");
  const [existingFirstMes, setExistingFirstMes] = useState("");
  const [existingMesExample, setExistingMesExample] = useState("");
  const [existingAlternateGreetings, setExistingAlternateGreetings] =
    useState("");
  const [userMessage, setUserMessage] = useState("");
  const [result, setResult] = useState<TestPresetResult | null>(null);

  useEffect(() => {
    setTargetField(defaultTargetField(category));
    setGenerationMode("");
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
      next.existing_appearance = existingAppearance.trim();
      next.existing_personality = existingPersonality.trim();
    }

    if (category === "character_generator") {
      if (charNameOverride.trim()) {
        next.char = charNameOverride.trim();
      }
      if (targetField) next.target_field = targetField;
      if (generationMode.trim()) {
        next.generation_mode = generationMode.trim();
      }
      next.existing_description = existingDescription.trim();
      next.existing_appearance = existingAppearance.trim();
      next.existing_personality = existingPersonality.trim();
      next.existing_relationships = existingRelationships.trim();
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
    generationMode,
    existingDescription,
    existingAppearance,
    existingPersonality,
    existingRelationships,
    existingScenario,
    existingFirstMes,
    existingMesExample,
    existingAlternateGreetings,
  ]);

  const resolvedGeneratorPrompt = useMemo(() => {
    if (!isGeneratorCategory(category) || !generatorPreset) return null;
    return resolveGeneratorPresetPrompt(
      generatorPreset,
      category === "character_generator" ? generationMode || null : null,
    );
  }, [category, generatorPreset, generationMode]);

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
        generatorPrompt: resolvedGeneratorPrompt,
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
        characterInfoMode: category === "image" ? "image" : "default",
      }),
    [
      category,
      characterQuery.data,
      personaQuery.data,
      runtimeVariables,
      generatorBrief,
      resolvedGeneratorPrompt,
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
    : !connectionsQuery.isLoading && !connectionsQuery.options.length
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
            data={connectionsQuery.options}
            value={resolvedConnectionId ?? ""}
            onChange={setConnectionId}
            searchable
            disabled={!connectionsQuery.options.length}
            error={Boolean(connectionError)}
          />
        </Field>

        {isGeneratorCategory(category) ? (
          <Field
            label="Generator Prompt"
            hint={
              <RuntimeText text="Injects the selected Generator Preset into the generator_prompt marker." />
            }
            error={generatorPresetError}
          >
            <Select
              placeholder={
                generatorListLoading
                  ? "Loading generator presets…"
                  : "Select generator preset"
              }
              data={generatorPresetOptions}
              value={generatorPresetId ?? ""}
              onChange={(value) => setGeneratorPresetId(value || null)}
              searchable
              clearable
              disabled={!generatorPresetOptions.length}
              error={Boolean(generatorPresetError)}
            />
          </Field>
        ) : null}

        {category === "character_generator" ? (
          <Field
            label="Generation mode"
            hint={
              <RuntimeText text="Fills {{generation_mode}} and appends the matching mode prompt from the Generator Preset." />
            }
          >
            <Select
              data={GENERATION_MODE_OPTIONS}
              value={generationMode}
              onChange={(value) => setGenerationMode(value ?? "")}
            />
          </Field>
        ) : null}

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
            hint={
              category === "image" ? (
                <RuntimeText text="Fills {{user}}, {{user_appearance}}, and the Persona marker (Appearance-first)." />
              ) : (
                <RuntimeText text="Fills {{user}} and the Persona marker." />
              )
            }
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

        {usesCharacterCard(category) ? (
          <Field
            label="Character"
            hint={
              category === "image" ? (
                <RuntimeText text="Fills {{char}}, {{char_appearance}}, and Character Info (Appearance-first)." />
              ) : category === "lorebook_generator" ? (
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
        <Field
          label={category === "image" ? "Image brief" : "Generator brief"}
          hint={
            category === "image"
              ? "Fills the Image Brief marker (pose / scene / lighting). Character Appearance is the look source."
              : "Fills the Generator Brief marker."
          }
        >
          <Textarea
            className={classes.textarea}
            value={generatorBrief}
            onChange={(event) => setGeneratorBrief(event.currentTarget.value)}
            placeholder={
              category === "image"
                ? "e.g. Standing in rain at night, soft neon rim light, three-quarter view…"
                : "Concept / setting dump for the generator…"
            }
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
            label="Existing appearance"
            hint={<RuntimeText text="Fills {{existing_appearance}}." />}
          >
            <Textarea
              className={classes.textarea}
              value={existingAppearance}
              onChange={(event) =>
                setExistingAppearance(event.currentTarget.value)
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
                    label="Existing appearance"
                    hint={<RuntimeText text="Fills {{existing_appearance}}." />}
                  >
                    <Textarea
                      className={classes.textarea}
                      value={existingAppearance}
                      onChange={(event) =>
                        setExistingAppearance(event.currentTarget.value)
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
                    label="Existing relationships"
                    hint={
                      <RuntimeText text="Fills {{existing_relationships}}." />
                    }
                  >
                    <Textarea
                      className={classes.textarea}
                      value={existingRelationships}
                      onChange={(event) =>
                        setExistingRelationships(event.currentTarget.value)
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
