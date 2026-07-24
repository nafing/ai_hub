import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  ActionIcon,
  AppShell,
  Burger,
  Container,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Stack,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconAiAgent,
  IconArrowLeft,
  IconBook,
  IconBrandTwitter,
  IconConnection,
  IconDashboard,
  IconFunction,
  IconMessages,
  IconPresentation,
  IconRegex,
  IconSettings,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";

export const Route = createFileRoute("/_app")({
  component: RouteComponent,
});

const NAVBAR_ITEMS = [
  { label: "Dashboard", icon: IconDashboard, to: "/" },
  { label: "Chats", icon: IconMessages, to: "/chats" },
  { label: "Twatter", icon: IconBrandTwitter, to: "/twatter" },

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
  const [openedNavbar, { toggle: toggleNavbar }] = useDisclosure();
  const [openedAside, { toggle: toggleAside }] = useDisclosure();

  return (
    <AppShell
      layout="alt"
      header={{ height: 60 }}
      footer={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: !openedNavbar },
      }}
      aside={{
        width: 300,
        breakpoint: "md",
        collapsed: { desktop: !openedAside, mobile: !openedAside },
      }}
      padding="xs"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger
            opened={openedNavbar}
            onClick={toggleNavbar}
            hiddenFrom="sm"
            size="sm"
          />
          <ActionIcon onClick={toggleAside}>
            <IconArrowLeft />
          </ActionIcon>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <Stack h="100%">
          <Group>
            <Burger
              opened={openedNavbar}
              onClick={toggleNavbar}
              hiddenFrom="sm"
              size="sm"
            />
          </Group>
          <ScrollArea.Autosize>
            <Stack gap="xs">
              {NAVBAR_ITEMS.map((item, index) => {
                if (item.type === "divider") {
                  return <Divider key={index} label={item.label} />;
                }

                return (
                  <NavLink
                    key={index}
                    component={Link}
                    to={item.to}
                    label={item.label}
                    leftSection={item.icon && <item.icon />}
                  />
                );
              })}
            </Stack>
          </ScrollArea.Autosize>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Aside p="md">Aside</AppShell.Aside>
      <AppShell.Main>
        <Container size="xl">
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
