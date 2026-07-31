import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildPresetPromptContext,
  defaultCharacter,
  defaultCharacterCardData,
  resolveGeneratorPresetPrompt,
  type CharacterCardData,
  type Variable,
} from "@ai-hub/shared";
import { Button, Textarea,
  Modal,
  MultiSelect,
  TextInput,
  notifications,
  RuntimeText,
  Select,
  Switch,
} from "@/components/ui";
import { useConnectionSelectOptions } from "@/features/connections/queries";
import { useGeneratorJobsStore } from "@/features/generators/generatorJobsStore";
import { useGeneratorPresetSelection } from "@/features/generator-presets/useGeneratorPresetSelection";
import { getPersona } from "@/features/personas/api";
import { usePersonas } from "@/features/personas/queries";
import { SetupVariablesModal } from "@/features/presets/SetupVariablesModal";
import { persistPresetVariableSelection } from "@/features/presets/persistPresetVariableSelection";
import { presetKeys } from "@/features/presets/queries";
import { createCharacter, getCharacter } from "./api";
import {
  extractFullCards,
  extractedToCardData,
  resolvePresetVariables,
} from "./characterGenerateShared";
import {
  ImportAiReviewModal,
  type ImportAiReviewContext,
} from "./ImportAiReviewModal";
import { characterKeys, useCharacters, useCreateCharacter } from "./queries";
import classes from "./CreateCharacterModal.module.css";

type CreateCharacterModalProps = {
  opened: boolean;
  onClose: () => void;
};

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
      {hint ? <p className={classes.fieldHint}>{hint}</p> : null}
      {children}
      {error ? <p className={classes.fieldError}>{error}</p> : null}
    </div>
  );
}

