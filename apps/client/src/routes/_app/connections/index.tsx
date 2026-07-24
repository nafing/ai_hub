import {
  ActionIcon,
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
import {
  IconCopy,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CreateConnectionModal } from "@/features/connections/CreateConnectionModal";
import {
  useConnections,
  useDeleteConnection,
  useDuplicateConnection,
  useUpdateConnection,
} from "@/features/connections/queries";

export const Route = createFileRoute("/_app/connections/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const { data, isLoading, isError } = useConnections();
  const deleteMutation = useDeleteConnection();
  const duplicateMutation = useDuplicateConnection();
  const updateMutation = useUpdateConnection();

  function confirmDelete(id: string, name: string) {
    modals.openConfirmModal({
      title: "Delete connection",
      children: (
        <Text size="sm">
          Delete <strong>{name || "this connection"}</strong>? This cannot be
          undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(id, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Connection removed.",
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

  function handleDuplicate(id: string) {
    duplicateMutation.mutate(id, {
      onSuccess: (connection) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${connection.name}`,
          color: "green",
        });
      },
      onError: (error) => {
        notifications.show({
          title: "Duplicate failed",
          message: error instanceof Error ? error.message : "Unknown error",
          color: "red",
        });
      },
    });
  }

  function handleSetDefault(id: string) {
    updateMutation.mutate(
      { id, input: { is_default: true } },
      {
        onError: (error) => {
          notifications.show({
            title: "Set default failed",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  }

  return (
    <Stack>
      <CreateConnectionModal opened={createOpened} onClose={closeCreate} />

      <Box
        pos="sticky"
        top="var(--app-shell-header-offset, 0px)"
        bg="var(--mantine-color-body)"
        style={{ zIndex: "calc(var(--mantine-z-index-app) - 1)" }}
        py="xs"
      >
        <Group justify="space-between" align="start" wrap="nowrap">
          <Title order={2}>Connections</Title>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="default"
              aria-label="New connection"
              onClick={openCreate}
            >
              <IconPlus />
            </ActionIcon>
          </Group>
        </Group>
        <Text c="dimmed">Manage your OpenRouter connections.</Text>
      </Box>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : null}

      {isError ? <Text c="red">Failed to load connections.</Text> : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <Text c="dimmed">No connections yet. Create one to get started.</Text>
      ) : null}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {data?.map((connection) => (
          <Card key={connection.id} withBorder padding={0}>
            <Link
              to="/connections/$connectionId"
              params={{ connectionId: connection.id }}
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "block",
              }}
            >
              <Box p="md">
                <Group justify="space-between" align="start" wrap="nowrap">
                  <Text size="lg" fw={600} lineClamp={1}>
                    {connection.name || "Untitled"}
                  </Text>
                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color={connection.is_default ? "yellow" : "gray"}
                      aria-label={
                        connection.is_default
                          ? "Default connection"
                          : "Set as default"
                      }
                      disabled={connection.is_default}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleSetDefault(connection.id);
                      }}
                      loading={
                        updateMutation.isPending &&
                        updateMutation.variables?.id === connection.id
                      }
                    >
                      {connection.is_default ? (
                        <IconStarFilled />
                      ) : (
                        <IconStar />
                      )}
                    </ActionIcon>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      aria-label="Duplicate"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDuplicate(connection.id);
                      }}
                      loading={duplicateMutation.isPending}
                    >
                      <IconCopy />
                    </ActionIcon>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      aria-label="Delete"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        confirmDelete(connection.id, connection.name);
                      }}
                      loading={deleteMutation.isPending}
                    >
                      <IconTrash />
                    </ActionIcon>
                  </Group>
                </Group>
                <Text size="sm" c="dimmed" lineClamp={1}>
                  {connection.model || "No model"}
                  {connection.preferred_provider
                    ? ` · ${connection.preferred_provider}`
                    : ""}
                </Text>
              </Box>
            </Link>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
