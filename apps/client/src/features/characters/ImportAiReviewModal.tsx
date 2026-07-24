import { useMemo, useState } from "react";
import {
  Accordion,
  ActionIcon,
  Button,
  Group,
  Modal,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconRefresh, IconSparkles, IconTrash } from "@tabler/icons-react";
import {
  buildPresetPromptContext,
  defaultCharacterCardData,
  type CharacterCardData,
  type Variable,
} from "@ai-hub/shared";
import { getCharacter } from "@/features/characters/api";
import { getPersona } from "@/features/personas/api";
import { runGenerator } from "@/features/generators/api";
import {
  extractFullCards,
  extractedToCardData,
  formatAlternateGreetingsForPrompt,
  mergeExtractedIntoCardData,
  normalizeFullCard,
  resolvePresetVariables,
  stripCodeFence,
  type ExtractedCharacterCard,
} from "./characterGenerateShared";
import { AlternateGreetingsEditor } from "./AlternateGreetingsEditor";

export type ImportAiReviewContext = {
  connectionId: string;
  presetId: string;
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
  title?: string;
  confirmLabel?: string;
};

type RebuildKind =
  | "all"
  | "concept"
  | "description"
  | "personality"
  | "scenario"
  | "first_mes"
  | "mes_example"
  | "alternate_greetings";

const CONCEPT_FIELDS = [
  "name",
  "description",
  "personality",
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
    if (field === "alternate_greetings") {
      const value = record.alternate_greetings;
      if (Array.isArray(value) || typeof value === "string") {
        return normalizeFullCard({ alternate_greetings: value });
      }
      return {};
    }
    const value = record[field];
    if (typeof value === "string" && value.trim()) {
      return { [field]: value.trim() };
    }
    return {};
  } catch {
    if (field === "alternate_greetings") return {};
    return { [field]: text };
  }
}

