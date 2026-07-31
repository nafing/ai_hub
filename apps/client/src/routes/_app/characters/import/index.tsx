import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  IconArrowLeft,
  IconChevronDown,
  IconDownload,
  IconExternalLink,
  IconLogin,
  IconLogout,
} from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CharacterImportError,
  type CreateLorebookInput,
  type Variable,
} from "@ai-hub/shared";
import {
  ActionIcon,
  Button,
  Modal,
  MultiSelect,
  notifications,
  RuntimeText,
  Select,
  Switch,
  Textarea,
  TextInput,
} from "@/components/ui";
import { importBotbooruPost } from "@/features/characters/botbooru/importPost";
import {
  buildImportedBotbooruPostIds,
  isBotbooruPostImported,
} from "@/features/characters/botbooru/imported";
import {
  useBotbooruLogin,
  useBotbooruLogout,
  useBotbooruPosts,
  useBotbooruPreferences,
  useBotbooruRelatedTags,
  useBotbooruSession,
  useBotbooruTags,
} from "@/features/characters/botbooru/queries";
import {
  appendBotbooruSearchTerm,
  botbooruContentRating,
  botbooruDisplayName,
  type BotbooruCatalogTag,
  type BotbooruPost,
  type BotbooruSort,
} from "@/features/characters/botbooru/types";
import { useCharacterImportSessionStore } from "@/features/characters/characterImportSessionStore";
import { characterKeys, useCharacters } from "@/features/characters/queries";
import { useConnectionSelectOptions } from "@/features/connections/queries";
import { useGeneratorPresetSelection } from "@/features/generator-presets/useGeneratorPresetSelection";
import { usePersonas } from "@/features/personas/queries";
import { SetupVariablesModal } from "@/features/presets/SetupVariablesModal";
import { persistPresetVariableSelection } from "@/features/presets/persistPresetVariableSelection";
import { presetKeys } from "@/features/presets/queries";
import { ImportLorebookModal } from "@/features/lorebooks/ImportLorebookModal";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/characters/import/")({
  component: RouteComponent,
});

const SORT_OPTIONS: { value: BotbooruSort; label: string }[] = [
  { value: "latest", label: "Latest" },
  { value: "random", label: "Random" },
  { value: "favorited", label: "Most favorited" },
  { value: "viewed", label: "Most viewed" },
  { value: "downloads", label: "Most downloaded" },
  { value: "curated", label: "Curated" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "24", label: "24 / page" },
  { value: "40", label: "40 / page" },
  { value: "80", label: "80 / page" },
];

const ADVANCED_PREFIXES = [
  { label: "Name only", snippet: "name:", caretFromEnd: 0 },
  { label: "Exclude", snippet: "-", caretFromEnd: 0 },
  { label: "Writer", snippet: "writer:", caretFromEnd: 0 },
  { label: "Artist", snippet: "artist:", caretFromEnd: 0 },
] as const;

type PendingBook = {
  lorebook: CreateLorebookInput;
  characterId: string;
};

