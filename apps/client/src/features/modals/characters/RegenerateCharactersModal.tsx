import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildPresetPromptContext,
  nextCharacterVersionLabel,
  resolveGeneratorPresetPrompt,
  type CharacterCardData,
} from "@ai-hub/shared";
import { Button, Textarea,
  Modal,
  MultiSelect,
  notifications,
  RuntimeText,
  Select,
} from "@/components/ui";
import { useConnectionSelectOptions } from "@/features/connections/queries";
import { useGeneratorJobsStore } from "@/features/generators/generatorJobsStore";
import { useGeneratorPresetSelection } from "@/features/generator-presets/useGeneratorPresetSelection";
import { getPersona } from "@/features/personas/api";
import { usePersonas } from "@/features/personas/queries";
import { getCharacter, updateCharacter } from "./api";
import {
  extractFullCards,
  mergeExtractedIntoCardData,
  resolvePresetVariables,
  type ExtractedCharacterCard,
} from "./characterGenerateShared";
import {
  ImportAiReviewModal,
  type ImportAiReviewContext,
} from "./ImportAiReviewModal";
import { characterKeys, useCharacters } from "./queries";
import classes from "./RegenerateCharactersModal.module.css";

type RegenerateScope = "concept" | "all";

const CONCEPT_FIELDS = [
  "name",
  "description",
  "appearance",
  "personality",
  "relationships",
  "scenario",
] as const;

type RegenerateCharactersModalProps = {
  opened: boolean;
  onClose: () => void;
};

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={classes.field}>
      <span
        className={[
          classes.fieldLabel,
          required ? classes.fieldLabelRequired : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
      </span>
      {hint ? <p className={classes.fieldHint}>{hint}</p> : null}
      {children}
      {error ? <p className={classes.fieldError}>{error}</p> : null}
    </div>
  );
}

function mergeConceptFields(
  base: CharacterCardData,
  rebuilt: ExtractedCharacterCard,
): CharacterCardData {
  const partial: ExtractedCharacterCard = {};
  for (const field of CONCEPT_FIELDS) {
    if (rebuilt[field] != null) partial[field] = rebuilt[field] as never;
  }
  return mergeExtractedIntoCardData(base, partial);
}