function targetFieldForRebuild(kind: RebuildKind): string {
  if (kind === "all") return "all card fields";
  if (kind === "concept") return "all card fields";
  return kind;
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
      cards.map((card, i) =>
        i === index ? { ...card, ...patch } : card,
      ),
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
      const roster = cards
        .map(
          (card, index) =>
            `${index + 1}. ${card.name.trim() || `Character ${index + 1}`}`,
        )
        .join("\n");

      const rebuildHint = [
        `REBUILD CONCEPT for ALL ${cards.length} characters in one pass.`,
        "Regenerate name, description, personality, and scenario for each.",
        "Keep first_mes, mes_example, alternate_greetings, tags, and advanced fields unless they contradict the new concepts.",
        "Preserve distinct identities and relationships between characters; keep the same cast size and order.",
        `Current roster (same order expected in output):\n${roster}`,
        `Return exactly ${cards.length} objects in {"characters":[...]} — one per character, same order.`,
        note ? `Extra direction: ${note}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const briefParts = [context.generatorBrief.trim(), rebuildHint].filter(
        Boolean,
      );

      const promptContext = buildPresetPromptContext({
        generatorBrief: briefParts.join("\n\n"),
        persona,
        referenceCharacterList: [
          ...libraryReferences,
          { data: context.sourceCard },
          ...cards.map((data) => ({ data })),
        ],
        variables: {
          ...resolvePresetVariables(context.presetVariables),
          char:
            cards
              .map((card) => card.name.trim())
              .filter(Boolean)
              .join(" / ") || "(unnamed cast)",
          target_field: "all card fields",
          existing_description: "(see reference characters — rebuild concepts)",
          existing_personality: "(see reference characters — rebuild concepts)",
          existing_scenario: "(see reference characters — rebuild concepts)",
          existing_first_mes: "(keep unless concept requires change)",
          existing_mes_example: "(keep unless concept requires change)",
          existing_alternate_greetings: "(keep unless concept requires change)",
        },
      });

      const result = await runGenerator({
        category: "character_generator",
        connectionId: context.connectionId,
        presetId: context.presetId,
        variables: promptContext.variables,
        markers: promptContext.markers,
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
      const rebuildHint =
        kind === "concept"
          ? `REBUILD CONCEPT only for this character: regenerate name, description, personality, and scenario. Keep first_mes, mes_example, alternate_greetings, tags, and advanced fields unless they contradict the new concept.${note ? ` Extra direction: ${note}` : ""} Return a one-item {"characters":[...]} array.`
          : kind === "all"
            ? `REBUILD this entire character card from scratch using the reference card(s) and brief.${note ? ` Extra direction: ${note}` : ""} Return a one-item {"characters":[...]} array.`
            : `Rebuild only the "${kind}" field for this character.`;

      const briefParts = [
        context.generatorBrief.trim(),
        rebuildHint,
      ].filter(Boolean);

      const promptContext = buildPresetPromptContext({
        generatorBrief: briefParts.join("\n\n"),
        persona,
        referenceCharacterList: [
          ...libraryReferences,
          { data: context.sourceCard },
          { data: card },
        ],
        variables: {
          ...resolvePresetVariables(context.presetVariables),
          char: card.name.trim() || "(unnamed)",
          target_field: targetFieldForRebuild(kind),
          existing_description: card.description.trim() || "(none yet)",
          existing_personality: card.personality.trim() || "(none yet)",
          existing_scenario: card.scenario.trim() || "(none yet)",
          existing_first_mes: card.first_mes.trim() || "(none yet)",
          existing_mes_example: card.mes_example.trim() || "(none yet)",
          existing_alternate_greetings: formatAlternateGreetingsForPrompt(
            card.alternate_greetings,
          ),
        },
      });

      const result = await runGenerator({
        category: "character_generator",
        connectionId: context.connectionId,
        presetId: context.presetId,
        variables: promptContext.variables,
        markers: promptContext.markers,
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
      centered
      size="xl"
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Preview and edit generated cards before saving. Batch Rebuild Concept
          refreshes name / description / personality / scenario for every card
          in one pass; per-card Rebuild concept / Rebuild all work on a single
          character.
        </Text>

        <Stack gap="xs">
          <Textarea
            label="Batch rebuild notes (optional)"
            description="Extra direction applied when rebuilding all concepts together."
            autosize
            minRows={2}
            value={batchConceptNotes}
            onChange={(event) =>
              setBatchConceptNotes(event.currentTarget.value)
            }
            disabled={busy}
          />
          <Group>
            <Button
              variant="light"
              leftSection={<IconSparkles size={16} />}
              loading={pendingKey === "batch:concept"}
              disabled={busy || cards.length === 0}
              onClick={() => void rebuildAllConcepts()}
            >
              Rebuild Concept
              {cards.length > 1 ? ` (${cards.length})` : ""}
            </Button>
          </Group>
        </Stack>

        <Accordion variant="separated" defaultValue={accordionDefault}>
          {cards.map((card, index) => {
            const pendingAll = pendingKey === `${index}:all`;
            const pendingConcept = pendingKey === `${index}:concept`;
            return (
              <Accordion.Item key={`card-${index}`} value={String(index)}>
                <Accordion.Control>
                  <Group justify="space-between" pr="sm" wrap="nowrap">
                    <Text fw={600} lineClamp={1}>
                      {card.name || `Character ${index + 1}`}
                    </Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Group justify="space-between" wrap="wrap">
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconSparkles size={14} />}
                          loading={pendingConcept}
                          disabled={busy}
                          onClick={() => void rebuild(index, "concept")}
                        >
                          Rebuild concept
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconRefresh size={14} />}
                          loading={pendingAll}
                          disabled={busy}
                          onClick={() => void rebuild(index, "all")}
                        >
                          Rebuild all
                        </Button>
                      </Group>
                      {lockCardCount ? null : (
                        <Tooltip label="Remove from import">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            disabled={busy || cards.length <= 1}
                            onClick={() => removeCard(index)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>

                    <Textarea
                      label="Rebuild notes (optional)"
                      description="Extra direction for Rebuild concept / Rebuild all."
                      autosize
                      minRows={2}
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

                    <TextInput
                      label="Name"
                      value={card.name}
                      onChange={(event) =>
                        updateCard(index, { name: event.currentTarget.value })
                      }
                      disabled={busy}
                    />

                    <FieldWithRebuild
                      label="Description"
                      value={card.description}
                      minRows={3}
                      disabled={busy}
                      loading={pendingKey === `${index}:description`}
                      onChange={(value) =>
                        updateCard(index, { description: value })
                      }
                      onRebuild={() => void rebuild(index, "description")}
                    />
                    <FieldWithRebuild
                      label="Personality"
                      value={card.personality}
                      minRows={2}
                      disabled={busy}
                      loading={pendingKey === `${index}:personality`}
                      onChange={(value) =>
                        updateCard(index, { personality: value })
                      }
                      onRebuild={() => void rebuild(index, "personality")}
                    />
                    <FieldWithRebuild
                      label="Scenario"
                      value={card.scenario}
                      minRows={2}
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
                      minRows={3}
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
                      minRows={3}
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
                      minRows={3}
                      onChange={(value) =>
                        updateCard(index, { alternate_greetings: value })
                      }
                      action={
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={<IconRefresh size={14} />}
                          loading={pendingKey === `${index}:alternate_greetings`}
                          disabled={busy}
                          onClick={() =>
                            void rebuild(index, "alternate_greetings")
                          }
                        >
                          Rebuild
                        </Button>
                      }
                    />
                    <TagsInput
                      label="Tags"
                      value={card.tags}
                      onChange={(tags) => updateCard(index, { tags })}
                      disabled={busy}
                    />
                    <Textarea
                      label="Creator notes"
                      autosize
                      minRows={2}
                      value={card.creator_notes}
                      onChange={(event) =>
                        updateCard(index, {
                          creator_notes: event.currentTarget.value,
                        })
                      }
                      disabled={busy}
                    />
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            loading={confirming}
            disabled={pendingKey != null || cards.length === 0}
          >
            {confirmLabel ??
              `Save ${cards.length} character${cards.length === 1 ? "" : "s"}`}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function FieldWithRebuild(props: {
  label: string;
  description?: string;
  value: string;
  minRows: number;
  disabled: boolean;
  loading: boolean;
  onChange: (value: string) => void;
  onRebuild: () => void;
}) {
  return (
    <Stack gap={4}>
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <Text size="sm" fw={500}>
          {props.label}
        </Text>
        <Button
          size="xs"
          variant="subtle"
          leftSection={<IconRefresh size={14} />}
          loading={props.loading}
          disabled={props.disabled}
          onClick={props.onRebuild}
        >
          Rebuild
        </Button>
      </Group>
      <Textarea
        description={props.description}
        autosize
        minRows={props.minRows}
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
        disabled={props.disabled}
      />
    </Stack>
  );
}
