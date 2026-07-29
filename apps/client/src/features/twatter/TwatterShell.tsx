import { useState } from "react";
import {
  IconArrowLeft,
  IconBell,
  IconHome,
  IconMenu2,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button, Modal } from "@/components/ui";
import { useLlmConnections } from "@/features/connections/queries";
import { useCharacters } from "@/features/characters/queries";
import { usePersonas } from "@/features/personas/queries";
import { personaAvatarSrc } from "@/features/personas/avatar-url";
import { api } from "@/lib/api";
import { ComposePost, PersonaPicker } from "./ComposePost";
import { TwatterPersonaProvider, useTwatterPersona } from "./TwatterPersonaContext";
import { TwatterRefreshTimeline } from "./TwatterRefreshTimeline";
import { TwatterSettingsPanel } from "./TwatterSettingsPanel";
import {
  useTwatterBootstrap,
  useTwatterAccountProfile,
} from "./queries";
import classes from "./TwatterShell.module.css";

const NAV_ITEMS = [
  { to: "/twatter", label: "Home", icon: IconHome, exact: true },
  { to: "/twatter/search", label: "Explore", icon: IconSearch },
  { to: "/twatter/notifications", label: "Notifications", icon: IconBell },
  { to: "/twatter/profile", label: "Profile", icon: IconUser },
  { to: "/twatter/settings", label: "Settings", icon: IconSettings },
] as const;