export function CreateCharacterModal({
  opened,
  onClose,
}: CreateCharacterModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createMutation = useCreateCharacter();
  const connectionsQuery = useConnectionSelectOptions("llm");
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const generatorSelection = useGeneratorPresetSelection("character_generator");

  const [name, setName] = useState("");
  const [createWithAi, setCreateWithAi] = useState(false);
  const [generatorBrief, setGeneratorBrief] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [personaInitialized, setPersonaInitialized] = useState(false);
  const [referenceCharacterIds, setReferenceCharacterIds] = useState<string[]>(
    [],
  );
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [aiReviewCards, setAiReviewCards] = useState<CharacterCardData[]>([]);
  const [aiReviewContext, setAiReviewContext] =
    useState<ImportAiReviewContext | null>(null);
  const [confirmingAi, setConfirmingAi] = useState(false);

  const defaultConnectionId = connectionsQuery.defaultId || null;

  const defaultPersonaId =
    personasQuery.data?.find((persona) => persona.is_default)?.id ?? null;

  useEffect(() => {
    if (personaInitialized || !personasQuery.data) return;
    if (defaultPersonaId) setPersonaId(defaultPersonaId);
    setPersonaInitialized(true);
  }, [personaInitialized, personasQuery.data, defaultPersonaId]);

  const resolvedConnectionId = connectionId ?? defaultConnectionId;
  const {
    generatorPresetId,
    setGeneratorPresetId,
    generatorPreset,
    generatorPresetOptions,
    structuralPresetId,
    structuralPreset: preset,
    selectError: presetError,
    isLoading: presetLoading,
    isListLoading: generatorListLoading,
  } = generatorSelection;

  const characterOptions = useMemo(
    () =>
      (charactersQuery.data ?? []).map((character) => ({
        value: character.id,
        label: character.name || character.id,
      })),
    [charactersQuery.data],
  );

  const hasPresetVariables = Boolean(
    preset?.variables.some((variable) => variable.variable_name.trim()),
  );

  function clearAiReview() {
    setAiReviewOpen(false);
    setAiReviewCards([]);
    setAiReviewContext(null);
    setConfirmingAi(false);
  }

  function resetForm() {
    setName("");
    setCreateWithAi(false);
    setGeneratorBrief("");
    setConnectionId(null);
    setPersonaId(defaultPersonaId);
    setReferenceCharacterIds([]);
    setVariablesOpen(false);
    setGenerating(false);
    clearAiReview();
  }

  async function handleApplyVariables(variables: Variable[]) {
    if (!structuralPresetId) return;
    try {
      const saved = await persistPresetVariableSelection(
        structuralPresetId,
        variables,
      );
      queryClient.setQueryData(presetKeys.detail(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: presetKeys.all });
      setVariablesOpen(false);
      notifications.show({
        title: "Variables saved",
        message: "Selected values are stored on this preset.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Save failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function navigateToCharacter(characterId: string) {
    await navigate({
      to: "/characters/$characterId",
      params: { characterId },
    });
  }

  async function handleCreateBlank() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      const created = await createMutation.mutateAsync(
        defaultCharacter({ data: { name: trimmedName } }),
      );
      notifications.show({
        title: "Created",
        message: "Character created.",
        color: "green",
      });
      handleClose();
      await navigateToCharacter(created.id);
    } catch (error) {
      notifications.show({
        title: "Create failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  async function runAiCreate(): Promise<{
    cards: CharacterCardData[];
    sourceCard: CharacterCardData;
  }> {
    if (!resolvedConnectionId) {
      throw new Error("Select a connection to create with AI.");
    }
    if (!generatorPresetId || !generatorPreset || !structuralPresetId || !preset) {
      throw new Error("Select a Character Generator Preset.");
    }

    const brief = generatorBrief.trim();
    if (!brief) {
      throw new Error("Enter a generator brief describing the character(s).");
    }

    const seedName = name.trim();
    const sourceCard = defaultCharacterCardData(
      seedName ? { name: seedName } : undefined,
    );

    const [persona, referenceCharacters] = await Promise.all([
      personaId ? getPersona(personaId) : Promise.resolve(null),
      Promise.all(referenceCharacterIds.map((id) => getCharacter(id))),
    ]);
    const promptContext = buildPresetPromptContext({
      generatorBrief: brief,
      generatorPrompt: resolveGeneratorPresetPrompt(generatorPreset, "create"),
      persona,
      referenceCharacterList: referenceCharacters,
      variables: {
        ...resolvePresetVariables(preset.variables),
        generation_mode: "create",
        name_seed: seedName,
        char: seedName,
        target_field: "all card fields",
        existing_description: "",
        existing_appearance: "",
        existing_personality: "",
        existing_relationships: "",
        existing_scenario: "",
        existing_first_mes: "",
        existing_mes_example: "",
        existing_alternate_greetings: "",
      },
    });

    const result = await useGeneratorJobsStore.getState().runTrackedGenerator({
      category: "character_generator",
      connectionId: resolvedConnectionId,
      presetId: structuralPresetId,
      generatorPresetId,
      variables: promptContext.variables,
      markers: promptContext.markers,
      title: `Create character with AI · ${seedName || "new character"}`,
    });

    const extracted = extractFullCards(result.content || result.reply || "");
    if (extracted.length === 0) {
      throw new Error("Model returned an empty character card.");
    }

    return {
      sourceCard,
      cards: extracted.map((card) =>
        defaultCharacterCardData(extractedToCardData(card)),
      ),
    };
  }

  async function persistAiCards(cardsToCreate: CharacterCardData[]) {
    const createdList = [];
    for (const card of cardsToCreate) {
      const created = await createCharacter(defaultCharacter({ data: card }));
      createdList.push(created);
    }

    const primary = createdList[0]!;
    void queryClient.invalidateQueries({ queryKey: characterKeys.list() });
    notifications.show({
      title: cardsToCreate.length > 1 ? "Created characters" : "Created",
      message:
        cardsToCreate.length > 1
          ? `Created ${cardsToCreate.length} characters with AI: ${createdList.map((c) => c.data.name || "untitled").join(", ")}.`
          : `${primary.data.name || "Character"} created with AI.`,
      color: "green",
    });

    handleClose();
    await navigateToCharacter(primary.id);
  }

  async function handleGenerateWithAi() {
    setGenerating(true);
    try {
      if (
        !resolvedConnectionId ||
        !generatorPresetId ||
        !generatorPreset ||
        !structuralPresetId ||
        !preset
      ) {
        throw new Error("Select connection and Character Generator Preset.");
      }
      const aiResult = await runAiCreate();
      setAiReviewCards(aiResult.cards);
      setAiReviewContext({
        connectionId: resolvedConnectionId,
        presetId: structuralPresetId,
        generatorPresetId,
        generatorPrompts: generatorPreset,
        presetVariables: preset.variables,
        personaId,
        referenceCharacterIds,
        sourceCard: aiResult.sourceCard,
        generatorBrief: generatorBrief.trim(),
      });
      setAiReviewOpen(true);
    } catch (error) {
      notifications.show({
        title: "Generate failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleConfirmAiReview() {
    if (aiReviewCards.length === 0) return;
    setConfirmingAi(true);
    try {
      await persistAiCards(aiReviewCards);
    } catch (error) {
      notifications.show({
        title: "Create failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setConfirmingAi(false);
    }
  }

  const aiReady =
    Boolean(resolvedConnectionId) &&
    Boolean(generatorPresetId) &&
    Boolean(generatorPreset) &&
    Boolean(structuralPresetId) &&
    Boolean(preset) &&
    Boolean(generatorBrief.trim());

  const busy =
    createMutation.isPending || generating || confirmingAi || aiReviewOpen;

  const connectionError = connectionsQuery.isError
    ? "Failed to load connections"
    : !connectionsQuery.isLoading && !connectionsQuery.options.length
      ? "Create a connection first"
      : undefined;

  const personaError = personasQuery.isError
    ? "Failed to load personas"
    : undefined;

  const charactersError = charactersQuery.isError
    ? "Failed to load characters"
    : undefined;

  return (
    <>
      <Modal
        opened={opened && !aiReviewOpen}
        onClose={handleClose}
        title="New character"
        size={createWithAi ? "lg" : "md"}
      >
        <div className={classes.stack}>
          <Field
            label="Name"
            hint={
              createWithAi ? (
                <>
                  Optional seed for the primary character — the model may refine
                  it.
                </>
              ) : (
                <>
                  Replaces <RuntimeText>{"{{char}}"}</RuntimeText> in prompts.
                </>
              )
            }
          >
            <TextInput
              placeholder="Aria"
              autoFocus
              required={!createWithAi}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              disabled={busy}
            />
          </Field>

          <Switch
            variant="card"
            checked={createWithAi}
            onChange={setCreateWithAi}
            disabled={busy}
            label="Create with AI"
            description="Runs the Character Generator from a brief, then opens a preview where you can rebuild concept or individual fields before saving. Multi-character briefs become separate cards."
          />

          {createWithAi ? (
            <>
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
                        : "Select connection"
                    }
                    data={connectionsQuery.options}
                    value={resolvedConnectionId ?? ""}
                    onChange={(value) => setConnectionId(value || null)}
                    searchable
                    disabled={busy || !connectionsQuery.options.length}
                    error={Boolean(connectionError)}
                  />
                </Field>

                <Field
                  label="Generator Preset"
                  hint="Main prompt + linked structural Preset for Character Generator."
                  error={presetError}
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
                    disabled={busy || !generatorPresetOptions.length}
                    error={Boolean(presetError)}
                  />
                </Field>

                <Field
                  label="Persona"
                  hint={
                    <>
                      Optional — fills <RuntimeText>{"{{user}}"}</RuntimeText>{" "}
                      and the Persona marker.
                    </>
                  }
                  error={personaError}
                >
                  <Select
                    placeholder={
                      personasQuery.isLoading
                        ? "Loading personas…"
                        : "Select persona"
                    }
                    data={(personasQuery.data ?? []).map((persona) => ({
                      value: persona.id,
                      label: `${persona.name || "untitled"}${persona.is_default ? " (default)" : ""}`,
                    }))}
                    value={personaId ?? ""}
                    onChange={(value) => setPersonaId(value || null)}
                    searchable
                    clearable
                    disabled={busy || !personasQuery.data?.length}
                    error={Boolean(personaError)}
                  />
                </Field>

                <Field
                  label="Reference characters"
                  hint="Optional — fills the Reference Characters marker."
                  error={charactersError}
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
                    disabled={busy || !characterOptions.length}
                    error={Boolean(charactersError)}
                  />
                </Field>
              </div>

              {hasPresetVariables ? (
                <div className={classes.variablesRow}>
                  <Button
                    type="button"
                    variant="default"
                    disabled={busy || !preset}
                    onClick={() => setVariablesOpen(true)}
                  >
                    Setup Variables
                  </Button>
                  <span className={classes.fieldHint}>
                    Genre, detail, language, and other values for this preset.
                  </span>
                </div>
              ) : null}

              <Field
                label="Generator brief"
                hint="Required — fills the Generator Brief marker (concept / cast / tone)."
              >
                <Textarea
                  className={classes.textarea}
                  value={generatorBrief}
                  onChange={(event) =>
                    setGeneratorBrief(event.currentTarget.value)
                  }
                  placeholder="e.g. A soft-spoken clockmaker who repairs forbidden automata; dry wit, ink-stained hands…"
                  disabled={busy}
                />
              </Field>
            </>
          ) : null}
        </div>

        <div className={classes.actions}>
          <Button variant="default" type="button"
            onClick={handleClose}>
            Cancel
          </Button>
          {createWithAi ? (
            <Button variant="primary" type="button"
              onClick={() => void handleGenerateWithAi()}
              disabled={!aiReady || busy || presetLoading}
            >
              {generating || presetLoading
                ? "Generating…"
                : "Generate with AI"}
            </Button>
          ) : (
            <Button variant="primary" type="button"
              onClick={() => void handleCreateBlank()}
              disabled={!name.trim() || busy}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          )}
        </div>
      </Modal>

      <SetupVariablesModal
        opened={variablesOpen}
        onClose={() => setVariablesOpen(false)}
        variables={preset?.variables ?? []}
        onApply={(variables) => void handleApplyVariables(variables)}
      />

      {aiReviewContext ? (
        <ImportAiReviewModal
          opened={aiReviewOpen}
          cards={aiReviewCards}
          onCardsChange={setAiReviewCards}
          context={aiReviewContext}
          confirming={confirmingAi}
          onConfirm={() => void handleConfirmAiReview()}
          onCancel={() => {
            clearAiReview();
          }}
        />
      ) : null}
    </>
  );
}
