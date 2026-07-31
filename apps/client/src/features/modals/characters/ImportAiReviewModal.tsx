import { useMemo, useState, type ReactNode } from "react";
import { IconRefresh, IconSparkles, IconTrash } from "@tabler/icons-react";
import {
  buildPresetPromptContext,
  defaultCharacterCardData,
  resolveGeneratorPresetPrompt,
  type CharacterCardData,
  type GeneratorPresetPromptFields,
  type Variable,
} from "@ai-hub/shared";
import {
  ActionIcon,
  Button,
  Textarea,
  Accordion,
  Modal,
  TextInput,
  notifications,
  TagsInput,
} from "@/components/ui";
import { getCharacter } from "@/features/api-queries/characters/api";
import { getPersona } from "@/features/api-queries/personas/api";
import { useGeneratorJobsStore } from "@/features/shared/generators/generatorJobsStore";
import {
  extractFullCards,
  extractedToCardData,
  formatAlternateGreetingsForPrompt,
  mergeExtractedIntoCardData,
  normalizeFullCard,
  withImportedCardVariables,
  stripCodeFence,
  type ExtractedCharacterCard,
} from "@/features/shared/characters/characterGenerateShared";
import { AlternateGreetingsEditor } from "@/features/shared/characters/AlternateGreetingsEditor";
import classes from "./ImportAiReviewModal.module.css";

export type ImportAiReviewContext = {
  connectionId: string;
  presetId: string;
  generatorPresetId: string;
  /** Prompt pack used to resolve `generator_prompt` by generation_mode. */
  generatorPrompts?: GeneratorPresetPromptFields;
  presetVariables: Variable[];
  personaId: string | null;
  /** Existing library characters to include in the Reference Characters marker. */
  referenceCharacterIds: string[];
  sourceCard: CharacterCardData;
  generatorBrief: string;
};

type ImportAiReviewModalProps = {
  opened: boolean;
  cards: CharacterCardData[];
  onCardsChange: (cards: CharacterCardData[]) => void;
  context: ImportAiReviewContext;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** When true, hide remove-card controls so id↔card mapping stays stable. */
  lockCardCount?: boolean;
  /**
   * Trailing N cards are saved as new versions of `context.referenceCharacterIds`
   * (import flow). Shown with a "New version" label in the accordion.
   */
  versionCardCount?: number;
  title?: string;
  confirmLabel?: string;
};

type RebuildKind =
  | "all"
  | "concept"
  | "description"
  | "appearance"
  | "personality"
  | "relationships"
  | "scenario"
  | "first_mes"
  | "mes_example"
  | "alternate_greetings";

const CONCEPT_FIELDS = [
  "name",
  "description",
  "appearance",
  "personality",
  "relationships",
  "scenario",
] as const;

function extractPartialCard(
  raw: string,
  field: Exclude<RebuildKind, "all" | "concept">,
): ExtractedCharacterCard {
  const text = stripCodeFence(raw);
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not object");
    }
    const record = parsed as Record<string, unknown>;
    if (field === "alternate_greetings" || field === "relationships") {
      return normalizeFullCard({ [field]: record[field] });
    }
    const value = record[field];
    if (typeof value === "string" && value.trim()) {
      return { [field]: value.trim() };
    }
    return {};
  } catch {
    if (field === "alternate_greetings" || field === "relationships") return {};
    return { [field]: text };
  }
}

function targetFieldForRebuild(kind: RebuildKind): string {
  if (kind === "all") return "all card fields";
  if (kind === "concept") return "all card fields";
  return kind;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={classes.field}>
      <span className={classes.fieldLabel}>{label}</span>
      {hint ? <p className={classes.fieldHint}>{hint}</p> : null}
      {children}
    </div>
  );
}

