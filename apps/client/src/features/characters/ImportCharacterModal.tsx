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
  Text,
  Textarea,
} from "@mantine/core";
import { Dropzone, MIME_TYPES } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildPresetPromptContext,
  CharacterImportError,
  defaultCharacter,
  lorebookFromCharacterBook,
  parseCharacterImportFile,
  type CharacterCardData,
  type CharacterCardV2,
  type CreateLorebookInput,
} from "@ai-hub/shared";
import { useConnections } from "@/features/connections/queries";
import { getPersona } from "@/features/personas/api";
import { usePersonas } from "@/features/personas/queries";
import { createCharacter, getCharacter, uploadCharacterAvatar } from "./api";
import {
  extractFullCards,
  extractedToCardData,
  resolvePresetVariables,
} from "./characterGenerateShared";
import {
  ImportAiReviewModal,
  type ImportAiReviewContext,
} from "./ImportAiReviewModal";
import { characterKeys, useCharacters } from "./queries";
import { runGenerator } from "@/features/generators/api";
import {
  useDefaultPreset,
  usePreset,
  usePresets,
} from "@/features/presets/queries";
import { ImportLorebookModal } from "@/features/lorebooks/ImportLorebookModal";

type ImportCharacterModalProps = {
  opened: boolean;
  onClose: () => void;
};

type ImportPreview = {
  card: CharacterCardV2;
  /** Original PNG file for avatar upload (PNG imports only). */
  avatarFile: File | null;
  /** Local preview URL (object URL or none). */
  previewUrl: string | null;
  fileName: string;
  source: "json" | "png";
};

type PendingCharacterBook = {
  lorebook: CreateLorebookInput;
  characterId: string;
};

function hasCharacterBook(
  book: CharacterCardV2["data"]["character_book"],
): book is NonNullable<CharacterCardV2["data"]["character_book"]> {
  return Boolean(book && typeof book === "object" && !Array.isArray(book));
}

