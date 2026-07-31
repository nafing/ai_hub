import { useEffect, useState, type ReactNode } from "react";
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
  IconChevronDown,
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
import {
  PRESET_CATEGORIES,
  PRESET_CATEGORY_LABELS,
} from "@ai-hub/shared";
import { Button } from "@/components/ui";
import { useCharacterImportSessionStore } from "@/features/characters/characterImportSessionStore";
import { useChatGenerationStore } from "@/features/chats/shared";
import { useGeneratorJobsStore } from "@/features/generators/generatorJobsStore";
import classes from "./route.module.css";

export const Route = createFileRoute("/_app")({
  component: RouteComponent,
});

type NavLinkItem = {
  type?: "link";
  label: string;
  icon?: typeof IconHome;
  to: string;
  search?: Record<string, string>;
};

type NavGroupItem = {
  type: "group";
  id: string;
  label: string;
  icon?: typeof IconHome;
  /** Optional overview link for the group header. */
  to?: string;
  children: NavItem[];
};

type NavDividerItem = {
  type: "divider";
  label: string;
};

type NavItem = NavLinkItem | NavGroupItem | NavDividerItem;

function buildPresetNavChildren(): NavItem[] {
  return PRESET_CATEGORIES.map((category) => ({
    label: PRESET_CATEGORY_LABELS[category],
    to: "/presets",
    search: { category },
  }));
}

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
  {
    type: "group",
    id: "presets",
    label: "Presets",
    icon: IconPresentation,
    to: "/presets",
    children: buildPresetNavChildren(),
  },
  { label: "Regexes", icon: IconRegex, to: "/regexes" },
  { label: "Tools", icon: IconFunction, to: "/tools" },
  { label: "Agents", icon: IconAiAgent, to: "/agents" },

  { label: "Settings", type: "divider" },
  { label: "Settings", icon: IconSettings, to: "/settings" },
];

function linkMatches(
  pathname: string,
  searchStr: string,
  to: string,
  search?: Record<string, string>,
): boolean {
  const pathOk =
    to === "/"
      ? pathname === "/"
      : pathname === to ||
        pathname === `${to}/` ||
        pathname.startsWith(`${to}/`);
  if (!pathOk) return false;
  if (!search || Object.keys(search).length === 0) {
    if (to === "/presets") {
      const params = new URLSearchParams(searchStr);
      return !params.get("category");
    }
    return true;
  }
  const params = new URLSearchParams(searchStr);
  return Object.entries(search).every(
    ([key, value]) => params.get(key) === value,
  );
}

function groupContainsActive(
  item: NavGroupItem,
  pathname: string,
  searchStr: string,
): boolean {
  if (item.to && linkMatches(pathname, searchStr, item.to)) return true;
  return item.children.some((child) => {
    if (child.type === "divider") return false;
    if (child.type === "group") {
      return groupContainsActive(child, pathname, searchStr);
    }
    return linkMatches(pathname, searchStr, child.to, child.search);
  });
}

