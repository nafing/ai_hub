import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  IconArrowLeft,
  IconDownload,
  IconExternalLink,
} from "@tabler/icons-react";
import { useNavigate, getRouteApi } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CharacterImportError, type CreateLorebookInput, type Variable } from "@ai-hub/shared";
import {
  ActionIcon,
  Button,
  MultiSelect,
  notifications,
  RuntimeText,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { importBotbooruPost } from "@/features/shared/characters/botbooru/importPost";
import { isBotbooruPostImported } from "@/features/shared/characters/botbooru/imported";
import { useBotbooruPost } from "@/features/api-queries/characters/botbooru/queries";
import {
  botbooruContentRating,
  botbooruDisplayName,
} from "@/features/shared/characters/botbooru/types";
import { useCharacterImportSessionStore } from "@/features/shared/characters/characterImportSessionStore";
import { characterKeys, useCharacters } from "@/features/api-queries/characters/queries";
import { useConnectionSelectOptions } from "@/features/api-queries/connections/queries";
import { useGeneratorPresetSelection } from "@/features/shared/generator-presets/useGeneratorPresetSelection";
import { usePersonas } from "@/features/api-queries/personas/queries";
import { SetupVariablesModal } from "@/features/modals/presets/SetupVariablesModal";
import { persistPresetVariableSelection } from "@/features/shared/presets/persistPresetVariableSelection";
import { presetKeys } from "@/features/api-queries/presets/queries";
import { ImportLorebookModal } from "@/features/modals/lorebooks/ImportLorebookModal";
import classes from "./CharacterImportCardPage.module.css";

const routeApi = getRouteApi("/_app/characters/import/$cardId/");

type PendingBook = {
  lorebook: CreateLorebookInput;
  characterId: string;
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
    <div className={classes.aiField}>
      <span className={classes.aiFieldLabel}>{label}</span>
      {hint ? <p className={classes.aiFieldHint}>{hint}</p> : null}
      {children}
      {error ? <p className={classes.aiFieldError}>{error}</p> : null}
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <section className={classes.detailSection}>
      <h3 className={classes.detailSectionTitle}>{title}</h3>
      <div className={classes.detailSectionBody}>{children}</div>
    </section>
  );
}

