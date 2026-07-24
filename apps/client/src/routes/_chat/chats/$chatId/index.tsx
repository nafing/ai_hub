import {
  ActionIcon,
  AppShell,
  Box,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowLeft, IconSettings } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChatSession } from "@/features/chats/ChatSession";
import { ChatSettingsPanel } from "@/features/chats/ChatSettingsPanel";
import { useChat } from "@/features/chats/queries";

export const Route = createFileRoute("/_chat/chats/$chatId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { chatId } = Route.useParams();
  const { data: chat, isLoading, isError } = useChat(chatId);
  const [settingsOpen, { toggle: toggleSettings }] = useDisclosure();

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  if (isError || !chat) {
    return (
      <Center h="100%">
        <Text c="red">Failed to load chat.</Text>
      </Center>
    );
  }

  return (
    <AppShell
      layout="alt"
      header={{ height: 56 }}
      padding={0}
      aside={{
        width: 400,
        breakpoint: "md",
        collapsed: { desktop: !settingsOpen, mobile: !settingsOpen },
      }}
    >
      <AppShell.Header>
        <Group justify="space-between" wrap="nowrap" h="100%" px="md">
          <Group gap="sm">
            <ActionIcon
              component={Link}
              to="/chats"
              variant="subtle"
              aria-label="Back to chats"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Text fw={600}>Chat</Text>
          </Group>

          <ActionIcon
            variant={settingsOpen ? "filled" : "default"}
            aria-label="Toggle settings"
            onClick={toggleSettings}
          >
            <IconSettings size={18} />
          </ActionIcon>
        </Group>
      </AppShell.Header>
      <AppShell.Main
        style={{
          height: "calc(100vh - 56px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Stack gap={0} style={{ flex: 1, minWidth: 0, height: "100%" }} pb="md">
          <Group
            px="md"
            py="xs"
            justify="space-between"
            style={{
              borderBottom: "1px solid var(--mantine-color-default-border)",
            }}
          >
            <div>
              <Title order={4} lineClamp={1}>
                {chat.title || "Untitled"}
              </Title>
              <Text size="xs" c="dimmed" tt="capitalize">
                {chat.mode}
              </Text>
            </div>
          </Group>
          <Box style={{ flex: 1, minHeight: 0 }}>
            <ChatSession chat={chat} />
          </Box>
        </Stack>

        <AppShell.Aside p="md">
          <Group justify="space-between" align="start" wrap="nowrap">
            <Text fw={600}>Chat Settings</Text>

            <ActionIcon
              variant={settingsOpen ? "filled" : "default"}
              aria-label="Toggle settings"
              onClick={toggleSettings}
              hiddenFrom="md"
            >
              <IconSettings size={18} />
            </ActionIcon>
          </Group>

          <ChatSettingsPanel chat={chat} />
        </AppShell.Aside>
      </AppShell.Main>
    </AppShell>
  );
}
