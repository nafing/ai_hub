import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildPresetPromptContext,
  defaultCharacter,
  defaultCharacterCardData,
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

type CreateCharacterModalProps = {
  opened: boolean;
  onClose: () => void;
};

export function CreateCharacterModal({
  opened,
  onClose,
}: CreateCharacterModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createMutation = useCreateCharacter();
  const connectionsQuery = useConnections();
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const presetsQuery = usePresets();
  const defaultPresetQuery = useDefaultPreset("character_generator");

  const [name, setName] = useState("");
  const [createWithAi, setCreateWithAi] = useState(false);
  const [generatorBrief, setGeneratorBrief] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [presetInitialized, setPresetInitialized] = useState(false);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [personaInitialized, setPersonaInitialized] = useState(false);
  const [referenceCharacterIds, setReferenceCharacterIds] = useState<string[]>(
    [],
  );
  const [generating, setGenerating] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [aiReviewCards, setAiReviewCards] = useState<CharacterCardData[]>([]);
  const [aiReviewContext, setAiReviewContext] =
    useState<ImportAiReviewContext | null>(null);
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
    const preset = presetDetailQuery.data;
    if (!presetId || !preset) {
      throw new Error("Select a Character Generator preset.");
    }

    const brief = generatorBrief.trim();
    if (!brief) {
      throw new Error("Enter a generator brief describing the character(s).");
    }

    const seedName = name.trim();
    const sourceCard = defaultCharacterCardData(
      seedName ? { name: seedName } : undefined,
    );

    const createHint = [
      "CREATE WITH AI:",
      "Build one or more new character cards from the Generator Brief (and optional Name seed).",
      "There is no imported source card — invent the cast from the brief.",
      "Reference Characters (if any) are existing library cards the new one(s) should fit with — do not copy them wholesale.",
      'If the brief describes TWO OR MORE distinct characters (separate names/identities), you MUST return multiple objects in {"characters":[...]} — one card each.',
      "Do not collapse a duo/group into a single card.",
      "If only one distinct character is requested, return a one-item characters array.",
      seedName
        ? `Optional name seed for the primary / first character: "${seedName}" (you may refine or rename if the brief implies otherwise).`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    const [persona, referenceCharacters] = await Promise.all([
      personaId ? getPersona(personaId) : Promise.resolve(null),
      Promise.all(referenceCharacterIds.map((id) => getCharacter(id))),
    ]);
    const promptContext = buildPresetPromptContext({
      generatorBrief: `${brief}\n\n${createHint}`,
      persona,
      referenceCharacterList: referenceCharacters,
      variables: {
        ...resolvePresetVariables(preset.variables),
        char:
          seedName || "(unnamed — invent from brief; may be one of several)",
        target_field: "all card fields",
        existing_description: "(none yet — create from brief)",
        existing_personality: "(none yet — create from brief)",
        existing_scenario: "(none yet — create from brief)",
        existing_first_mes: "(none yet — create from brief)",
        existing_mes_example: "(none yet — create from brief)",
        existing_alternate_greetings: "(none yet — create from brief)",
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
      const preset = presetDetailQuery.data;
      if (!resolvedConnectionId || !presetId || !preset) {
        throw new Error("Select connection and Character Generator preset.");
      }
      const aiResult = await runAiCreate();
      setAiReviewCards(aiResult.cards);
      setAiReviewContext({
        connectionId: resolvedConnectionId,
        presetId: preset.id,
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
    Boolean(presetId) &&
    Boolean(presetDetailQuery.data) &&
    Boolean(generatorBrief.trim());

  const busy =
    createMutation.isPending || generating || confirmingAi || aiReviewOpen;

  return (
    <>
      <Modal
        opened={opened && !aiReviewOpen}
        onClose={handleClose}
        title="New character"
        centered
        size={createWithAi ? "lg" : "md"}
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            description={
              createWithAi
                ? "Optional seed for the primary character — the model may refine it."
                : "Replaces `{{char}}` in prompts."
            }
            placeholder="Aria"
            data-autofocus
            required={!createWithAi}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            disabled={busy}
          />

          <Checkbox
            label="Create with AI"
            description="Runs the Character Generator from a brief, then opens a preview where you can rebuild concept or individual fields before saving. Multi-character briefs become separate cards."
            checked={createWithAi}
            onChange={(event) => setCreateWithAi(event.currentTarget.checked)}
            disabled={busy}
          />

          {createWithAi ? (
            <>
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
                    presetsQuery.isLoading
                      ? "Loading presets…"
                      : "Select preset"
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
                    personasQuery.isError
                      ? "Failed to load personas"
                      : undefined
                  }
                />

                <MultiSelect
                  label="Reference characters"
                  description="Optional — fills the Reference Characters marker."
                  placeholder={
                    charactersQuery.isLoading
                      ? "Loading characters…"
                      : "Select characters"
                  }
                  searchable
                  clearable
                  data={characterOptions}
                  value={referenceCharacterIds}
                  onChange={setReferenceCharacterIds}
                  disabled={busy || !characterOptions.length}
                  error={
                    charactersQuery.isError
                      ? "Failed to load characters"
                      : undefined
                  }
                />
              </SimpleGrid>

              <Textarea
                label="Generator brief"
                description="Required — fills the Generator Brief marker (concept / cast / tone)."
                autosize
                minRows={4}
                withAsterisk
                value={generatorBrief}
                onChange={(event) =>
                  setGeneratorBrief(event.currentTarget.value)
                }
                placeholder="e.g. A soft-spoken clockmaker who repairs forbidden automata; dry wit, ink-stained hands…"
                disabled={busy}
              />
            </>
          ) : null}
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button variant="default" type="button" onClick={handleClose}>
            Cancel
          </Button>
          {createWithAi ? (
            <Button
              onClick={() => void handleGenerateWithAi()}
              loading={generating || presetDetailQuery.isLoading}
              disabled={!aiReady || busy}
            >
              Generate with AI
            </Button>
          ) : (
            <Button
              onClick={() => void handleCreateBlank()}
              loading={createMutation.isPending}
              disabled={!name.trim() || busy}
            >
              Create
            </Button>
          )}
        </Group>
      </Modal>

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