export function ImportCharacterModal({
  opened,
  onClose,
}: ImportCharacterModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const connectionsQuery = useConnections();
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const presetsQuery = usePresets();
  const defaultPresetQuery = useDefaultPreset("character_generator");

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importWithAi, setImportWithAi] = useState(false);
  const [generatorBrief, setGeneratorBrief] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [presetInitialized, setPresetInitialized] = useState(false);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [personaInitialized, setPersonaInitialized] = useState(false);
  const [referenceCharacterIds, setReferenceCharacterIds] = useState<string[]>(
    [],
  );
  const [pendingBook, setPendingBook] = useState<PendingCharacterBook | null>(
    null,
  );
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

  function clearPreview() {
    if (preview?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(preview.previewUrl);
    }
    setPreview(null);
  }

  function resetAiControls() {
    setImportWithAi(false);
    setGeneratorBrief("");
    setConnectionId(null);
    setPersonaId(defaultPersonaId);
    setReferenceCharacterIds([]);
    if (defaultPresetQuery.data?.id) {
      setPresetId(defaultPresetQuery.data.id);
    }
  }

  function clearAiReview() {
    setAiReviewOpen(false);
    setAiReviewCards([]);
    setAiReviewContext(null);
    setConfirmingAi(false);
  }

  function handleClose() {
    clearPreview();
    clearAiReview();
    setParsing(false);
    setImporting(false);
    resetAiControls();
    onClose();
  }

  async function navigateToCharacter(characterId: string) {
    await navigate({
      to: "/characters/$characterId",
      params: { characterId },
    });
  }

  async function handleDrop(files: File[]) {
    const file = files[0];
    if (!file) return;
    setParsing(true);
    clearPreview();
    try {
      const bytes = await file.arrayBuffer();
      const { card, source } = await parseCharacterImportFile(file, bytes);
      const avatarFile = source === "png" ? file : null;
      const previewUrl = avatarFile ? URL.createObjectURL(avatarFile) : null;
      setPreview({
        card,
        avatarFile,
        previewUrl,
        fileName: file.name,
        source,
      });
    } catch (error) {
      setPreview(null);
      notifications.show({
        title: "Import failed",
        message:
          error instanceof CharacterImportError || error instanceof Error
            ? error.message
            : "Could not read character card",
        color: "red",
      });
    } finally {
      setParsing(false);
    }
  }

  async function runAiImport(baseData: CharacterCardData): Promise<{
    cards: CharacterCardData[];
  }> {
    if (!resolvedConnectionId) {
      throw new Error("Select a connection to import with AI.");
    }
    const preset = presetDetailQuery.data;
    if (!presetId || !preset) {
      throw new Error("Select a Character Generator preset.");
    }

    const importHint = [
      "IMPORT WITH AI:",
      "The Reference Characters section includes the imported source card first, then any additional library characters selected as context.",
      'If that card or the brief describes TWO OR MORE distinct characters (separate names/identities), you MUST return multiple objects in {"characters":[...]} — one card each.',
      "Do not collapse a duo/group into a single card.",
      "If only one distinct character is present, return a one-item characters array.",
    ].join(" ");

    const userBrief = generatorBrief.trim();
    const [persona, libraryReferences] = await Promise.all([
      personaId ? getPersona(personaId) : Promise.resolve(null),
      Promise.all(referenceCharacterIds.map((id) => getCharacter(id))),
    ]);
    const promptContext = buildPresetPromptContext({
      generatorBrief: userBrief
        ? `${userBrief}\n\n${importHint}`
        : `${importHint} No extra brief was provided — split or refine using the reference card alone.`,
      persona,
      referenceCharacterList: [{ data: baseData }, ...libraryReferences],
      variables: {
        ...resolvePresetVariables(preset.variables),
        char: baseData.name.trim() || "(unnamed — may be one of several)",
        target_field: "all card fields",
        existing_description: "(none yet — build from reference / brief)",
        existing_personality: "(none yet — build from reference / brief)",
        existing_scenario: "(none yet — build from reference / brief)",
        existing_first_mes: "(none yet — build from reference / brief)",
        existing_mes_example: "(none yet — build from reference / brief)",
        existing_alternate_greetings:
          "(none yet — build from reference / brief)",
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
      cards: extracted.map((card, index) => {
        const data = extractedToCardData(card);
        return {
          ...baseData,
          ...data,
          creator: index === 0 ? baseData.creator : (data.creator ?? ""),
          character_version:
            index === 0
              ? baseData.character_version
              : (data.character_version ?? ""),
        };
      }),
    };
  }

  async function persistImportedCards(
    cardsToCreate: CharacterCardData[],
    options: { fromAi: boolean },
  ) {
    if (!preview) return;
    const embeddedBook = preview.card.data.character_book;

    const createdList = [];
    for (let index = 0; index < cardsToCreate.length; index += 1) {
      const created = await createCharacter(
        defaultCharacter({ data: cardsToCreate[index]! }),
      );
      if (index === 0 && preview.avatarFile) {
        await uploadCharacterAvatar(
          created.id,
          preview.avatarFile,
          preview.fileName,
        );
      }
      createdList.push(created);
    }

    const primary = createdList[0]!;
    void queryClient.invalidateQueries({ queryKey: characterKeys.list() });
    notifications.show({
      title: cardsToCreate.length > 1 ? "Imported characters" : "Imported",
      message:
        cardsToCreate.length > 1
          ? `Created ${cardsToCreate.length} characters${options.fromAi ? " with AI" : ""}: ${createdList.map((c) => c.data.name || "untitled").join(", ")}.`
          : `${primary.data.name || "Character"} from ${preview.source.toUpperCase()}${options.fromAi ? " (AI)" : ""}.`,
      color: "green",
    });

    if (hasCharacterBook(embeddedBook)) {
      const lorebook = lorebookFromCharacterBook(embeddedBook, {
        category: "character",
        linked_characters: createdList.map((c) => c.id),
        name:
          (typeof embeddedBook.name === "string" && embeddedBook.name.trim()
            ? embeddedBook.name
            : "") || `${primary.data.name || "Character"} lorebook`,
      });
      handleClose();
      setPendingBook({ lorebook, characterId: primary.id });
      return;
    }

    handleClose();
    await navigateToCharacter(primary.id);
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const { character_book: _omit, ...dataWithoutBook } = preview.card.data;

      if (importWithAi) {
        const preset = presetDetailQuery.data;
        if (!resolvedConnectionId || !presetId || !preset) {
          throw new Error("Select connection and Character Generator preset.");
        }
        const aiResult = await runAiImport(dataWithoutBook);
        setAiReviewCards(aiResult.cards);
        setAiReviewContext({
          connectionId: resolvedConnectionId,
          presetId: preset.id,
          presetVariables: preset.variables,
          personaId,
          referenceCharacterIds,
          sourceCard: dataWithoutBook,
          generatorBrief: generatorBrief.trim(),
        });
        setAiReviewOpen(true);
        return;
      }

      await persistImportedCards([dataWithoutBook], { fromAi: false });
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setImporting(false);
    }
  }

  async function handleConfirmAiReview() {
    if (aiReviewCards.length === 0) return;
    setConfirmingAi(true);
    try {
      await persistImportedCards(aiReviewCards, { fromAi: true });
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setConfirmingAi(false);
    }
  }

  const bookEntryCount = preview?.card.data.character_book?.entries?.length;
  const aiReady =
    !importWithAi ||
    (Boolean(resolvedConnectionId) &&
      Boolean(presetId) &&
      Boolean(presetDetailQuery.data));

  return (
    <>
      <Modal
        opened={opened && !aiReviewOpen}
        onClose={handleClose}
        title="Import character"
        centered
        size="lg"
      >
        <Stack gap="sm">
          <Dropzone
            onDrop={(files) => void handleDrop(files)}
            onReject={() => {
              notifications.show({
                title: "Unsupported file",
                message: "Drop a .json or .png character card.",
                color: "red",
              });
            }}
            accept={[MIME_TYPES.png, "application/json", "text/json"]}
            maxFiles={1}
            loading={parsing}
            disabled={importing}
          >
            <Group
              justify="center"
              gap="md"
              mih={120}
              style={{ pointerEvents: "none" }}
            >
              <Dropzone.Accept>
                <IconUpload size={32} stroke={1.5} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={32} stroke={1.5} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconPhoto size={32} stroke={1.5} />
              </Dropzone.Idle>
              <div>
                <Text size="sm" inline>
                  Drop a character card (.json or .png)
                </Text>
                <Text size="xs" c="dimmed" inline mt={4}>
                  PNG cards use the embedded `chara` / `ccv3` chunk. The image
                  is stored on the server as the avatar. Embedded
                  `character_book` is imported as a linked lorebook.
                </Text>
              </div>
            </Group>
          </Dropzone>

          {preview ? (
            <Group gap="sm" wrap="nowrap" align="start">
              {preview.previewUrl ? (
                <img
                  src={preview.previewUrl}
                  alt=""
                  width={56}
                  height={56}
                  style={{
                    objectFit: "cover",
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                />
              ) : null}
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={600} lineClamp={1}>
                  {preview.card.data.name || "untitled"}
                </Text>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {preview.fileName} · {preview.source.toUpperCase()}
                  {preview.card.data.creator
                    ? ` · by ${preview.card.data.creator}`
                    : ""}
                  {hasCharacterBook(preview.card.data.character_book)
                    ? ` · character_book (${bookEntryCount ?? 0} entries)`
                    : ""}
                </Text>
              </div>
            </Group>
          ) : null}

          <Checkbox
            label="Import with AI"
            description="Runs the Character Generator, then opens a preview where you can rebuild concept or individual fields before saving. Multi-character cards become separate previews."
            checked={importWithAi}
            onChange={(event) => setImportWithAi(event.currentTarget.checked)}
            disabled={importing || aiReviewOpen}
          />

          {importWithAi ? (
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
                  disabled={importing || !connectionsQuery.data?.length}
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
                  disabled={importing || !presetOptions.length}
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
                  disabled={importing || !personasQuery.data?.length}
                  error={
                    personasQuery.isError
                      ? "Failed to load personas"
                      : undefined
                  }
                />

                <MultiSelect
                  label="Reference characters"
                  description="Optional — extra library cards added after the imported source in the Reference Characters marker."
                  placeholder={
                    charactersQuery.isLoading
                      ? "Loading characters…"
                      : "Select characters"
                  }
                  clearable
                  data={characterOptions}
                  value={referenceCharacterIds}
                  onChange={setReferenceCharacterIds}
                  disabled={importing || !characterOptions.length}
                  error={
                    charactersQuery.isError
                      ? "Failed to load characters"
                      : undefined
                  }
                />
              </SimpleGrid>

              <Textarea
                label="Generator brief"
                description="Optional — fills the Generator Brief marker."
                autosize
                minRows={4}
                value={generatorBrief}
                onChange={(event) =>
                  setGeneratorBrief(event.currentTarget.value)
                }
                placeholder="e.g. Adapt this card into a softer rival for my persona, or expand into a duo of twins…"
                disabled={importing}
              />
            </>
          ) : null}
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button variant="default" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleImport()}
            loading={
              importing ||
              parsing ||
              (importWithAi && presetDetailQuery.isLoading)
            }
            disabled={!preview || !aiReady}
          >
            {importWithAi ? "Generate with AI" : "Import"}
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
          onConfirm={() => void handleConfirmAiReview()}
          onCancel={() => {
            clearAiReview();
          }}
        />
      ) : null}

      <ImportLorebookModal
        opened={pendingBook != null}
        title="Import character lorebook"
        sourceLabel="character card character_book"
        initialLorebook={pendingBook?.lorebook ?? null}
        onClose={() => {
          const characterId = pendingBook?.characterId;
          setPendingBook(null);
          if (characterId) {
            void navigateToCharacter(characterId);
          }
        }}
        onImported={() => false}
      />
    </>
  );
}