function AiField({
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

function tagVisibleCount(
  tag: BotbooruCatalogTag,
  nsfwOn: boolean,
  nsflOn: boolean,
): number {
  let count = tag.count;
  if (!nsfwOn) count = Math.max(0, count - tag.count_nsfw - tag.count_nsfl);
  else if (!nsflOn) count = Math.max(0, count - tag.count_nsfl);
  return count;
}

function RouteComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionQuery = useBotbooruSession();
  const loginMutation = useBotbooruLogin();
  const logoutMutation = useBotbooruLogout();
  const preferencesMutation = useBotbooruPreferences();
  const connectionsQuery = useConnectionSelectOptions("llm");
  const charactersQuery = useCharacters();
  const personasQuery = usePersonas();
  const generatorSelection = useGeneratorPresetSelection("character_generator");
  const startBackgroundImport = useCharacterImportSessionStore(
    (state) => state.startAiImport,
  );

  const [searchInput, setSearchInput] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [writingInput, setWritingInput] = useState("");
  const [committedWriting, setCommittedWriting] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sort, setSort] = useState<BotbooruSort>("latest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [nsfwOn, setNsfwOn] = useState(false);
  const [nsflOn, setNsflOn] = useState(false);
  const [aiImagesOn, setAiImagesOn] = useState(true);
  const [prefsSynced, setPrefsSynced] = useState(false);
  const [importWithAi, setImportWithAi] = useState(false);
  const [generatorBrief, setGeneratorBrief] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [personaInitialized, setPersonaInitialized] = useState(false);
  const [referenceCharacterIds, setReferenceCharacterIds] = useState<string[]>(
    [],
  );
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [pendingBook, setPendingBook] = useState<PendingBook | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [nsflConfirmOpen, setNsflConfirmOpen] = useState(false);
  const [nsflConfirmChecked, setNsflConfirmChecked] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const session = sessionQuery.data;
  const authenticated = Boolean(session?.authenticated);
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
    if (!session?.authenticated || prefsSynced) return;
    setNsfwOn(session.show_nsfw);
    setNsflOn(session.show_nsfl && session.show_nsfl_active);
    setPrefsSynced(true);
  }, [session, prefsSynced]);

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

  const importedPostIds = useMemo(
    () => buildImportedBotbooruPostIds(charactersQuery.data ?? []),
    [charactersQuery.data],
  );

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

  const listParams = useMemo(
    () => ({
      sort,
      q: committedQuery,
      qtext: committedWriting,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sfwOnly: !nsfwOn,
      hideAi: !aiImagesOn,
    }),
    [
      sort,
      committedQuery,
      committedWriting,
      pageSize,
      page,
      nsfwOn,
      aiImagesOn,
    ],
  );

  const postsQuery = useBotbooruPosts(listParams);
  const popularTagsQuery = useBotbooruTags({ limit: 40 });
  const relatedTagsQuery = useBotbooruRelatedTags(
    {
      q: committedQuery,
      limit: 40,
      sfwOnly: !nsfwOn,
      hideAi: !aiImagesOn,
    },
    committedQuery.length > 0,
  );

  const sidebarTags =
    committedQuery && relatedTagsQuery.data?.length
      ? relatedTagsQuery.data
      : (popularTagsQuery.data ?? []);

  const total = postsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const posts = postsQuery.data?.posts ?? [];

  function commitSearch(nextQuery = searchInput, nextWriting = writingInput) {
    setPage(1);
    setCommittedQuery(nextQuery.trim());
    setCommittedWriting(nextWriting.trim());
    setSearchInput(nextQuery.trim());
    setWritingInput(nextWriting.trim());
  }

  function insertAdvancedSnippet(snippet: string) {
    const cur = searchInput;
    const needsSpace = cur.length > 0 && !/\s$/.test(cur);
    setSearchInput(cur + (needsSpace ? " " : "") + snippet);
    setAdvancedOpen(true);
  }

  function handleTagClick(tagName: string) {
    const next = appendBotbooruSearchTerm(searchInput, tagName);
    setSearchInput(next);
    commitSearch(next, writingInput);
  }

  async function requireLogin(message: string) {
    notifications.show({
      title: "Login required",
      message,
      color: "yellow",
    });
    setLoginOpen(true);
  }

  async function handleNsfwToggle() {
    if (!authenticated) {
      await requireLogin(
        "Log in to Botbooru to enable NSFW and the full gallery.",
      );
      return;
    }
    const next = !nsfwOn;
    setPage(1);
    setNsfwOn(next);
    if (!next) setNsflOn(false);
    try {
      await preferencesMutation.mutateAsync({
        show_nsfw: next,
        ...(next ? {} : { show_nsfl_active: false }),
      });
    } catch (error) {
      setNsfwOn(!next);
      notifications.show({
        title: "Could not update NSFW",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  async function enableNsfl() {
    setPage(1);
    setNsfwOn(true);
    setNsflOn(true);
    try {
      const patch =
        session?.show_nsfl === true
          ? { show_nsfw: true, show_nsfl_active: true }
          : { show_nsfw: true, show_nsfl: true, show_nsfl_active: true };
      await preferencesMutation.mutateAsync(patch);
      setNsflConfirmOpen(false);
      setNsflConfirmChecked(false);
    } catch (error) {
      setNsflOn(false);
      notifications.show({
        title: "Could not enable NSFL",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  async function handleNsflToggle() {
    if (!authenticated) {
      await requireLogin("Log in to Botbooru to enable NSFL content.");
      return;
    }
    if (!nsflOn) {
      if (!nsfwOn) {
        // NSFW is master toggle
      }
      if (!session?.show_nsfl) {
        setNsflConfirmChecked(false);
        setNsflConfirmOpen(true);
        return;
      }
      setPage(1);
      setNsfwOn(true);
      setNsflOn(true);
      try {
        await preferencesMutation.mutateAsync({
          show_nsfw: true,
          show_nsfl_active: true,
        });
      } catch (error) {
        setNsflOn(false);
        notifications.show({
          title: "Could not enable NSFL",
          message: error instanceof Error ? error.message : "Unknown error",
          color: "red",
        });
      }
      return;
    }

    setPage(1);
    setNsflOn(false);
    try {
      await preferencesMutation.mutateAsync({ show_nsfl_active: false });
    } catch (error) {
      setNsflOn(true);
      notifications.show({
        title: "Could not update NSFL",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  function handleAiImagesToggle() {
    setPage(1);
    setAiImagesOn((value) => !value);
  }

  async function handleLogin() {
    try {
      const next = await loginMutation.mutateAsync({
        username: username.trim(),
        password,
      });
      setPassword("");
      setLoginOpen(false);
      setPrefsSynced(true);
      setNsfwOn(next.show_nsfw);
      setNsflOn(next.show_nsfl && next.show_nsfl_active);
      setPage(1);
      notifications.show({
        title: "Logged in",
        message: `Connected as ${next.username} on Botbooru.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Login failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  async function handleLogout() {
    try {
      await logoutMutation.mutateAsync();
      setNsfwOn(false);
      setNsflOn(false);
      setPrefsSynced(false);
      setPage(1);
      notifications.show({
        title: "Logged out",
        message: "Botbooru session cleared.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Logout failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  async function handleImport(post: BotbooruPost) {
    if (importingId != null) return;
    if (importWithAi && !aiReady) {
      notifications.show({
        title: "AI import not ready",
        message: "Select connection and Character Generator Preset first.",
        color: "yellow",
      });
      return;
    }

    setImportingId(post.id);
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
      setImportingId(null);
    }
  }

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerRow}>
          <h2 className={classes.title}>Import From Website</h2>
          <div className={classes.headerActions}>
            {authenticated ? (
              <>
                <span className={classes.accountLabel}>
                  {session?.username}
                </span>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  loading={logoutMutation.isPending}
                  leftSection={<IconLogout size={14} />}
                  onClick={() => void handleLogout()}
                >
                  Log out
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="default"
                size="sm"
                leftSection={<IconLogin size={14} />}
                onClick={() => setLoginOpen(true)}
              >
                Log in
              </Button>
            )}
            <ActionIcon
              type="button"
              variant="default"
              aria-label="Back to characters"
              onClick={() => void navigate({ to: "/characters" })}
            >
              <IconArrowLeft size={16} />
            </ActionIcon>
          </div>
        </div>
        <p className={classes.subtitle}>
          Browse{" "}
          <a href="https://botbooru.com/" target="_blank" rel="noreferrer">
            Botbooru
          </a>{" "}
          character cards and import them into your library.
          {postsQuery.isSuccess
            ? ` ${total.toLocaleString()} characters available.`
            : null}
        </p>
      </header>

      {!authenticated ? (
        <p className={classes.banner}>
          Guest access is SFW-only. Log in with your Botbooru account for NSFW,
          NSFL, and the full gallery.
        </p>
      ) : null}

      <div className={classes.contentRatingRow}>
        <button
          type="button"
          className={`${classes.ratingToggle} ${nsfwOn ? classes.ratingToggleOn : ""}`}
          disabled={preferencesMutation.isPending}
          onClick={() => void handleNsfwToggle()}
        >
          NSFW {nsfwOn ? "On" : "Off"}
        </button>
        <button
          type="button"
          className={`${classes.ratingToggle} ${nsflOn ? classes.ratingToggleNsflOn : ""}`}
          disabled={preferencesMutation.isPending || (authenticated && !nsfwOn)}
          title={
            !authenticated
              ? "Log in required"
              : !nsfwOn
                ? "Enable NSFW first"
                : undefined
          }
          onClick={() => void handleNsflToggle()}
        >
          NSFL {nsflOn ? "On" : "Off"}
        </button>
        <button
          type="button"
          className={`${classes.ratingToggle} ${aiImagesOn ? classes.ratingToggleOn : ""}`}
          onClick={handleAiImagesToggle}
        >
          AI Images: {aiImagesOn ? "On" : "Off"}
        </button>
      </div>

      <section className={classes.aiSection}>
        <Switch
          variant="card"
          checked={importWithAi}
          onChange={setImportWithAi}
          disabled={importingId != null}
          label="Import with AI"
          description="Each Import starts a background rewrite. Review opens in Activity when ready."
        />
        {importWithAi ? (
          <div className={classes.aiPanel}>
            <div className={classes.aiGrid}>
              <AiField
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
                  disabled={
                    importingId != null || !connectionsQuery.options.length
                  }
                  error={Boolean(connectionError)}
                />
              </AiField>
              <AiField
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
                  disabled={
                    importingId != null || !generatorPresetOptions.length
                  }
                  error={Boolean(presetError)}
                />
              </AiField>
              <AiField
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
                  disabled={
                    importingId != null || !personasQuery.data?.length
                  }
                  error={Boolean(personaError)}
                />
              </AiField>
              <AiField
                label="Reference characters"
                hint="Optional — library cards used as AI context only."
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
                  disabled={
                    importingId != null || !characterOptions.length
                  }
                  error={Boolean(referenceCharactersError)}
                />
              </AiField>
            </div>
            {hasPresetVariables ? (
              <div className={classes.variablesRow}>
                <Button
                  type="button"
                  variant="default"
                  disabled={importingId != null || !preset}
                  onClick={() => setVariablesOpen(true)}
                >
                  Setup Variables
                </Button>
                <span className={classes.aiFieldHint}>
                  Genre, detail, language, and other values for this preset.
                </span>
              </div>
            ) : null}
            <AiField
              label="Generator brief"
              hint="Optional — fills the Generator Brief marker."
            >
              <Textarea
                className={classes.aiTextarea}
                value={generatorBrief}
                onChange={(event) =>
                  setGeneratorBrief(event.currentTarget.value)
                }
                placeholder="e.g. Adapt this Botbooru card for my persona, soften the tone…"
                disabled={importingId != null}
              />
            </AiField>
          </div>
        ) : null}
      </section>

      <div className={classes.filters}>
        <TextInput
          className={classes.searchInput}
          value={searchInput}
          onChange={(event) => setSearchInput(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitSearch();
            }
          }}
          placeholder="Search tags or name… (e.g. female fantasy -male)"
          aria-label="Search Botbooru"
        />
        <Select
          className={classes.sortSelect}
          data={SORT_OPTIONS}
          value={sort}
          onChange={(value) => {
            setPage(1);
            setSort((value as BotbooruSort) || "latest");
          }}
        />
        <Select
          className={classes.pageSizeSelect}
          data={PAGE_SIZE_OPTIONS}
          value={String(pageSize)}
          onChange={(value) => {
            setPage(1);
            setPageSize(Number(value) || 24);
          }}
        />
        <Button type="button" variant="default" onClick={() => commitSearch()}>
          Search
        </Button>
      </div>

      <div className={classes.advancedBlock}>
        <button
          type="button"
          className={classes.advancedToggle}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <IconChevronDown
            size={14}
            className={advancedOpen ? classes.advancedCaretOpen : undefined}
          />
          Advanced search
        </button>
        {advancedOpen ? (
          <div className={classes.advancedPanel}>
            <TextInput
              className={classes.writingInput}
              value={writingInput}
              onChange={(event) => setWritingInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitSearch();
                }
              }}
              placeholder="Search inside the writing…"
              aria-label="Search inside writing"
            />
            <p className={classes.advancedHint}>
              Quick filters add prefixes to the main search box, e.g.{" "}
              <code>name:Alice</code>, <code>writer:someone</code>,{" "}
              <code>-goblin</code>.
            </p>
            <div className={classes.advancedChips}>
              {ADVANCED_PREFIXES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={classes.advancedChip}
                  onClick={() => insertAdvancedSnippet(item.snippet)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <section className={classes.tagsSection}>
        <div className={classes.tagsHeader}>
          <h3 className={classes.tagsTitle}>
            {committedQuery ? "Related tags" : "Tags"}
          </h3>
          {popularTagsQuery.isFetching || relatedTagsQuery.isFetching ? (
            <span className={classes.tagsStatus}>Loading…</span>
          ) : null}
        </div>
        {popularTagsQuery.isError ? (
          <p className={classes.statusError}>Failed to load tags.</p>
        ) : null}
        <div className={classes.tagList}>
          {sidebarTags.map((tag) => {
            const count = tagVisibleCount(tag, nsfwOn, nsflOn);
            return (
              <button
                key={`${tag.id}-${tag.name}`}
                type="button"
                className={classes.tagChip}
                data-category={tag.category.toLowerCase()}
                title={`${tag.category}: ${tag.name}`}
                onClick={() => handleTagClick(tag.name)}
              >
                <span>{tag.name}</span>
                <span className={classes.tagCount}>
                  {typeof tag.co_count === "number"
                    ? `${tag.co_count} / ${count}`
                    : count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {postsQuery.isLoading ? (
        <div className={classes.loading}>
          <div className={classes.spinner} aria-label="Loading" />
        </div>
      ) : null}

      {postsQuery.isError ? (
        <p className={classes.statusError}>
          Failed to load Botbooru gallery.
          {postsQuery.error instanceof Error
            ? ` ${postsQuery.error.message}`
            : ""}
        </p>
      ) : null}

      {!postsQuery.isLoading && !postsQuery.isError && posts.length === 0 ? (
        <p className={classes.status}>
          No characters matched. Try different tags, advanced search, or content
          filters.
        </p>
      ) : null}

      {!postsQuery.isError && posts.length > 0 ? (
        <>
          <div className={classes.grid}>
            {posts.map((post, index) => (
              <BotbooruCard
                key={post.id}
                post={post}
                index={index}
                imported={isBotbooruPostImported(
                  post,
                  charactersQuery.data ?? [],
                  importedPostIds,
                )}
                importing={importingId === post.id}
                disabled={
                  importingId != null ||
                  (importWithAi && (!aiReady || presetLoading))
                }
                importWithAi={importWithAi}
                onImport={() => void handleImport(post)}
                onTagClick={handleTagClick}
                onOpen={() =>
                  void navigate({
                    to: "/characters/import/$cardId",
                    params: { cardId: String(post.id) },
                  })
                }
              />
            ))}
          </div>

          <div className={classes.pager}>
            <p className={classes.pagerInfo}>
              Page {page} of {totalPages}
            </p>
            <div className={classes.pagerButtons}>
              <Button
                type="button"
                variant="default"
                disabled={page <= 1 || postsQuery.isFetching}
                onClick={() => setPage(1)}
              >
                First
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={page <= 1 || postsQuery.isFetching}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={page >= totalPages || postsQuery.isFetching}
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
              >
                Next
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={page >= totalPages || postsQuery.isFetching}
                onClick={() => setPage(totalPages)}
              >
                Last
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <Modal
        opened={loginOpen}
        onClose={() => {
          if (loginMutation.isPending) return;
          setLoginOpen(false);
          setPassword("");
        }}
        title="Log in to Botbooru"
        size="sm"
      >
        <p className={classes.modalBody}>
          Use your existing{" "}
          <a href="https://botbooru.com/" target="_blank" rel="noreferrer">
            Botbooru
          </a>{" "}
          account. Credentials stay on this app’s server and are only used to
          call Botbooru.
        </p>
        <div className={classes.loginFields}>
          <TextInput
            value={username}
            onChange={(event) => setUsername(event.currentTarget.value)}
            placeholder="Username"
            autoComplete="username"
            aria-label="Botbooru username"
            disabled={loginMutation.isPending}
          />
          <TextInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleLogin();
              }
            }}
            placeholder="Password"
            autoComplete="current-password"
            aria-label="Botbooru password"
            disabled={loginMutation.isPending}
          />
        </div>
        <div className={classes.modalActions}>
          <Button
            type="button"
            variant="default"
            disabled={loginMutation.isPending}
            onClick={() => {
              setLoginOpen(false);
              setPassword("");
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={loginMutation.isPending}
            disabled={!username.trim() || !password}
            onClick={() => void handleLogin()}
          >
            Log in
          </Button>
        </div>
      </Modal>

      <Modal
        opened={nsflConfirmOpen}
        onClose={() => {
          if (preferencesMutation.isPending) return;
          setNsflConfirmOpen(false);
          setNsflConfirmChecked(false);
        }}
        title="Show NSFL content"
        size="sm"
      >
        <p className={classes.modalBody}>
          NSFL (Not Safe For Life) may include extreme or highly disturbing
          material. Enabling this is a per-account Botbooru setting.
        </p>
        <label className={classes.confirmCheck}>
          <input
            type="checkbox"
            checked={nsflConfirmChecked}
            onChange={(event) =>
              setNsflConfirmChecked(event.currentTarget.checked)
            }
          />
          I understand and wish to enable NSFL for my account.
        </label>
        <div className={classes.modalActions}>
          <Button
            type="button"
            variant="default"
            disabled={preferencesMutation.isPending}
            onClick={() => {
              setNsflConfirmOpen(false);
              setNsflConfirmChecked(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={preferencesMutation.isPending}
            disabled={!nsflConfirmChecked}
            onClick={() => void enableNsfl()}
          >
            Confirm
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

function BotbooruCard({
  post,
  index,
  imported,
  importing,
  disabled,
  importWithAi,
  onImport,
  onTagClick,
  onOpen,
}: {
  post: BotbooruPost;
  index: number;
  imported: boolean;
  importing: boolean;
  disabled: boolean;
  importWithAi: boolean;
  onImport: () => void;
  onTagClick: (tag: string) => void;
  onOpen: () => void;
}) {
  const name = botbooruDisplayName(post);
  const rating = botbooruContentRating(post);
  const tags = post.tags
    .filter((tag) => !["sfw", "nsfw", "nsfl"].includes(tag.name.toLowerCase()))
    .slice(0, 3);
  const [thumbFailed, setThumbFailed] = useState(false);
  const importLabel = importing
    ? importWithAi
      ? "Starting…"
      : "Importing…"
    : imported
      ? importWithAi
        ? "AI Re-import"
        : "Re-import"
      : importWithAi
        ? "AI Import"
        : "Import";

  return (
    <motion.article
      className={`${classes.card} ${imported ? classes.cardImported : ""}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, delay: Math.min(index, 12) * 0.02 }}
    >
      <button
        type="button"
        className={classes.cardHit}
        onClick={onOpen}
        aria-label={`Open ${name}${imported ? " (already imported)" : ""}`}
      >
        <div className={classes.thumbWrap}>
          {!thumbFailed && post.preview_url ? (
            <img
              className={classes.thumb}
              src={post.preview_url}
              alt=""
              loading="lazy"
              onError={() => setThumbFailed(true)}
            />
          ) : (
            <div className={classes.thumbFallback}>No image</div>
          )}
          {imported ? (
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
        <div className={classes.cardBody}>
          <p className={classes.cardName} title={name}>
            {name}
          </p>
          <p className={classes.cardMeta}>
            #{post.id}
            {post.token_count > 0 ? ` · ${post.token_count} tok` : ""}
            {post.favorite_count > 0 ? ` · ♥ ${post.favorite_count}` : ""}
          </p>
          <p className={classes.cardDesc}>
            {post.tagline.trim() ||
              post.description_excerpt.trim() ||
              "No description"}
          </p>
        </div>
      </button>
      {tags.length > 0 ? (
        <div className={classes.badges}>
          {tags.map((tag) => (
            <button
              key={tag.id || tag.name}
              type="button"
              className={classes.badge}
              onClick={(event) => {
                event.stopPropagation();
                onTagClick(tag.name);
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className={classes.cardActions}>
        <Button
          type="button"
          size="sm"
          loading={importing}
          disabled={disabled}
          leftSection={<IconDownload size={14} />}
          onClick={(event) => {
            event.stopPropagation();
            onImport();
          }}
        >
          {importLabel}
        </Button>
        <a
          className={classes.externalLink}
          href={post.post_url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${name} on Botbooru`}
          onClick={(event) => event.stopPropagation()}
        >
          <IconExternalLink size={14} />
        </a>
      </div>
    </motion.article>
  );
}
