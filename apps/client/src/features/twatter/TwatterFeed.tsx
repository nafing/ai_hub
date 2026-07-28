import { useMemo, useState } from "react";
import {
  IconBell,
  IconHome,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import {
  countUnreadTwatterNotifications,
  type TwatterPost,
  type TwatterTimelineTab,
  type TwatterView,
} from "@ai-hub/shared";
import { Button, Modal, notifications } from "@/components/ui";
import { useConnections } from "@/features/connections/queries";
import { useCharacters } from "@/features/characters/queries";
import { usePersonas } from "@/features/personas/queries";
import {
  ComposePost,
  PersonaPicker,
  useFilteredTwatterPosts,
} from "./ComposePost";
import { PostCard } from "./PostCard";
import { TwatterNotifications } from "./TwatterNotifications";
import { TwatterProfile } from "./TwatterProfile";
import { TwatterSearch } from "./TwatterSearch";
import { TwatterSettingsPanel } from "./TwatterSettingsPanel";
import {
  useMarkTwatterNotificationsRead,
  useRefreshTwatterTimeline,
  useTwatterBootstrap,
} from "./queries";
import classes from "./TwatterFeed.module.css";

export function TwatterFeed() {
  const { data, isLoading, isError } = useTwatterBootstrap();
  const { data: personas } = usePersonas();
  const { data: characters } = useCharacters();
  const { data: connections } = useConnections();
  const refreshMutation = useRefreshTwatterTimeline();
  const markReadMutation = useMarkTwatterNotificationsRead();

  const defaultPersonaId =
    personas?.find((persona) => persona.is_default)?.id ??
    personas?.[0]?.id ??
    null;

  const [personaId, setPersonaId] = useState<string | null>(defaultPersonaId);
  const [view, setView] = useState<TwatterView>("home");
  const [tab, setTab] = useState<TwatterTimelineTab>("main");
  const [replyTo, setReplyTo] = useState<TwatterPost | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileAccountId, setProfileAccountId] = useState<string | null>(null);

  const activePersonaId = personaId ?? defaultPersonaId;

  const personaAccount = useMemo(() => {
    if (!activePersonaId || !data) return null;
    return (
      data.accounts.find(
        (account) =>
          account.kind === "persona" && account.entity_id === activePersonaId,
      ) ?? null
    );
  }, [activePersonaId, data]);

  const unreadCount = useMemo(() => {
    if (!personaAccount || !data) return 0;
    return countUnreadTwatterNotifications({
      personaAccount,
      posts: data.posts,
      interactions: data.interactions,
      accounts: data.accounts,
    });
  }, [personaAccount, data]);

  const filteredPosts = useFilteredTwatterPosts({
    tab,
    personaAccount,
    posts: data?.posts ?? [],
  });

  function openProfile(accountId: string) {
    setProfileAccountId(accountId);
    setView("profile");
  }

  function openNotifications() {
    setView("notifications");
    if (activePersonaId && unreadCount > 0) {
      markReadMutation.mutate(activePersonaId);
    }
  }

  function handleRefresh() {
    if (!activePersonaId) {
      notifications.show({
        title: "Persona required",
        message: "Choose an active persona before refreshing.",
        color: "yellow",
      });
      return;
    }
    refreshMutation.mutate(
      { persona_id: activePersonaId },
      {
        onSuccess: () => {
          notifications.show({
            title: "Timeline refreshed",
            message: "Twatter timeline refreshed.",
            color: "green",
          });
        },
        onError: (error) => {
          notifications.show({
            title: "Refresh failed",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  }

  return (
    <div className={classes.feedShell}>
      <div className={classes.fakeBrowser}>
        <span className={classes.fakeUrl}>https://twatter.local</span>
        <span className={classes.fakeBadge}>Twatter</span>
      </div>

      <div className={classes.toolbar}>
        <PersonaPicker
          personas={(personas ?? []).map((persona) => ({
            id: persona.id,
            name: persona.name,
          }))}
          value={activePersonaId}
          onChange={setPersonaId}
        />
        <div className={classes.toolbarActions}>
          <Button
            type="button"
            variant="default"
            onClick={() => setSettingsOpen(true)}
          >
            <IconSettings size={16} />
            Settings
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={refreshMutation.isPending}
            onClick={handleRefresh}
          >
            <IconRefresh size={16} />
            {refreshMutation.isPending ? "Refreshing…" : "Refresh timeline"}
          </Button>
        </div>
      </div>

      <nav className={classes.mainNav} aria-label="Twatter sections">
        <button
          type="button"
          className={view === "home" ? classes.navActive : classes.navBtn}
          onClick={() => setView("home")}
        >
          <IconHome size={18} />
          Home
        </button>
        <button
          type="button"
          className={view === "search" ? classes.navActive : classes.navBtn}
          onClick={() => setView("search")}
        >
          <IconSearch size={18} />
          Search
        </button>
        <button
          type="button"
          className={view === "notifications" ? classes.navActive : classes.navBtn}
          onClick={openNotifications}
        >
          <IconBell size={18} />
          Notifications
          {unreadCount > 0 ? (
            <span className={classes.navBadge}>{unreadCount}</span>
          ) : null}
        </button>
        <button
          type="button"
          className={view === "profile" ? classes.navActive : classes.navBtn}
          onClick={() => {
            if (personaAccount) {
              openProfile(personaAccount.id);
            } else {
              setView("profile");
            }
          }}
        >
          <IconUser size={18} />
          Profile
        </button>
      </nav>

      {view === "home" ? (
        <>
          <div className={classes.tabs}>
            <button
              type="button"
              className={tab === "main" ? classes.tabActive : classes.tab}
              onClick={() => setTab("main")}
            >
              Main
            </button>
            <button
              type="button"
              className={tab === "following" ? classes.tabActive : classes.tab}
              onClick={() => setTab("following")}
            >
              Following
            </button>
          </div>

          <div className={classes.feed}>
            <ComposePost
              personaId={activePersonaId}
              personaAccount={personaAccount}
              accounts={data?.accounts ?? []}
              replyToPost={replyTo}
              onPosted={() => setReplyTo(null)}
              onCancelReply={() => setReplyTo(null)}
            />

            {isLoading ? (
              <div className={classes.loading}>
                <div className={classes.spinner} aria-label="Loading" />
              </div>
            ) : null}

            {isError ? (
              <p className={classes.statusError}>Failed to load Twatter.</p>
            ) : null}

            {!isLoading && !isError && filteredPosts.length === 0 ? (
              <p className={classes.status}>
                {tab === "following"
                  ? "Nothing from followed characters yet."
                  : "The plate is empty. Invite characters in Settings, pick a connection, then refresh."}
              </p>
            ) : null}

            {!isLoading && !isError && filteredPosts.length > 0 ? (
              <div className={classes.postList}>
                {filteredPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    accounts={data?.accounts ?? []}
                    interactions={data?.interactions ?? []}
                    personaId={activePersonaId}
                    personaAccount={personaAccount}
                    onReply={setReplyTo}
                    onMentionClick={openProfile}
                    onAuthorClick={openProfile}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {view === "search" ? (
        <TwatterSearch
          bootstrap={data}
          personaId={activePersonaId}
          personaAccount={personaAccount}
          onOpenProfile={openProfile}
        />
      ) : null}

      {view === "notifications" ? (
        <TwatterNotifications
          bootstrap={data}
          personaId={activePersonaId}
          onOpenProfile={openProfile}
        />
      ) : null}

      {view === "profile" ? (
        <TwatterProfile
          accountId={profileAccountId ?? personaAccount?.id ?? null}
          personaId={activePersonaId}
          personaAccount={personaAccount}
          interactions={data?.interactions ?? []}
          accounts={data?.accounts ?? []}
          onMentionClick={openProfile}
        />
      ) : null}

      <Modal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Twatter settings"
        size="lg"
      >
        <TwatterSettingsPanel
          bootstrap={data}
          characters={characters ?? []}
          connections={connections ?? []}
          onClose={() => setSettingsOpen(false)}
        />
      </Modal>
    </div>
  );
}