export function ImportAiReviewModal({
  opened,
  cards,
  onCardsChange,
  context,
  confirming,
  onConfirm,
  onCancel,
  lockCardCount = false,
  versionCardCount = 0,
  title,
  confirmLabel,
}: ImportAiReviewModalProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [conceptNotes, setConceptNotes] = useState<Record<number, string>>({});
  const [batchConceptNotes, setBatchConceptNotes] = useState("");

  const accordionDefault = useMemo(
    () => (cards.length > 0 ? "0" : null),
    [cards.length],
  );

  function updateCard(index: number, patch: Partial<CharacterCardData>) {
    onCardsChange(
      cards.map((card, i) => (i === index ? { ...card, ...patch } : card)),
    );
  }

  function removeCard(index: number) {
    if (cards.length <= 1) {
      notifications.show({
        title: "Keep at least one",
        message: "Remove the review instead of deleting the last card.",
        color: "yellow",
      });
      return;
    }
    onCardsChange(cards.filter((_, i) => i !== index));
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

  async function loadLibraryReferences() {
    if (context.referenceCharacterIds.length === 0) return [];
    return Promise.all(
      context.referenceCharacterIds.map((id) => getCharacter(id)),
    );
  }

  async function rebuildAllConcepts() {
    if (cards.length === 0) return;
    setPendingKey("batch:concept");
    try {
      const [persona, libraryReferences] = await Promise.all([
        context.personaId
          ? getPersona(context.personaId)
          : Promise.resolve(null),
        loadLibraryReferences(),
      ]);

      const note = batchConceptNotes.trim();
      const castRoster = cards
        .map(
          (card, index) =>
            `${index + 1}. ${card.name.trim() || `Character ${index + 1}`}`,
        )
        .join("\n");

      const promptContext = buildPresetPromptContext({
        generatorBrief: context.generatorBrief.trim() || null,
        generatorPrompt: resolveGeneratorPresetPrompt(
          context.generatorPrompts ?? {
            prompt: "",
            prompt_create: "",
            prompt_import: "",
            prompt_regenerate: "",
            prompt_rebuild: "",
          },
          "rebuild",
        ),
        persona,
        referenceCharacterList: [
          ...libraryReferences,
          { data: context.sourceCard },
          ...cards.map((data) => ({ data })),
        ],
        variables: {
          ...withImportedCardVariables(context.presetVariables),
          generation_mode: "rebuild",
          rebuild_scope: "concept_batch",
          rebuild_notes: note,
          cast_size: String(cards.length),
          cast_roster: castRoster,
          char: cards
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

      const result = await useGeneratorJobsStore.getState().runTrackedGenerator({
        category: "character_generator",
        connectionId: context.connectionId,
        presetId: context.presetId,
        generatorPresetId: context.generatorPresetId,
        variables: promptContext.variables,
        markers: promptContext.markers,
        title: `Rebuild concepts · ${cards.length} character${cards.length === 1 ? "" : "s"}`,
      });

      const extracted = extractFullCards(result.content || result.reply || "");
      if (extracted.length === 0) {
        throw new Error("Model returned an empty rebuild result");
      }

      const nextCards = cards.map((card, index) => {
        const rebuilt = extracted[index] ?? extracted[0];
        if (!rebuilt) return card;
        return mergeConceptFields(card, rebuilt);
      });

      onCardsChange(nextCards);
      notifications.show({
        title: "Concepts rebuilt",
        message:
          extracted.length >= cards.length
            ? `Updated concept fields for ${cards.length} characters.`
            : `Updated ${extracted.length} of ${cards.length} characters (model returned fewer cards).`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Rebuild failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function rebuild(index: number, kind: RebuildKind) {
    const card = cards[index];
    if (!card) return;
    const key = `${index}:${kind}`;
    setPendingKey(key);
    try {
      const [persona, libraryReferences] = await Promise.all([
        context.personaId
          ? getPersona(context.personaId)
          : Promise.resolve(null),
        loadLibraryReferences(),
      ]);

      const note = conceptNotes[index]?.trim() ?? "";
      const rebuildScope =
        kind === "concept" ? "concept" : kind === "all" ? "all" : "field";

      const promptContext = buildPresetPromptContext({
        generatorBrief: context.generatorBrief.trim() || null,
        generatorPrompt: resolveGeneratorPresetPrompt(
          context.generatorPrompts ?? {
            prompt: "",
            prompt_create: "",
            prompt_import: "",
            prompt_regenerate: "",
            prompt_rebuild: "",
          },
          "rebuild",
        ),
        persona,
        referenceCharacterList: [
          ...libraryReferences,
          { data: context.sourceCard },
          { data: card },
        ],
        variables: {
          ...withImportedCardVariables(context.presetVariables),
          generation_mode: "rebuild",
          rebuild_scope: rebuildScope,
          rebuild_notes: note,
          cast_size: "1",
          cast_roster: `1. ${card.name.trim() || "Character 1"}`,
          char: card.name.trim(),
          target_field: targetFieldForRebuild(kind),
          existing_description: card.description.trim(),
          existing_appearance: card.appearance.trim(),
          existing_personality: card.personality.trim(),
          existing_relationships: formatAlternateGreetingsForPrompt(
            card.relationships,
          ),
          existing_scenario: card.scenario.trim(),
          existing_first_mes: card.first_mes.trim(),
          existing_mes_example: card.mes_example.trim(),
          existing_alternate_greetings: formatAlternateGreetingsForPrompt(
            card.alternate_greetings,
          ),
        },
      });

      const rebuildKindLabels: Record<RebuildKind, string> = {
        all: "all fields",
        concept: "concept",
        description: "description",
        appearance: "appearance",
        personality: "personality",
        relationships: "relationships",
        scenario: "scenario",
        first_mes: "first message",
        mes_example: "example messages",
        alternate_greetings: "alternate greetings",
      };

      const result = await useGeneratorJobsStore.getState().runTrackedGenerator({
        category: "character_generator",
        connectionId: context.connectionId,
        presetId: context.presetId,
        generatorPresetId: context.generatorPresetId,
        variables: promptContext.variables,
        markers: promptContext.markers,
        title: `Rebuild ${rebuildKindLabels[kind]} · ${card.name.trim() || "character"}`,
      });

      const raw = result.content || result.reply || "";
      let next = card;

      if (kind === "all" || kind === "concept") {
        const extracted = extractFullCards(raw);
        if (extracted.length === 0) {
          throw new Error("Model returned an empty rebuild result");
        }
        const rebuilt = extracted[0]!;
        if (kind === "concept") {
          next = mergeConceptFields(card, rebuilt);
        } else {
          next = {
            ...defaultCharacterCardData(extractedToCardData(rebuilt)),
            creator: card.creator,
            character_version: card.character_version,
          };
        }
      } else {
        const partial = extractPartialCard(raw, kind);
        next = mergeExtractedIntoCardData(card, partial);
      }

      onCardsChange(cards.map((c, i) => (i === index ? next : c)));
      notifications.show({
        title: "Rebuilt",
        message:
          kind === "concept"
            ? "Concept fields updated."
            : kind === "all"
              ? "Full card rebuilt."
              : `${kind} updated.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Rebuild failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setPendingKey(null);
    }
  }

  const busy = pendingKey != null || confirming;

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={title ?? `Review AI characters (${cards.length})`}
      size="xl"
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
    >
      <div className={classes.stack}>
        <p className={classes.muted}>
          Preview and edit generated cards before saving. Batch Rebuild Concept
          refreshes name / description / appearance / personality / relationships / scenario for every card
          in one pass; per-card Rebuild concept / Rebuild all work on a single
          character.
        </p>

        <div className={classes.section}>
          <Field
            label="Batch rebuild notes (optional)"
            hint="Extra direction applied when rebuilding all concepts together."
          >
            <Textarea
              className={classes.textarea}
              value={batchConceptNotes}
              onChange={(event) =>
                setBatchConceptNotes(event.currentTarget.value)
              }
              disabled={busy}
            />
          </Field>
          <div className={classes.toolbarGroup}>
            <Button
              type="button"
              variant="light"
              size="sm"
              leftSection={<IconSparkles size={16} />}
              disabled={busy || cards.length === 0}
              loading={pendingKey === "batch:concept"}
              onClick={() => void rebuildAllConcepts()}
            >
              {pendingKey === "batch:concept"
                ? "Rebuilding…"
                : `Rebuild Concept${cards.length > 1 ? ` (${cards.length})` : ""}`}
            </Button>
          </div>
        </div>

        <Accordion defaultValue={accordionDefault}>
          {cards.map((card, index) => {
            const pendingAll = pendingKey === `${index}:all`;
            const pendingConcept = pendingKey === `${index}:concept`;
            const versionStart =
              versionCardCount > 0 ? cards.length - versionCardCount : cards.length;
            const isVersionCard =
              versionCardCount > 0 && index >= versionStart;
            return (
              <Accordion.Item key={`card-${index}`} value={String(index)}>
                <Accordion.Control>
                  <span className={classes.accordionTitle}>
                    {isVersionCard
                      ? `New version · ${card.name || `Character ${index + 1}`}`
                      : card.name || `Character ${index + 1}`}
                  </span>
                </Accordion.Control>
                <Accordion.Panel>
                  <div className={classes.cardPanel}>
                    <div className={classes.cardToolbar}>
                      <div className={classes.toolbarGroup}>
                        <Button
                          type="button"
                          variant="light"
                          size="sm"
                          leftSection={<IconSparkles size={14} />}
                          disabled={busy}
                          loading={pendingConcept}
                          onClick={() => void rebuild(index, "concept")}
                        >
                          {pendingConcept ? "Rebuilding…" : "Rebuild concept"}
                        </Button>
                        <Button
                          type="button"
                          variant="light"
                          size="sm"
                          leftSection={<IconRefresh size={14} />}
                          disabled={busy}
                          loading={pendingAll}
                          onClick={() => void rebuild(index, "all")}
                        >
                          {pendingAll ? "Rebuilding…" : "Rebuild all"}
                        </Button>
                      </div>
                      {lockCardCount ? null : (
                        <ActionIcon type="button" variant="ghostDanger" title="Remove from import" aria-label="Remove from import" disabled={busy || cards.length <= 1} onClick={() => removeCard(index)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </div>

                    <Field
                      label="Rebuild notes (optional)"
                      hint="Extra direction for Rebuild concept / Rebuild all."
                    >
                      <Textarea
                        className={classes.textarea}
                        value={conceptNotes[index] ?? ""}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setConceptNotes((prev) => ({
                            ...prev,
                            [index]: value,
                          }));
                        }}
                        disabled={busy}
                      />
                    </Field>

                    <Field label="Name">
                      <TextInput
                        value={card.name}
                        onChange={(event) =>
                          updateCard(index, { name: event.currentTarget.value })
                        }
                        disabled={busy}
                      />
                    </Field>

                    <FieldWithRebuild
                      label="Description"
                      value={card.description}
                      disabled={busy}
                      loading={pendingKey === `${index}:description`}
                      onChange={(value) =>
                        updateCard(index, { description: value })
                      }
                      onRebuild={() => void rebuild(index, "description")}
                    />
                    <FieldWithRebuild
                      label="Appearance"
                      value={card.appearance}
                      disabled={busy}
                      loading={pendingKey === `${index}:appearance`}
                      onChange={(value) =>
                        updateCard(index, { appearance: value })
                      }
                      onRebuild={() => void rebuild(index, "appearance")}
                    />
                    <FieldWithRebuild
                      label="Personality"
                      value={card.personality}
                      disabled={busy}
                      loading={pendingKey === `${index}:personality`}
                      onChange={(value) =>
                        updateCard(index, { personality: value })
                      }
                      onRebuild={() => void rebuild(index, "personality")}
                    />
                    <AlternateGreetingsEditor
                      label="Relationships"
                      description="One entry per tie to people / the cast."
                      emptyLabel="No relationships yet."
                      value={card.relationships}
                      disabled={busy}
                      onChange={(value) =>
                        updateCard(index, { relationships: value })
                      }
                      action={
                        <Button
                          variant="subtle"
                          type="button"
                          disabled={busy}
                          onClick={() => void rebuild(index, "relationships")}
                        >
                          <IconRefresh size={14} />
                          {pendingKey === `${index}:relationships`
                            ? "Rebuilding…"
                            : "Rebuild"}
                        </Button>
                      }
                    />
                    <FieldWithRebuild
                      label="Scenario"
                      value={card.scenario}
                      disabled={busy}
                      loading={pendingKey === `${index}:scenario`}
                      onChange={(value) =>
                        updateCard(index, { scenario: value })
                      }
                      onRebuild={() => void rebuild(index, "scenario")}
                    />
                    <FieldWithRebuild
                      label="First message"
                      value={card.first_mes}
                      disabled={busy}
                      loading={pendingKey === `${index}:first_mes`}
                      onChange={(value) =>
                        updateCard(index, { first_mes: value })
                      }
                      onRebuild={() => void rebuild(index, "first_mes")}
                    />
                    <FieldWithRebuild
                      label="Example messages"
                      value={card.mes_example}
                      disabled={busy}
                      loading={pendingKey === `${index}:mes_example`}
                      onChange={(value) =>
                        updateCard(index, { mes_example: value })
                      }
                      onRebuild={() => void rebuild(index, "mes_example")}
                    />
                    <AlternateGreetingsEditor
                      value={card.alternate_greetings}
                      disabled={busy}
                      onChange={(value) =>
                        updateCard(index, { alternate_greetings: value })
                      }
                      action={
                        <Button
                          variant="subtle"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void rebuild(index, "alternate_greetings")
                          }
                        >
                          <IconRefresh size={14} />
                          {pendingKey === `${index}:alternate_greetings`
                            ? "Rebuilding…"
                            : "Rebuild"}
                        </Button>
                      }
                    />
                    <Field label="Tags">
                      <TagsInput
                        value={card.tags}
                        onChange={(tags) => updateCard(index, { tags })}
                        disabled={busy}
                      />
                    </Field>
                    <Field label="Creator notes">
                      <Textarea
                        className={classes.textarea}
                        value={card.creator_notes}
                        onChange={(event) =>
                          updateCard(index, {
                            creator_notes: event.currentTarget.value,
                          })
                        }
                        disabled={busy}
                      />
                    </Field>
                  </div>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>

        <div className={classes.actions}>
          <Button
            variant="default"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={onConfirm}
            disabled={pendingKey != null || cards.length === 0}
          >
            {confirming
              ? "Saving…"
              : (confirmLabel ??
                `Save ${cards.length} character${cards.length === 1 ? "" : "s"}`)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FieldWithRebuild(props: {
  label: string;
  description?: string;
  value: string;
  disabled: boolean;
  loading: boolean;
  onChange: (value: string) => void;
  onRebuild: () => void;
}) {
  return (
    <div className={classes.field}>
      <div className={classes.fieldHeader}>
        <span className={classes.fieldLabel}>{props.label}</span>
        <Button
          variant="subtle"
          type="button"
          disabled={props.disabled}
          onClick={props.onRebuild}
        >
          <IconRefresh size={14} />
          {props.loading ? "Rebuilding…" : "Rebuild"}
        </Button>
      </div>
      {props.description ? (
        <p className={classes.fieldHint}>{props.description}</p>
      ) : null}
      <Textarea
        className={classes.textarea}
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
        disabled={props.disabled}
      />
    </div>
  );
}
