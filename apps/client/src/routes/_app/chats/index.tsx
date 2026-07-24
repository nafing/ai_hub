import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Center,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconMessages, IconPlus, IconTrash } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CHAT_MODE_LABELS, type ChatListItem } from "@ai-hub/shared";
import { CreateChatModal } from "@/features/chats/CreateChatModal";
import { useChats, useDeleteChat } from "@/features/chats/queries";

export const Route = createFileRoute("/_app/chats/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const { data, isLoading, isError } = useChats();
  const deleteMutation = useDeleteChat();

  function confirmDelete(chat: ChatListItem) {
    modals.openConfirmModal({
      title: "Delete chat",
      children: (
        <Text size="sm">
          Delete <strong>{chat.title || "this chat"}</strong>? This cannot be
          undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(chat.id, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Chat removed.",
              color: "green",
            });
          },
          onError: (error) => {
            notifications.show({
              title: "Delete failed",
              message: error instanceof Error ? error.message : "Unknown error",
              color: "red",
            });
          },
        });
      },
    });
  }

  return (
    <Stack>
      <CreateChatModal opened={createOpened} onClose={closeCreate} />

      <Box
        pos="sticky"
        top="var(--app-shell-header-offset, 0px)"
        bg="var(--mantine-color-body)"
        style={{ zIndex: "calc(var(--mantine-z-index-app) - 1)" }}
        py="xs"
      >
        <Group justify="space-between" align="start" wrap="nowrap">
          <Title order={2}>Chats</Title>
          <ActionIcon
            variant="default"
            aria-label="New chat"
            onClick={openCreate}
          >
            <IconPlus />
          </ActionIcon>
        </Group>
        <Text c="dimmed">Roleplay and conversation sessions.</Text>
      </Box>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : null}

      {isError ? <Text c="red">Failed to load chats.</Text> : null}

      {!isLoading && !isError ? (
        (data ?? []).length === 0 ? (
          <Text c="dimmed" size="sm">
            No chats yet. Create one with +.
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {(data ?? []).map((chat) => (
              <ChatCard
                key={chat.id}
                chat={chat}
                onDelete={confirmDelete}
                deleteLoading={deleteMutation.isPending}
              />
            ))}
          </SimpleGrid>
        )
      ) : null}
    </Stack>
  );
}

function ChatCard({
  chat,
  onDelete,
  deleteLoading,
}: {
  chat: ChatListItem;
  onDelete: (chat: ChatListItem) => void;
  deleteLoading: boolean;
}) {
  return (
    <Card withBorder padding="md" component={Link} to={`/chats/${chat.id}`}>
      <Group justify="space-between" align="start" wrap="nowrap" mb="xs">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <IconMessages size={20} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <Text fw={600} lineClamp={1}>
              {chat.title || "Untitled"}
            </Text>

            <Group gap={6} mt={4}>
              <Badge size="xs" variant="light">
                {CHAT_MODE_LABELS[chat.mode]}
              </Badge>
              <Text size="xs" c="dimmed">
                {chat.message_count} messages
              </Text>
            </Group>
          </div>
        </Group>
        <ActionIcon
          variant="subtle"
          color="red"
          aria-label="Delete chat"
          loading={deleteLoading}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(chat);
          }}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
      {chat.preview ? (
        <Text size="sm" c="dimmed" lineClamp={3}>
          {chat.preview}
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          Empty chat
        </Text>
      )}
    </Card>
  );
}