export function RegenerateCharactersModal({
  opened,
  onClose,
}: RegenerateCharactersModalProps) {
  const queryClient = useQueryClient();
  const connectionsQuery = useConnectionSelectOptions("llm");
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const generatorSelection = useGeneratorPresetSelection("character_generator");

  const [targetCharacterIds, setTargetCharacterIds] = useState<string[]>([]);
  const [generatorBrief, setGeneratorBrief] = useState("");
  const [scope, setScope] = useState<RegenerateScope>("concept");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [personaInitialized, setPersonaInitialized] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [aiReviewCards, setAiReviewCards] = useState<CharacterCardData[]>([]);
  const [aiReviewContext, setAiReviewContext] =
    useState<ImportAiReviewContext | null>(null);
  const [reviewTargetIds, setReviewTargetIds] = useState<string[]>([]);
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
    selectError: presetFieldError,
    isLoading: presetLoading,
    isListLoading: generatorListLoading,
  } = generatorSelection;

  const personaOptions = useMemo(
    () =>
      (personasQuery.data ?? []).map((persona) => ({
        value: persona.id,
        label: `${persona.name || "untitled"}${persona.is_default ? " (default)" : ""}`,
      })),
    [personasQuery.data],
  );

  const characterOptions = useMemo(
    () =>
      (charactersQuery.data ?? []).map((character) => ({
        value: character.id,
        label: character.name || character.id,
      })),
    [charactersQuery.data],
  );

  const characterFieldError =
    charactersQuery.isError
      ? "Failed to load characters"
      : !charactersQuery.isLoading && !characterOptions.length
        ? "Create a character first"
        : undefined;

  const connectionFieldError =
    connectionsQuery.isError
      ? "Failed to load connections"
      : !connectionsQuery.isLoading && !connectionsQuery.options.length
        ? "Create a connection first"
        : undefined;

  const personaFieldError = personasQuery.isError
    ? "Failed to load personas"
    : undefined;

  function clearAiReview() {
    setAiReviewOpen(false);
    setAiReviewCards([]);
    setAiReviewContext(null);
    setReviewTargetIds([]);
    setConfirmingAi(false);
  }

  function resetForm() {
    setTargetCharacterIds([]);
    setGeneratorBrief("");
    setScope("concept");
    setConnectionId(null);
    setPersonaId(defaultPersonaId);
    setGenerating(false);
    clearAiReview();
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function runAiRegenerate(): Promise<{
    cards: CharacterCardData[];
    sourceCard: CharacterCardData;
    targetIds: string[];
  }> {
    if (!resolvedConnectionId) {
      throw new Error("Select a connection to regenerate with AI.");
    }
    if (!generatorPresetId || !generatorPreset || !structuralPresetId || !preset) {
      throw new Error("Select a Character Generator Preset.");
    }

    const brief = generatorBrief.trim();
    if (!brief) {
      throw new Error("Enter a generator brief describing the regenerate direction.");
    }

    if (targetCharacterIds.length === 0) {
      throw new Error("Select at least one character to regenerate.");
    }

    const [persona, targets] = await Promise.all([
      personaId ? getPersona(personaId) : Promise.resolve(null),
      Promise.all(targetCharacterIds.map((id) => getCharacter(id))),
    ]);

    const targetCards = targets.map((character) => character.data);
    const castRoster = targetCards
      .map(
        (card, index) =>
          `${index + 1}. ${card.name.trim() || `Character ${index + 1}`}`,
      )
      .join("\n");

    const promptContext = buildPresetPromptContext({
      generatorBrief: brief,
      generatorPrompt: resolveGeneratorPresetPrompt(
        generatorPreset,
        "regenerate",
      ),
      persona,
      referenceCharacterList: targets,
      variables: {
        ...resolvePresetVariables(preset.variables),
        generation_mode: "regenerate",
        regenerate_scope: scope,
        cast_size: String(targetCards.length),
        cast_roster: castRoster,
        char: targetCards
          .map((card) => card.name.trim())
          .filter(Boolean)
          .join(" / "),
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

    const castLabel =
      targetCards
        .map((card) => card.name.trim())
        .filter(Boolean)
        .join(", ") ||
      `${targetCards.length} character${targetCards.length === 1 ? "" : "s"}`;

    const result = await useGeneratorJobsStore.getState().runTrackedGenerator({
      category: "character_generator",
      connectionId: resolvedConnectionId,
      presetId: structuralPresetId,
      generatorPresetId,
      variables: promptContext.variables,
      markers: promptContext.markers,
      title: `Regenerate ${scope} · ${castLabel}`,
    });

    const extracted = extractFullCards(result.content || result.reply || "");
    if (extracted.length === 0) {
      throw new Error("Model returned an empty regenerate result.");
    }

    const cards = targetCards.map((card, index) => {
      const rebuilt = extracted[index] ?? extracted[0];
      if (!rebuilt) return card;
      return scope === "concept"
        ? mergeConceptFields(card, rebuilt)
        : mergeExtractedIntoCardData(card, rebuilt);
    });

    return {
      targetIds: targetCharacterIds,
      sourceCard: targetCards[0]!,
      cards,
    };
  }

  async function handleGenerate() {
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
      const aiResult = await runAiRegenerate();
      setReviewTargetIds(aiResult.targetIds);
      setAiReviewCards(aiResult.cards);
      setAiReviewContext({
        connectionId: resolvedConnectionId,
        presetId: structuralPresetId,
        generatorPresetId,
        generatorPrompts: generatorPreset,
        presetVariables: preset.variables,
        personaId,
        referenceCharacterIds: [],
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
    if (aiReviewCards.length === 0 || reviewTargetIds.length === 0) return;
    if (aiReviewCards.length !== reviewTargetIds.length) {
      notifications.show({
        title: "Save failed",
        message: "Card count no longer matches the selected characters.",
        color: "red",
      });
      return;
    }

    setConfirmingAi(true);
    try {
      const updatedNames: string[] = [];
      for (let index = 0; index < reviewTargetIds.length; index += 1) {
        const id = reviewTargetIds[index]!;
        const data = aiReviewCards[index]!;
        const existing = await getCharacter(id);
        const versionLabel = nextCharacterVersionLabel(
          existing.versions.map((version) => version.label),
        );
        const updated = await updateCharacter(id, {
          data: {
            ...data,
            character_version: versionLabel,
          },
          create_version: true,
          version_label: versionLabel,
        });
        updatedNames.push(
          `${updated.data.name || "untitled"} (${versionLabel})`,
        );
      }

      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
      notifications.show({
        title:
          reviewTargetIds.length > 1
            ? "New versions created"
            : "New version created",
        message:
          reviewTargetIds.length > 1
            ? `Saved ${reviewTargetIds.length} new versions: ${updatedNames.join(", ")}.`
            : `${updatedNames[0]} saved as a new version.`,
        color: "green",
      });
      handleClose();
    } catch (error) {
      notifications.show({
        title: "Save failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setConfirmingAi(false);
    }
  }

  const aiReady =
    targetCharacterIds.length > 0 &&
    Boolean(resolvedConnectionId) &&
    Boolean(generatorPresetId) &&
    Boolean(generatorPreset) &&
    Boolean(structuralPresetId) &&
    Boolean(preset) &&
    Boolean(generatorBrief.trim());

  const busy = generating || confirmingAi || aiReviewOpen;
  const generateDisabled =
    !aiReady || busy || generating || presetLoading;

  return (
    <>
      <Modal
        opened={opened && !aiReviewOpen}
        onClose={handleClose}
        title="Regenerate characters"
        size="lg"
      >
        <div className={classes.stack}>
          <p className={classes.muted}>
            Rebuild selected library characters under one brief, preview the
            results, then save each result as a new card version (previous
            versions stay intact).
          </p>

          <Field
            label="Characters"
            hint="Targets to regenerate — order is preserved in the AI pass."
            required
            error={characterFieldError}
          >
            <MultiSelect
              searchable
              clearable
              data={characterOptions}
              value={targetCharacterIds}
              onChange={setTargetCharacterIds}
              disabled={busy || !characterOptions.length}
              error={Boolean(characterFieldError)}
              placeholder={
                charactersQuery.isLoading
                  ? "Loading characters…"
                  : "Select characters"
              }
            />
          </Field>

          <Field label="Scope">
            <div className={classes.segmented} role="group" aria-label="Scope">
              {(
                [
                  { label: "Concept", value: "concept" as const },
                  { label: "Full card", value: "all" as const },
                ] as const
              ).map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={scope === option.value ? "light" : "ghost"}
                  size="sm"
                  className={[
                    classes.segment,
                    scope === option.value ? classes.segmentActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={busy}
                  aria-pressed={scope === option.value}
                  onClick={() => setScope(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className={classes.fieldHint}>
              {scope === "concept"
                ? "Updates name, description, appearance, personality, relationships, and scenario."
                : "Rebuilds all main card fields from the brief."}
            </p>
          </Field>

          <div className={classes.grid}>
            <Field
              label="Connection"
              hint="Defaults to the active connection."
              error={connectionFieldError}
            >
              <Select
                searchable
                data={connectionsQuery.options}
                value={resolvedConnectionId ?? ""}
                onChange={(value) => setConnectionId(value)}
                disabled={busy || !connectionsQuery.options.length}
                error={Boolean(connectionFieldError)}
                placeholder={
                  connectionsQuery.isLoading
                    ? "Loading connections…"
                    : "Select connection"
                }
              />
            </Field>

            <Field
              label="Generator Preset"
              hint="Main prompt + linked structural Preset for Character Generator."
              error={presetFieldError}
            >
              <Select
                searchable
                data={generatorPresetOptions}
                value={generatorPresetId ?? ""}
                onChange={(value) => setGeneratorPresetId(value || null)}
                disabled={busy || !generatorPresetOptions.length}
                error={Boolean(presetFieldError)}
                placeholder={
                  generatorListLoading
                    ? "Loading generator presets…"
                    : "Select generator preset"
                }
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
              error={personaFieldError}
            >
              <Select
                searchable
                clearable
                data={personaOptions}
                value={personaId ?? ""}
                onChange={(value) => setPersonaId(value || null)}
                disabled={busy || !personaOptions.length}
                error={Boolean(personaFieldError)}
                placeholder={
                  personasQuery.isLoading
                    ? "Loading personas…"
                    : "Select persona"
                }
              />
            </Field>
          </div>

          <Field
            label="Generator brief"
            hint="Required — direction for the regenerate pass."
            required
          >
            <Textarea
              className={classes.textarea}
              value={generatorBrief}
              onChange={(event) => setGeneratorBrief(event.currentTarget.value)}
              placeholder="e.g. Shift the whole cast into a noir port city; keep relationships, darken the tone…"
              disabled={busy}
            />
          </Field>
        </div>

        <div className={classes.actions}>
          <Button variant="default" type="button"
            onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" type="button"
            disabled={generateDisabled}
            onClick={() => void handleGenerate()}
          >
            {generating || presetLoading
              ? "Generating…"
              : "Generate with AI"}
          </Button>
        </div>
      </Modal>

      {aiReviewContext ? (
        <ImportAiReviewModal
          opened={aiReviewOpen}
          cards={aiReviewCards}
          onCardsChange={setAiReviewCards}
          context={aiReviewContext}
          confirming={confirmingAi}
          lockCardCount
          title={`Review regenerated characters (${aiReviewCards.length})`}
          confirmLabel={`Save ${aiReviewCards.length} new version${aiReviewCards.length === 1 ? "" : "s"}`}
          onConfirm={() => void handleConfirmAiReview()}
          onCancel={() => {
            clearAiReview();
          }}
        />
      ) : null}
    </>
  );
}
