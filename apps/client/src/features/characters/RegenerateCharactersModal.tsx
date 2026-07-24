import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Group,
  Modal,
  MultiSelect,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildPresetPromptContext,
  type CharacterCardData,
} from "@ai-hub/shared";
import { useConnections } from "@/features/connections/queries";
import { runGenerator } from "@/features/generators/api";
import { getPersona } from "@/features/personas/api";
import { usePersonas } from "@/features/personas/queries";
import {
  useDefaultPreset,
  usePreset,
  usePresets,
} from "@/features/presets/queries";
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

type RegenerateScope = "concept" | "all";

const CONCEPT_FIELDS = [
  "name",
  "description",
  "personality",
  "scenario",
] as const;

type RegenerateCharactersModalProps = {
  opened: boolean;
  onClose: () => void;
};

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
  const connectionsQuery = useConnections();
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const presetsQuery = usePresets();
  const defaultPresetQuery = useDefaultPreset("character_generator");

  const [targetCharacterIds, setTargetCharacterIds] = useState<string[]>([]);
  const [generatorBrief, setGeneratorBrief] = useState("");
  const [scope, setScope] = useState<RegenerateScope>("concept");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [presetInitialized, setPresetInitialized] = useState(false);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [personaInitialized, setPersonaInitialized] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [aiReviewCards, setAiReviewCards] = useState<CharacterCardData[]>([]);
  const [aiReviewContext, setAiReviewContext] =
    useState<ImportAiReviewContext | null>(null);
  const [reviewTargetIds, setReviewTargetIds] = useState<string[]>([]);
  const [confirmingAi, setConfirmingAi] = useState(false);

  const defaultConnectionId =
    connectionsQuery.data?.find((connection) => connection.is_default)?.id ??
    connectionsQuery.data?.[0]?.id ??
    null;

  const defaultPersonaId =
    personasQuery.data?.find((persona) => persona.is_default)?.id ?? null;

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
      characterPresets.length > 0 ? characterPresets : (presetsQuery.data ?? []);
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
    if (defaultPresetQuery.data?.id) {
      setPresetId(defaultPresetQuery.data.id);
    }
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
    const preset = presetDetailQuery.data;
    if (!presetId || !preset) {
      throw new Error("Select a Character Generator preset.");
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
    const roster = targetCards
      .map(
        (card, index) =>
          `${index + 1}. ${card.name.trim() || `Character ${index + 1}`}`,
      )
      .join("\n");

    const regenerateHint =
      scope === "concept"
        ? [
            `REGENERATE CONCEPT for ALL ${targetCards.length} selected characters in one pass.`,
            "Regenerate name, description, personality, and scenario for each.",
            "Keep first_mes, mes_example, alternate_greetings, tags, and advanced fields unless they contradict the new concepts.",
            "Preserve distinct identities and relationships; keep the same cast size and order.",
            `Current roster (same order expected in output):\n${roster}`,
            `Return exactly ${targetCards.length} objects in {"characters":[...]} — one per character, same order.`,
          ].join(" ")
        : [
            `REGENERATE FULL CARD for ALL ${targetCards.length} selected characters in one pass.`,
            "Rebuild each character card from scratch using the Generator Brief and reference cards.",
            "Preserve distinct identities and relationships; keep the same cast size and order.",
            `Current roster (same order expected in output):\n${roster}`,
            `Return exactly ${targetCards.length} objects in {"characters":[...]} — one per character, same order.`,
          ].join(" ");

    const promptContext = buildPresetPromptContext({
      generatorBrief: `${brief}\n\n${regenerateHint}`,
      persona,
      referenceCharacterList: targets,
      variables: {
        ...resolvePresetVariables(preset.variables),
        char:
          targetCards
            .map((card) => card.name.trim())
            .filter(Boolean)
            .join(" / ") || "(unnamed cast)",
        target_field: "all card fields",
        existing_description:
          scope === "concept"
            ? "(see reference characters — regenerate concepts)"
            : "(see reference characters — regenerate full cards)",
        existing_personality:
          scope === "concept"
            ? "(see reference characters — regenerate concepts)"
            : "(see reference characters — regenerate full cards)",
        existing_scenario:
          scope === "concept"
            ? "(see reference characters — regenerate concepts)"
            : "(see reference characters — regenerate full cards)",
        existing_first_mes:
          scope === "concept"
            ? "(keep unless concept requires change)"
            : "(see reference characters — regenerate)",
        existing_mes_example:
          scope === "concept"
            ? "(keep unless concept requires change)"
            : "(see reference characters — regenerate)",
        existing_alternate_greetings:
          scope === "concept"
            ? "(keep unless concept requires change)"
            : "(see reference characters — regenerate)",
      },
    });

    const result = await runGenerator({
      category: "character_generator",
      connectionId: resolvedConnectionId,
      presetId: preset.id,
      variables: promptContext.variables,
      markers: promptContext.markers,
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
      const preset = presetDetailQuery.data;
      if (!resolvedConnectionId || !presetId || !preset) {
        throw new Error("Select connection and Character Generator preset.");
      }
      const aiResult = await runAiRegenerate();
      setReviewTargetIds(aiResult.targetIds);
      setAiReviewCards(aiResult.cards);
      setAiReviewContext({
        connectionId: resolvedConnectionId,
        presetId: preset.id,
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
        const updated = await updateCharacter(id, { data });
        updatedNames.push(updated.data.name || "untitled");
      }

      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
      notifications.show({
        title:
          reviewTargetIds.length > 1
            ? "Regenerated characters"
            : "Regenerated",
        message:
          reviewTargetIds.length > 1
            ? `Updated ${reviewTargetIds.length} characters: ${updatedNames.join(", ")}.`
            : `${updatedNames[0]} updated.`,
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
    Boolean(presetId) &&
    Boolean(presetDetailQuery.data) &&
    Boolean(generatorBrief.trim());

  const busy = generating || confirmingAi || aiReviewOpen;

  return (
    <>
      <Modal
        opened={opened && !aiReviewOpen}
        onClose={handleClose}
        title="Regenerate characters"
        centered
        size="lg"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Rebuild selected library characters under one brief, preview the
            results, then save updates back to the same cards.
          </Text>

          <MultiSelect
            label="Characters"
            description="Targets to regenerate — order is preserved in the AI pass."
            placeholder={
              charactersQuery.isLoading
                ? "Loading characters…"
                : "Select characters"
            }
            searchable
            clearable
            data={characterOptions}
            value={targetCharacterIds}
            onChange={setTargetCharacterIds}
            disabled={busy || !characterOptions.length}
            error={
              charactersQuery.isError
                ? "Failed to load characters"
                : !charactersQuery.isLoading && !characterOptions.length
                  ? "Create a character first"
                  : undefined
            }
            withAsterisk
          />

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Scope
            </Text>
            <SegmentedControl
              fullWidth
              value={scope}
              onChange={(value) => setScope(value as RegenerateScope)}
              disabled={busy}
              data={[
                { label: "Concept", value: "concept" },
                { label: "Full card", value: "all" },
              ]}
            />
            <Text size="xs" c="dimmed">
              {scope === "concept"
                ? "Updates name, description, personality, and scenario."
                : "Rebuilds all main card fields from the brief."}
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
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
              disabled={busy || !connectionsQuery.data?.length}
              error={
                connectionsQuery.isError
                  ? "Failed to load connections"
                  : !connectionsQuery.isLoading &&
                      !connectionsQuery.data?.length
                    ? "Create a connection first"
                    : undefined
              }
            />
            <Select
              label="Preset"
              description="Prefer Character Generator presets."
              placeholder={
                presetsQuery.isLoading ? "Loading presets…" : "Select preset"
              }
              data={presetOptions}
              value={presetId}
              onChange={setPresetId}
              searchable
              clearable={false}
              allowDeselect={false}
              disabled={busy || !presetOptions.length}
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
                personasQuery.isLoading
                  ? "Loading personas…"
                  : "Select persona"
              }
              data={(personasQuery.data ?? []).map((persona) => ({
                value: persona.id,
                label: `${persona.name || "untitled"}${persona.is_default ? " (default)" : ""}`,
              }))}
              value={personaId}
              onChange={setPersonaId}
              searchable
              clearable
              disabled={busy || !personasQuery.data?.length}
              error={
                personasQuery.isError ? "Failed to load personas" : undefined
              }
            />
          </SimpleGrid>

          <Textarea
            label="Generator brief"
            description="Required — direction for the regenerate pass."
            autosize
            minRows={4}
            withAsterisk
            value={generatorBrief}
            onChange={(event) => setGeneratorBrief(event.currentTarget.value)}
            placeholder="e.g. Shift the whole cast into a noir port city; keep relationships, darken the tone…"
            disabled={busy}
          />
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button variant="default" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleGenerate()}
            loading={generating || presetDetailQuery.isLoading}
            disabled={!aiReady || busy}
          >
            Generate with AI
          </Button>
        </Group>
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
          confirmLabel={`Update ${aiReviewCards.length} character${aiReviewCards.length === 1 ? "" : "s"}`}
          onConfirm={() => void handleConfirmAiReview()}
          onCancel={() => {
            clearAiReview();
          }}
        />
      ) : null}
    </>
  );
}