function TwatterShellInner() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: bootstrap } = useTwatterBootstrap();
  const { data: personas } = usePersonas();
  const { data: characters } = useCharacters();
  const { data: connections } = useLlmConnections();

  const { personaId, setPersonaId, personaAccount, unreadCount } =
    useTwatterPersona();

  const [navbarOpen, setNavbarOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const apiBase = String(api.defaults.baseURL);
  const avatarSrc = personaAccount
    ? personaAvatarSrc(personaAccount.avatar, apiBase)
    : null;
  const avatarInitial = (personaAccount?.display_name || "?")
    .slice(0, 1)
    .toUpperCase();

  const isHome = pathname === "/twatter" || pathname === "/twatter/";
  const profileAccountId =
    pathname.match(/^\/twatter\/profile\/([^/]+)/)?.[1] ?? null;
  const profileQuery = useTwatterAccountProfile(profileAccountId, personaId);

  function headerTitle() {
    if (isHome) return "Twatter";
    if (pathname.startsWith("/twatter/settings")) return "Settings";
    if (pathname.startsWith("/twatter/search")) return "Explore";
    if (pathname.startsWith("/twatter/notifications")) return "Notifications";
    if (profileAccountId) {
      return profileQuery.data?.display_name ?? "Profile";
    }
    return "Twatter";
  }

  function closeNavbar() {
    setNavbarOpen(false);
  }

  return (
    <div className={classes.shell}>
      <header className={classes.header} data-glass-surface>
        <Button
          type="button"
          variant="ghost"
          className={[classes.burger, navbarOpen ? classes.burgerOpen : ""]
            .filter(Boolean)
            .join(" ")}
          aria-label={navbarOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={navbarOpen}
          onClick={() => setNavbarOpen((open) => !open)}
        >
          <IconMenu2 />
        </Button>
        <h1 className={classes.headerTitle}>{headerTitle()}</h1>
        <div className={classes.headerActions}>
          {isHome ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setComposeOpen(true)}
              leftSection={<IconPlus size={16} />}
            >
              Post
            </Button>
          ) : null}
        </div>
      </header>

      {navbarOpen ? (
        <Button
          type="button"
          variant="ghost"
          className={classes.overlay}
          aria-label="Close navigation"
          onClick={closeNavbar}
        />
      ) : null}

      <nav
        className={[classes.navbar, navbarOpen ? classes.navbarOpen : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label="Twatter"
        data-glass-surface
      >
        <div className={classes.navbarTop}>
          <Button
            type="button"
            variant="ghost"
            className={[classes.burger, navbarOpen ? classes.burgerOpen : ""]
              .filter(Boolean)
              .join(" ")}
            aria-label={navbarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navbarOpen}
            onClick={() => setNavbarOpen((open) => !open)}
          >
            <IconMenu2 />
          </Button>
          <Link to="/twatter" className={classes.logo} onClick={closeNavbar}>
            <span className={classes.logoIcon} aria-hidden>
              T
            </span>
            <span className={classes.logoText}>Twatter</span>
          </Link>
        </div>

        <div className={classes.navScroll}>
          <div className={classes.navList}>
            <Link
              to="/"
              className={classes.navLink}
              onClick={closeNavbar}
            >
              <span className={classes.navIcon}>
                <IconArrowLeft />
              </span>
              <span className={classes.navLabel}>Back to Hub</span>
            </Link>

            <div className={classes.divider}>Twatter</div>

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                "exact" in item && item.exact
                  ? pathname === item.to || pathname === `${item.to}/`
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              const showBadge =
                item.to === "/twatter/notifications" && unreadCount > 0;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={[
                    classes.navLink,
                    active ? classes.navLinkActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={closeNavbar}
                >
                  <span className={classes.navIcon}>
                    <Icon />
                  </span>
                  <span className={classes.navLabel}>{item.label}</span>
                  {showBadge ? (
                    <span className={classes.navBadge}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        <div className={classes.navbarFooter}>
          <Button
            type="button"
            className={classes.postBtn}
            onClick={() => {
              closeNavbar();
              setComposeOpen(true);
            }}
          >
            <IconPlus size={16} />
            Post
          </Button>

          <button
            type="button"
            className={classes.accountCard}
            onClick={() => {
              closeNavbar();
              if (personaAccount) {
                void navigate({ to: "/twatter/profile" });
              }
            }}
          >
            {avatarSrc ? (
              <img
                className={classes.accountAvatar}
                src={avatarSrc}
                alt=""
                width={40}
                height={40}
              />
            ) : (
              <span className={classes.accountAvatarFallback} aria-hidden>
                {avatarInitial}
              </span>
            )}
            <span className={classes.accountMeta}>
              <span className={classes.accountName}>
                {personaAccount?.display_name || "Choose persona"}
              </span>
              <span className={classes.accountHandle}>
                {personaAccount?.handle || "@persona"}
              </span>
            </span>
          </button>
        </div>
      </nav>

      <div className={classes.mainArea}>
        <main className={classes.main}>
          <div className={classes.centerColumn}>
            <Outlet />
          </div>
        </main>

        <aside className={classes.rightSidebar} aria-label="Twatter widgets">
          <Link to="/twatter/search" className={classes.searchLink}>
            <IconSearch size={16} />
            Search Twatter
          </Link>

          <div className={classes.rightPanel}>
            <h2 className={classes.rightPanelTitle}>Active persona</h2>
            <PersonaPicker
              personas={(personas ?? []).map((persona) => ({
                id: persona.id,
                name: persona.name,
              }))}
              value={personaId}
              onChange={setPersonaId}
            />
          </div>

          <div className={classes.rightPanel}>
            <h2 className={classes.rightPanelTitle}>Timeline</h2>
            <TwatterRefreshTimeline />
          </div>

          <div className={classes.rightPanel}>
            <h2 className={classes.rightPanelTitle}>Settings</h2>
            <Button
              type="button"
              variant="default"
              onClick={() => void navigate({ to: "/twatter/settings" })}
            >
              <IconSettings size={16} />
              Open settings
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSettingsOpen(true)}
            >
              Quick settings
            </Button>
          </div>
        </aside>
      </div>

      <Modal
        opened={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Create post"
        size="lg"
      >
        <ComposePost
          personaId={personaId}
          personaAccount={personaAccount}
          accounts={bootstrap?.accounts ?? []}
          onPosted={() => setComposeOpen(false)}
        />
      </Modal>

      <Modal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Twatter settings"
        size="lg"
      >
        <TwatterSettingsPanel
          bootstrap={bootstrap}
          characters={characters ?? []}
          connections={connections ?? []}
          onClose={() => setSettingsOpen(false)}
        />
      </Modal>
    </div>
  );
}

export function TwatterShell() {
  return (
    <TwatterPersonaProvider>
      <TwatterShellInner />
    </TwatterPersonaProvider>
  );
}
