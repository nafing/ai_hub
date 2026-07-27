import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { IconPhoto, IconUpload } from "@tabler/icons-react";
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
import {
  Button,
  Textarea,
  Modal,
  MultiSelect,
  notifications,
  Select,
  Switch,
  RuntimeText,
} from "@/components/ui";
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
import classes from "./ImportCharacterModal.module.css";

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

function isAcceptedCharacterFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json") || name.endsWith(".png")) return true;
  if (file.type === "image/png") return true;
  if (file.type.includes("json")) return true;
  return false;
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
      {hint ? <p className={classes.fieldHint}>{hint}</p> : null}
      {children}
      {error ? <p className={classes.fieldError}>{error}</p> : null}
    </div>
  );
}

export function ImportCharacterModal({
  opened,
  onClose,
}: ImportCharacterModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const connectionsQuery = useConnections();
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const presetsQuery = usePresets();
  const defaultPresetQuery = useDefaultPreset("character_generator");

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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
    setDragOver(false);
    resetAiControls();
    onClose();
  }

  async function navigateToCharacter(characterId: string) {
    await navigate({
      to: "/characters/$characterId",
      params: { characterId },
    });
  }

  async function handleFile(file: File) {
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

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    if (importing || parsing) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (!isAcceptedCharacterFile(file)) {
      notifications.show({
        title: "Unsupported file",
        message: "Drop a .json or .png character card.",
        color: "red",
      });
      return;
    }
    void handleFile(file);
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

    const userBrief = generatorBrief.trim();
    const [persona, libraryReferences] = await Promise.all([
      personaId ? getPersona(personaId) : Promise.resolve(null),
      Promise.all(referenceCharacterIds.map((id) => getCharacter(id))),
    ]);
    const promptContext = buildPresetPromptContext({
      generatorBrief: userBrief || null,
      persona,
      referenceCharacterList: [{ data: baseData }, ...libraryReferences],
      variables: {
        ...resolvePresetVariables(preset.variables),
        generation_mode: "import",
        char: baseData.name.trim(),
        target_field: "all card fields",
        existing_description: "",
        existing_personality: "",
        existing_scenario: "",
        existing_first_mes: "",
        existing_mes_example: "",
        existing_alternate_greetings: "",
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
      let created = await createCharacter(
        defaultCharacter({ data: cardsToCreate[index]! }),
      );
      if (index === 0 && preview.avatarFile) {
        created = await uploadCharacterAvatar(
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

  const connectionError = connectionsQuery.isError
    ? "Failed to load connections"
    : !connectionsQuery.isLoading && !connectionsQuery.data?.length
      ? "Create a connection first"
      : undefined;

  const presetError = presetsQuery.isError
    ? "Failed to load presets"
    : presetDetailQuery.isError
      ? "Failed to load preset details"
      : !presetsQuery.isLoading && !presetOptions.length
        ? "No presets available"
        : undefined;

  const personaError = personasQuery.isError
    ? "Failed to load personas"
    : undefined;

  const referenceCharactersError = charactersQuery.isError
    ? "Failed to load characters"
    : undefined;

  const primaryBusy =
    importing || parsing || (importWithAi && presetDetailQuery.isLoading);

  const primaryLabel = importing
    ? importWithAi
      ? "Generating…"
      : "Importing…"
    : importWithAi
      ? "Generate with AI"
      : "Import";

  return (
    <>
      <Modal
        opened={opened && !aiReviewOpen}
        onClose={handleClose}
        title="Import character"
        centered
        size="lg"
      >
        <div className={classes.body}>
          <label
            className={[
              classes.dropzone,
              dragOver ? classes.dropzoneActive : "",
              parsing || importing ? classes.dropzoneDisabled : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              className={classes.fileInput}
              type="file"
              accept="image/png,.png,application/json,.json,text/json"
              disabled={parsing || importing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (!isAcceptedCharacterFile(file)) {
                  notifications.show({
                    title: "Unsupported file",
                    message: "Drop a .json or .png character card.",
                    color: "red",
                  });
                  return;
                }
                void handleFile(file);
              }}
            />
            <span className={classes.dropIcon}>
              {parsing ? (
                <span className={classes.spinner} aria-hidden />
              ) : dragOver ? (
                <IconUpload size={32} stroke={1.5} />
              ) : (
                <IconPhoto size={32} stroke={1.5} />
              )}
            </span>
            <span className={classes.dropTitle}>
              {parsing
                ? "Reading file…"
                : "Drop a character card (.json or .png)"}
            </span>
            <span className={classes.dropHint}>
              PNG cards use the embedded `chara` / `ccv3` chunk. The image is
              stored on the server as the avatar. Embedded `character_book` is
              imported as a linked lorebook. Click to browse.
            </span>
          </label>

          {preview ? (
            <div className={classes.previewRow}>
              {preview.previewUrl ? (
                <img
                  src={preview.previewUrl}
                  alt=""
                  className={classes.previewAvatar}
                />
              ) : null}
              <div className={classes.previewBody}>
                <p className={classes.previewName}>
                  {preview.card.data.name || "untitled"}
                </p>
                <p className={classes.previewMeta}>
                  {preview.fileName} · {preview.source.toUpperCase()}
                  {preview.card.data.creator
                    ? ` · by ${preview.card.data.creator}`
                    : ""}
                  {hasCharacterBook(preview.card.data.character_book)
                    ? ` · character_book (${bookEntryCount ?? 0} entries)`
                    : ""}
                </p>
              </div>
            </div>
          ) : null}

          <Switch
            variant="card"
            checked={importWithAi}
            onChange={setImportWithAi}
            disabled={importing || aiReviewOpen}
            label="Import with AI"
            description="Runs the Character Generator, then opens a preview where you can rebuild concept or individual fields before saving. Multi-character cards become separate previews."
          />

          {importWithAi ? (
            <>
              <div className={classes.grid}>
                <Field
                  label="Connection"
                  hint="Defaults to the active connection."
                  error={connectionError}
                >
                  <Select
                    data={(connectionsQuery.data ?? []).map((connection) => ({
                      value: connection.id,
                      label: `${connection.name || "Untitled"}${connection.is_default ? " (default)" : ""}${connection.model ? ` · ${connection.model}` : ""}`,
                    }))}
                    value={resolvedConnectionId ?? ""}
                    onChange={(value) => setConnectionId(value || null)}
                    placeholder={
                      connectionsQuery.isLoading
                        ? "Loading connections…"
                        : "Select connection"
                    }
                    searchable
                    disabled={importing || !connectionsQuery.data?.length}
                    error={Boolean(connectionError)}
                  />
                </Field>

                <Field
                  label="Preset"
                  hint="Prefer Character Generator presets."
                  error={presetError}
                >
                  <Select
                    data={presetOptions}
                    value={presetId ?? ""}
                    onChange={(value) => setPresetId(value || null)}
                    placeholder={
                      presetsQuery.isLoading
                        ? "Loading presets…"
                        : "Select preset"
                    }
                    searchable
                    disabled={importing || !presetOptions.length}
                    error={Boolean(presetError)}
                  />
                </Field>

                <Field
                  label="Persona"
                  hint={
                    <RuntimeText text="Optional — fills {{user}} and the Persona marker." />
                  }
                  error={personaError}
                >
                  <Select
                    data={(personasQuery.data ?? []).map((persona) => ({
                      value: persona.id,
                      label: `${persona.name || "untitled"}${persona.is_default ? " (default)" : ""}`,
                    }))}
                    value={personaId ?? ""}
                    onChange={(value) => setPersonaId(value || null)}
                    placeholder={
                      personasQuery.isLoading
                        ? "Loading personas…"
                        : "Select persona"
                    }
                    searchable
                    clearable
                    disabled={importing || !personasQuery.data?.length}
                    error={Boolean(personaError)}
                  />
                </Field>

                <Field
                  label="Reference characters"
                  hint="Optional — library cards used as AI context only (not saved as new characters or versions)."
                  error={referenceCharactersError}
                >
                  <MultiSelect
                    data={characterOptions}
                    value={referenceCharacterIds}
                    onChange={setReferenceCharacterIds}
                    placeholder={
                      charactersQuery.isLoading
                        ? "Loading characters…"
                        : "Select characters"
                    }
                    clearable
                    disabled={importing || !characterOptions.length}
                    error={Boolean(referenceCharactersError)}
                  />
                </Field>
              </div>

              <Field
                label="Generator brief"
                hint="Optional — fills the Generator Brief marker."
              >
                <Textarea
                  className={classes.textarea}
                  value={generatorBrief}
                  onChange={(event) =>
                    setGeneratorBrief(event.currentTarget.value)
                  }
                  placeholder="e.g. Adapt this card into a softer rival for my persona, or expand into a duo of twins…"
                  disabled={importing}
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
          <Button variant="primary" type="button"
            disabled={!preview || !aiReady || primaryBusy}
            onClick={() => void handleImport()}
          >
            {primaryLabel}
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
