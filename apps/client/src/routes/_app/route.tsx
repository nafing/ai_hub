import { useState } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import {
  IconActivity,
  IconAiAgent,
  IconBook,
  IconBrandTwitter,
  IconConnection,
  IconFunction,
  IconHome,
  IconMenu2,
  IconMessages,
  IconPresentation,
  IconRegex,
  IconSettings,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { Button } from "@/components/ui";
import { useCharacterImportSessionStore } from "@/features/characters/characterImportSessionStore";
import { useChatGenerationStore } from "@/features/chats/shared";
import { useGeneratorJobsStore } from "@/features/generators/generatorJobsStore";
import classes from "./route.module.css";

export const Route = createFileRoute("/_app")({
  component: RouteComponent,
});

type NavLinkItem = {
  type?: undefined;
  label: string;
  icon: typeof IconHome;
  to: string;
};

type NavDividerItem = {
  type: "divider";
  label: string;
};

type NavItem = NavLinkItem | NavDividerItem;

const NAVBAR_ITEMS: NavItem[] = [
  { label: "Home", icon: IconHome, to: "/" },
  { label: "Chats", icon: IconMessages, to: "/chats" },
  { label: "Twatter", icon: IconBrandTwitter, to: "/twatter" },
  { label: "Activity", icon: IconActivity, to: "/activity" },

  { label: "User Data", type: "divider" },
  { label: "Personas", icon: IconUser, to: "/personas" },
  { label: "Characters", icon: IconUsers, to: "/characters" },
  { label: "Lorebooks", icon: IconBook, to: "/lorebooks" },

  { label: "LLM Settings", type: "divider" },
  { label: "Connections", icon: IconConnection, to: "/connections" },
  { label: "Presets", icon: IconPresentation, to: "/presets" },
  { label: "Regexes", icon: IconRegex, to: "/regexes" },
  { label: "Tools", icon: IconFunction, to: "/tools" },
  { label: "Agents", icon: IconAiAgent, to: "/agents" },

  { label: "Settings", type: "divider" },
  { label: "Settings", icon: IconSettings, to: "/settings" },
];

function RouteComponent() {
  const [navbarOpen, setNavbarOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";
  const runningJobs = useGeneratorJobsStore((state) => state.activeCount());
  const importAttention = useCharacterImportSessionStore((state) =>
    state.attentionCount(),
  );
  const chatJobs = useChatGenerationStore((state) => state.jobs);
  const activeChats = Object.values(chatJobs).filter((job) => job.streaming).length;
  const activityBadge = runningJobs + importAttention + activeChats;

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
        aria-label="Main"
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
        </div>

        <div className={classes.navScroll}>
          <div className={classes.navList}>
            {NAVBAR_ITEMS.map((item, index) => {
              if (item.type === "divider") {
                return (
                  <div
                    key={`divider-${item.label}-${index}`}
                    className={classes.divider}
                  >
                    {item.label}
                  </div>
                );
              }

              const Icon = item.icon;
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);

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
                  {item.to === "/activity" && activityBadge > 0 ? (
                    <span className={classes.navBadge}>
                      {activityBadge > 99 ? "99+" : activityBadge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className={classes.main}>
        <div
          className={
            isHome ? classes.containerBleed : classes.container
          }
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