function NavGroup({
  item,
  pathname,
  searchStr,
  depth,
  openIds,
  toggleOpen,
  onNavigate,
  activityBadge,
}: {
  item: NavGroupItem;
  pathname: string;
  searchStr: string;
  depth: number;
  openIds: Set<string>;
  toggleOpen: (id: string) => void;
  onNavigate: () => void;
  activityBadge: number;
}) {
  const open = openIds.has(item.id);
  const childActive = groupContainsActive(item, pathname, searchStr);
  const headerActive =
    item.to != null && linkMatches(pathname, searchStr, item.to);
  const Icon = item.icon;

  const headerClass = [
    classes.navLink,
    depth > 0 ? classes.navLinkNested : "",
    headerActive || (childActive && !open) ? classes.navLinkActive : "",
  ]
    .filter(Boolean)
    .join(" ");

  const headerStyle =
    depth > 0
      ? ({ paddingLeft: `${0.75 + depth * 0.75}rem` } as const)
      : undefined;

  const toggleButton = (
    <button
      type="button"
      className={classes.navChevronBtn}
      aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
      aria-expanded={open}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleOpen(item.id);
      }}
    >
      <IconChevronDown
        className={[classes.navChevron, open ? classes.navChevronOpen : ""]
          .filter(Boolean)
          .join(" ")}
        size={14}
      />
    </button>
  );

  return (
    <div className={classes.navGroup}>
      {item.to ? (
        <div className={classes.navGroupHeader}>
          <Link
            to={item.to}
            className={headerClass}
            style={headerStyle}
            onClick={onNavigate}
          >
            {Icon ? (
              <span className={classes.navIcon}>
                <Icon />
              </span>
            ) : null}
            <span className={classes.navLabel}>{item.label}</span>
          </Link>
          {toggleButton}
        </div>
      ) : (
        <button
          type="button"
          className={headerClass}
          style={headerStyle}
          aria-expanded={open}
          onClick={() => toggleOpen(item.id)}
        >
          {Icon ? (
            <span className={classes.navIcon}>
              <Icon />
            </span>
          ) : null}
          <span className={classes.navLabel}>{item.label}</span>
          <IconChevronDown
            className={[
              classes.navChevron,
              classes.navChevronEnd,
              open ? classes.navChevronOpen : "",
            ]
              .filter(Boolean)
              .join(" ")}
            size={14}
          />
        </button>
      )}

      {open ? (
        <div
          className={classes.navChildren}
          role="group"
          aria-label={item.label}
        >
          {item.children.map((child, index) => (
            <NavNode
              key={
                child.type === "divider"
                  ? `divider-${child.label}-${index}`
                  : child.type === "group"
                    ? child.id
                    : `${child.to}-${child.search?.category ?? ""}-${child.label}`
              }
              item={child}
              pathname={pathname}
              searchStr={searchStr}
              depth={depth + 1}
              openIds={openIds}
              toggleOpen={toggleOpen}
              onNavigate={onNavigate}
              activityBadge={activityBadge}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavNode({
  item,
  pathname,
  searchStr,
  depth,
  openIds,
  toggleOpen,
  onNavigate,
  activityBadge,
}: {
  item: NavItem;
  pathname: string;
  searchStr: string;
  depth: number;
  openIds: Set<string>;
  toggleOpen: (id: string) => void;
  onNavigate: () => void;
  activityBadge: number;
}): ReactNode {
  if (item.type === "divider") {
    return <div className={classes.divider}>{item.label}</div>;
  }

  if (item.type === "group") {
    return (
      <NavGroup
        item={item}
        pathname={pathname}
        searchStr={searchStr}
        depth={depth}
        openIds={openIds}
        toggleOpen={toggleOpen}
        onNavigate={onNavigate}
        activityBadge={activityBadge}
      />
    );
  }

  const Icon = item.icon;
  const active = linkMatches(pathname, searchStr, item.to, item.search);

  return (
    <Link
      to={item.to}
      search={item.search}
      className={[
        classes.navLink,
        depth > 0 ? classes.navLinkNested : "",
        active ? classes.navLinkActive : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        depth > 0 ? { paddingLeft: `${0.75 + depth * 0.75}rem` } : undefined
      }
      onClick={onNavigate}
    >
      {Icon ? (
        <span className={classes.navIcon}>
          <Icon />
        </span>
      ) : null}
      <span className={classes.navLabel}>{item.label}</span>
      {item.to === "/activity" && activityBadge > 0 ? (
        <span className={classes.navBadge}>
          {activityBadge > 99 ? "99+" : activityBadge}
        </span>
      ) : null}
    </Link>
  );
}

function collectAutoOpenIds(
  items: NavItem[],
  pathname: string,
  searchStr: string,
  acc: Set<string> = new Set(),
): Set<string> {
  for (const item of items) {
    if (
      item.type === "group" &&
      groupContainsActive(item, pathname, searchStr)
    ) {
      acc.add(item.id);
      collectAutoOpenIds(item.children, pathname, searchStr, acc);
    }
  }
  return acc;
}

function RouteComponent() {
  const [navbarOpen, setNavbarOpen] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const isHome = pathname === "/";
  const runningJobs = useGeneratorJobsStore((state) => state.activeCount());
  const importAttention = useCharacterImportSessionStore((state) =>
    state.attentionCount(),
  );
  const chatJobs = useChatGenerationStore((state) => state.jobs);
  const activeChats = Object.values(chatJobs).filter(
    (job) => job.streaming,
  ).length;
  const activityBadge = runningJobs + importAttention + activeChats;

  useEffect(() => {
    const auto = collectAutoOpenIds(NAVBAR_ITEMS, pathname, searchStr);
    if (auto.size === 0) return;
    setOpenIds((current) => {
      let changed = false;
      const next = new Set(current);
      for (const id of auto) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [pathname, searchStr]);

  function closeNavbar() {
    setNavbarOpen(false);
  }

  function toggleOpen(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
            {NAVBAR_ITEMS.map((item, index) => (
              <NavNode
                key={
                  item.type === "divider"
                    ? `divider-${item.label}-${index}`
                    : item.type === "group"
                      ? item.id
                      : item.to
                }
                item={item}
                pathname={pathname}
                searchStr={searchStr}
                depth={0}
                openIds={openIds}
                toggleOpen={toggleOpen}
                onNavigate={closeNavbar}
                activityBadge={activityBadge}
              />
            ))}
          </div>
        </div>
      </nav>

      <main className={classes.main}>
        <div
          className={isHome ? classes.containerBleed : classes.container}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