export function CharacterImportCardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { cardId } = routeApi.useParams();
  const postId = Number(cardId);

  const postQuery = useBotbooruPost(postId);
  const connectionsQuery = useConnectionSelectOptions("llm");
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const generatorSelection = useGeneratorPresetSelection("character_generator");
  const startBackgroundImport = useCharacterImportSessionStore(
    (state) => state.startAiImport,
  );

  const [importWithAi, setImportWithAi] = useState(false);
  const [generatorBrief, setGeneratorBrief] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [personaInitialized, setPersonaInitialized] = useState(false);
  const [referenceCharacterIds, setReferenceCharacterIds] = useState<string[]>(
    [],
  );
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingBook, setPendingBook] = useState<PendingBook | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);

  const defaultConnectionId = connectionsQuery.defaultId || null;
  const defaultPersonaId =
    personasQuery.data?.find((persona) => persona.is_default)?.id ?? null;
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

  useEffect(() => {
    if (personaInitialized || !personasQuery.data) return;
    if (defaultPersonaId) setPersonaId(defaultPersonaId);
    setPersonaInitialized(true);
  }, [personaInitialized, personasQuery.data, defaultPersonaId]);

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

  const post = postQuery.data;
  const name = post ? botbooruDisplayName(post) : `Post #${cardId}`;
  const rating = post ? botbooruContentRating(post) : "sfw";
  const previewSrc = post?.preview_large_url || post?.preview_url || "";
  const alreadyImported = post
    ? isBotbooruPostImported(post, charactersQuery.data ?? [])
    : false;

  async function handleImport() {
    if (!post || importing) return;
    if (importWithAi && !aiReady) {
      notifications.show({
        title: "AI import not ready",
        message: "Select connection and Character Generator Preset first.",
        color: "yellow",
      });
      return;
    }

    setImporting(true);
    try {
      const ai =
        importWithAi &&
        resolvedConnectionId &&
        generatorPresetId &&
        generatorPreset &&
        structuralPresetId &&
        preset
          ? {
              connectionId: resolvedConnectionId,
              preset,
              generatorPresetId,
              generatorPrompts: generatorPreset,
              personaId,
              referenceCharacterIds,
              generatorBrief: generatorBrief.trim(),
              startAiImport: startBackgroundImport,
            }
          : null;

      const result = await importBotbooruPost(post, { ai });
      if (result.mode === "ai") return;

      void queryClient.invalidateQueries({ queryKey: characterKeys.list() });
      notifications.show({
        title: "Imported",
        message: `${result.characterName} from Botbooru.`,
        color: "green",
      });
      if (result.pendingBook) {
        setPendingBook(result.pendingBook);
      }
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message:
          error instanceof CharacterImportError || error instanceof Error
            ? error.message
            : "Could not import character",
        color: "red",
      });
    } finally {
      setImporting(false);
    }
  }

  if (!Number.isInteger(postId) || postId <= 0) {
    return (
      <div className={classes.page}>
        <p className={classes.statusError}>Invalid Botbooru card id.</p>
        <Button
          type="button"
          variant="default"
          onClick={() => void navigate({ to: "/characters/import" })}
        >
          Back to gallery
        </Button>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerRow}>
          <h2 className={classes.title}>{name}</h2>
          <div className={classes.headerActions}>
            <ActionIcon
              type="button"
              variant="default"
              aria-label="Back to Botbooru gallery"
              onClick={() => void navigate({ to: "/characters/import" })}
            >
              <IconArrowLeft size={16} />
            </ActionIcon>
          </div>
        </div>
        <p className={classes.subtitle}>
          Botbooru card #{postId}
          {post?.uploader_name ? ` · by ${post.uploader_name}` : ""}
          {post?.tagline ? ` · ${post.tagline}` : ""}
          {alreadyImported ? " · already in library" : ""}
        </p>
      </header>

      {postQuery.isLoading ? (
        <div className={classes.loading}>
          <div className={classes.spinner} aria-label="Loading" />
        </div>
      ) : null}

      {postQuery.isError ? (
        <p className={classes.statusError}>
          Failed to load card.
          {postQuery.error instanceof Error
            ? ` ${postQuery.error.message}`
            : ""}
        </p>
      ) : null}

      {post ? (
        <div className={classes.detailLayout}>
          <aside className={classes.detailAside}>
            <div className={classes.detailThumbWrap}>
              {!thumbFailed && previewSrc ? (
                <img
                  className={classes.detailThumb}
                  src={previewSrc}
                  alt=""
                  onError={() => setThumbFailed(true)}
                />
              ) : (
                <div className={classes.thumbFallback}>No image</div>
              )}
              {alreadyImported ? (
                <span className={classes.importedBadge}>Imported</span>
              ) : null}
              {rating !== "sfw" ? (
                <span
                  className={`${classes.ratingBadge} ${
                    rating === "nsfl"
                      ? classes.ratingBadgeNsfl
                      : classes.ratingBadgeNsfw
                  }`}
                >
                  {rating.toUpperCase()}
                </span>
              ) : null}
            </div>

            <p className={classes.cardMeta}>
              {post.views > 0 ? `${post.views} views` : null}
              {post.downloads > 0
                ? `${post.views > 0 ? " · " : ""}${post.downloads} downloads`
                : null}
              {post.has_lorebook ? " · lorebook" : null}
            </p>

            {post.tags.length > 0 ? (
              <div className={classes.detailTags}>
                {post.tags.map((tag) => (
                  <span
                    key={`${tag.id}-${tag.name}`}
                    className={classes.tagChip}
                    data-category={tag.category.toLowerCase()}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : null}

            <div className={classes.aiSection}>
              <Switch
                variant="card"
                checked={importWithAi}
                onChange={setImportWithAi}
                disabled={importing}
                label="Import with AI"
                description="Runs in the background. Review opens in Activity when ready."
              />
              {importWithAi ? (
                <div className={classes.aiPanel}>
                  <div className={classes.aiGrid}>
                    <Field
                      label="Connection"
                      hint="Defaults to the active connection."
                      error={connectionError}
                    >
                      <Select
                        data={connectionsQuery.options}
                        value={resolvedConnectionId ?? ""}
                        onChange={(value) => setConnectionId(value || null)}
                        searchable
                        disabled={
                          importing || !connectionsQuery.options.length
                        }
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
                        searchable
                        disabled={
                          importing || !generatorPresetOptions.length
                        }
                        error={Boolean(presetError)}
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
                        <RuntimeText text="Optional — fills {{user}} and the Persona marker." />
                      }
                    >
                      <Select
                        data={(personasQuery.data ?? []).map((persona) => ({
                          value: persona.id,
                          label: `${persona.name || "untitled"}${persona.is_default ? " (default)" : ""}`,
                        }))}
                        value={personaId ?? ""}
                        onChange={(value) => setPersonaId(value || null)}
                        searchable
                        clearable
                        disabled={importing || !personasQuery.data?.length}
                      />
                    </Field>
                    <Field
                      label="Reference characters"
                      hint="Optional — library cards used as AI context only."
                    >
                      <MultiSelect
                        data={characterOptions}
                        value={referenceCharacterIds}
                        onChange={setReferenceCharacterIds}
                        clearable
                        disabled={importing || !characterOptions.length}
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
                      <span className={classes.aiFieldHint}>
                        Genre, detail, language, and other values for this
                        preset.
                      </span>
                    </div>
                  ) : null}
                  <Field
                    label="Generator brief"
                    hint="Optional — fills the Generator Brief marker."
                  >
                    <Textarea
                      className={classes.aiTextarea}
                      value={generatorBrief}
                      onChange={(event) =>
                        setGeneratorBrief(event.currentTarget.value)
                      }
                      placeholder="e.g. Adapt this Botbooru card for my persona…"
                      disabled={importing}
                    />
                  </Field>
                </div>
              ) : null}
            </div>

            <div className={classes.detailActions}>
              <Button
                type="button"
                loading={importing}
                disabled={
                  importing ||
                  (importWithAi && (!aiReady || presetLoading))
                }
                leftSection={<IconDownload size={16} />}
                onClick={() => void handleImport()}
              >
                {importing
                  ? importWithAi
                    ? "Starting…"
                    : "Importing…"
                  : alreadyImported
                    ? importWithAi
                      ? "AI Re-import"
                      : "Re-import"
                    : importWithAi
                      ? "AI Import"
                      : "Import"}
              </Button>
              <a
                className={classes.externalLink}
                href={post.post_url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${name} on Botbooru`}
              >
                <IconExternalLink size={14} />
              </a>
            </div>
          </aside>

          <div className={classes.detailMain}>
            <DetailSection title="Description">
              {post.description.trim() ? (
                <pre className={classes.detailPre}>{post.description}</pre>
              ) : null}
            </DetailSection>
            <DetailSection title="Personality">
              {post.personality.trim() ? (
                <pre className={classes.detailPre}>{post.personality}</pre>
              ) : null}
            </DetailSection>
            <DetailSection title="Scenario">
              {post.scenario.trim() ? (
                <pre className={classes.detailPre}>{post.scenario}</pre>
              ) : null}
            </DetailSection>
            <DetailSection title="First message">
              {post.first_mes.trim() ? (
                <pre className={classes.detailPre}>{post.first_mes}</pre>
              ) : null}
            </DetailSection>
            <DetailSection title="Example messages">
              {post.mes_example.trim() ? (
                <pre className={classes.detailPre}>{post.mes_example}</pre>
              ) : null}
            </DetailSection>
            <DetailSection title="System prompt">
              {post.system_prompt.trim() ? (
                <pre className={classes.detailPre}>{post.system_prompt}</pre>
              ) : null}
            </DetailSection>
            <DetailSection title="Post history">
              {post.post_history_instructions.trim() ? (
                <pre className={classes.detailPre}>
                  {post.post_history_instructions}
                </pre>
              ) : null}
            </DetailSection>
            <DetailSection title="Creator notes">
              {post.creator_notes.trim() ? (
                <pre className={classes.detailPre}>{post.creator_notes}</pre>
              ) : null}
            </DetailSection>
            {post.alternate_greetings.length > 0 ? (
              <DetailSection title="Alternate greetings">
                {post.alternate_greetings.map((greeting, index) => (
                  <pre
                    key={`${index}-${greeting.slice(0, 24)}`}
                    className={classes.detailPre}
                  >
                    {greeting}
                  </pre>
                ))}
              </DetailSection>
            ) : null}
          </div>
        </div>
      ) : null}

      <SetupVariablesModal
        opened={variablesOpen}
        onClose={() => setVariablesOpen(false)}
        variables={preset?.variables ?? []}
        onApply={(variables) => void handleApplyVariables(variables)}
      />

      <ImportLorebookModal
        opened={pendingBook != null}
        onClose={() => setPendingBook(null)}
        initialLorebook={pendingBook?.lorebook ?? null}
        sourceLabel="Botbooru character_book"
        title="Import embedded lorebook?"
        onImported={() => {
          setPendingBook(null);
          return false;
        }}
      />
    </div>
  );
}
