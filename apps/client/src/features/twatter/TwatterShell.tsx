import { useState } from "react";
import {
  IconBell,
  IconHome,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button, Modal } from "@/components/ui";
import { useConnections } from "@/features/connections/queries";
import { useCharacters } from "@/features/characters/queries";
import { usePersonas } from "@/features/personas/queries";
import { personaAvatarSrc } from "@/features/personas/avatar-url";
import { api } from "@/lib/api";
import { ComposePost, PersonaPicker } from "./ComposePost";
import { TwatterAppBackButton } from "./TwatterAppBackButton";
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
] as const;

function TwatterShellInner() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: bootstrap } = useTwatterBootstrap();
  const { data: personas } = usePersonas();
  const { data: characters } = useCharacters();
  const { data: connections } = useConnections();

  const { personaId, setPersonaId, personaAccount, unreadCount } =
    useTwatterPersona();

  const [composeOpen, setComposeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const apiBase = String(api.defaults.baseURL);
  const avatarSrc = personaAccount
    ? personaAvatarSrc(personaAccount.avatar, apiBase)
    : null;
  const avatarInitial = (personaAccount?.display_name || "?")
    .slice(0, 1)
    .toUpperCase();

  const isHome =
    pathname === "/twatter" || pathname === "/twatter/";

  const profileAccountId = pathname.match(/^\/twatter\/profile\/([^/]+)/)?.[1] ?? null;
  const profileQuery = useTwatterAccountProfile(profileAccountId, personaId);

  function mobileHeaderTitle() {
    if (isHome) return "Twatter";
    if (pathname.startsWith("/twatter/settings")) return "Settings";
    if (pathname.startsWith("/twatter/search")) return "Explore";
    if (pathname.startsWith("/twatter/notifications")) return "Notifications";
    if (profileAccountId) {
      return profileQuery.data?.display_name ?? "Profile";
    }
    return "Twatter";
  }

  return (
    <div className={classes.shell} data-home={isHome ? "true" : "false"}>
      <div className={classes.centerWrap}>
        <div className={classes.centerColumn}>
          <header className={classes.mobileHeader}>
            <div className={classes.mobileHeaderStart}>
              <TwatterAppBackButton />
              {isHome ? (
                <Link to="/twatter" className={classes.mobileLogo}>
                  Twatter
                </Link>
              ) : (
                <span className={classes.mobileTitle}>{mobileHeaderTitle()}</span>
              )}
            </div>
            <div className={classes.mobileHeaderActions}>
              <button
                type="button"
                className={classes.mobileHeaderBtn}
                aria-label="Settings"
                onClick={() => void navigate({ to: "/twatter/settings" })}
              >
                <IconSettings size={20} />
              </button>
            </div>
          </header>

          <main className={classes.main}>
            <Outlet />
          </main>
        </div>

        <aside className={classes.rightSidebar} aria-label="Twatter widgets">
          <Link to="/twatter/search" className={classes.searchLink}>
            <IconSearch size={18} />
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
              Open settings page
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

      <aside className={classes.sidebar} aria-label="Twatter navigation">
        <div className={classes.sidebarInner}>
          <div className={classes.sidebarLogoRow}>
            <span className={classes.desktopOnly}>
              <TwatterAppBackButton />
            </span>
            <Link to="/twatter" className={classes.logo}>
              <span className={classes.logoIcon} aria-hidden>
                T
              </span>
              <span className={classes.logoText}>Twatter</span>
            </Link>
          </div>

          <nav className={classes.nav}>
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
                  className={active ? classes.navLinkActive : classes.navLink}
                >
                  <span className={classes.navIconWrap}>
                    <Icon size={26} stroke={active ? 2.4 : 1.8} />
                    {showBadge ? (
                      <span className={classes.navBadge}>
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </span>
                  <span className={classes.navLabel}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            className={classes.postBtn}
            onClick={() => setComposeOpen(true)}
          >
            <span className={classes.postBtnLabel}>Post</span>
            <IconPlus size={24} className={classes.postBtnIcon} />
          </button>

          <div className={classes.sidebarFooter}>
            <button
              type="button"
              className={classes.accountCard}
              onClick={() => {
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
        </div>
      </aside>

      {isHome ? (
        <button
          type="button"
          className={classes.mobileComposeFab}
          aria-label="Create post"
          onClick={() => setComposeOpen(true)}
        >
          <IconPlus size={24} />
        </button>
      ) : null}

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
