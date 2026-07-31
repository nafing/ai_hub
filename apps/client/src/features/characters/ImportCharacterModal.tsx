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
  CharacterImportError,
  defaultCharacter,
  lorebookFromCharacterBook,
  parseCharacterImportFile,
  type CharacterCardData,
  type CharacterCardV2,
  type CreateLorebookInput,
  type Variable,
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
import { useConnectionSelectOptions } from "@/features/connections/queries";
import { useGeneratorPresetSelection } from "@/features/generator-presets/useGeneratorPresetSelection";
import { usePersonas } from "@/features/personas/queries";
import { SetupVariablesModal } from "@/features/presets/SetupVariablesModal";
import { persistPresetVariableSelection } from "@/features/presets/persistPresetVariableSelection";
import { presetKeys } from "@/features/presets/queries";
import { createCharacter, uploadCharacterAvatar } from "./api";
import { useCharacterImportSessionStore } from "./characterImportSessionStore";
import { characterKeys, useCharacters } from "./queries";
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
  const connectionsQuery = useConnectionSelectOptions("llm");
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const generatorSelection = useGeneratorPresetSelection("character_generator");

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importWithAi, setImportWithAi] = useState(false);
  const [generatorBrief, setGeneratorBrief] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [personaInitialized, setPersonaInitialized] = useState(false);
  const [referenceCharacterIds, setReferenceCharacterIds] = useState<string[]>(
    [],
  );
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [pendingBook, setPendingBook] = useState<PendingCharacterBook | null>(
    null,
  );
  const startBackgroundImport = useCharacterImportSessionStore(
    (state) => state.startAiImport,
  );

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
    setVariablesOpen(false);
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
    clearPreview();
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
        if (
          !resolvedConnectionId ||
          !generatorPresetId ||
          !generatorPreset ||
          !structuralPresetId ||
          !preset
        ) {
          throw new Error("Select connection and Character Generator Preset.");
        }
        startBackgroundImport({
          preview,
          connectionId: resolvedConnectionId,
          preset,
          generatorPresetId,
          generatorPrompts: generatorPreset,
          personaId,
          referenceCharacterIds,
          generatorBrief: generatorBrief.trim(),
        });
        onClose();
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

  const bookEntryCount = preview?.card.data.character_book?.entries?.length;
  const aiReady =
    !importWithAi ||
    (Boolean(resolvedConnectionId) &&
      Boolean(generatorPresetId) &&
      Boolean(generatorPreset) &&
      Boolean(structuralPresetId) &&
      Boolean(preset));

  const connectionError = connectionsQuery.isError
    ? "Failed to load connections"
    : !connectionsQuery.isLoading && !connectionsQuery.options.length
      ? "Create a connection first"
      : undefined;

  const personaError = personasQuery.isError
    ? "Failed to load personas"
    : undefined;

  const referenceCharactersError = charactersQuery.isError
    ? "Failed to load characters"
    : undefined;

  const primaryBusy =
    importing || parsing || (importWithAi && presetLoading);

  const primaryLabel = importing
    ? importWithAi
      ? "Starting…"
      : "Importing…"
    : importWithAi
      ? "Generate in background"
      : "Import";

  return (
    <>
      <Modal
        opened={opened}
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
            disabled={importing}
            label="Import with AI"
            description="Runs in the background. You can close this modal and use chats or Activity while it generates. Review opens when ready."
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
                    data={connectionsQuery.options}
                    value={resolvedConnectionId ?? ""}
                    onChange={(value) => setConnectionId(value || null)}
                    placeholder={
                      connectionsQuery.isLoading
                        ? "Loading connections…"
                        : "Select connection"
                    }
                    searchable
                    disabled={importing || !connectionsQuery.options.length}
                    error={Boolean(connectionError)}
                  />
                </Field>

                <Field
                  label="Generator Preset"
                  hint="Main prompt + linked structural Preset for Character Generator."
                  error={presetError}
                >
                  <Select
                    data={generatorPresetOptions}
                    value={generatorPresetId ?? ""}
                    onChange={(value) => setGeneratorPresetId(value || null)}
                    placeholder={
                      generatorListLoading
                        ? "Loading generator presets…"
                        : "Select generator preset"
                    }
                    searchable
                    disabled={importing || !generatorPresetOptions.length}
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

              {hasPresetVariables ? (
                <div className={classes.variablesRow}>
                  <Button
                    type="button"
                    variant="default"
                    disabled={importing || !preset}
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

      <SetupVariablesModal
        opened={variablesOpen}
        onClose={() => setVariablesOpen(false)}
        variables={preset?.variables ?? []}
        onApply={(variables) => void handleApplyVariables(variables)}
      />

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
