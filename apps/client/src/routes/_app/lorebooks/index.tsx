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
import { IconCopy, IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { LorebookListItem } from "@ai-hub/shared";
import { LOREBOOK_CATEGORY_LABELS } from "@ai-hub/shared";
import { CreateLorebookModal } from "@/features/lorebooks/CreateLorebookModal";
import { ImportLorebookModal } from "@/features/lorebooks/ImportLorebookModal";
import {
  useDeleteLorebook,
  useDuplicateLorebook,
  useLorebooks,
} from "@/features/lorebooks/queries";

export const Route = createFileRoute("/_app/lorebooks/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [importOpened, { open: openImport, close: closeImport }] =
    useDisclosure(false);
  const { data, isLoading, isError } = useLorebooks();
  const deleteMutation = useDeleteLorebook();
  const duplicateMutation = useDuplicateLorebook();

  function confirmDelete(id: string, name: string) {
    modals.openConfirmModal({
      title: "Delete lorebook",
      children: (
        <Text size="sm">
          Delete <strong>{name || "this lorebook"}</strong>? This cannot be
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
              message: "Lorebook removed.",
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
      onSuccess: (lorebook) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${lorebook.name}`,
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

  return (
    <Stack>
      <CreateLorebookModal opened={createOpened} onClose={closeCreate} />
      <ImportLorebookModal opened={importOpened} onClose={closeImport} />

      <Box
        pos="sticky"
        top="var(--app-shell-header-offset, 0px)"
        bg="var(--mantine-color-body)"
        style={{ zIndex: "calc(var(--mantine-z-index-app) - 1)" }}
        py="xs"
      >
        <Group justify="space-between" align="start" wrap="nowrap">
          <Title order={2}>Lorebooks</Title>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="default"
              aria-label="Import lorebook"
              onClick={openImport}
            >
              <IconUpload />
            </ActionIcon>
            <ActionIcon
              variant="default"
              aria-label="New lorebook"
              onClick={openCreate}
            >
              <IconPlus />
            </ActionIcon>
          </Group>
        </Group>
        <Text c="dimmed">
          Lorebooks. Create, edit, duplicate, or import JSON.
        </Text>
      </Box>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : null}

      {isError ? <Text c="red">Failed to load lorebooks.</Text> : null}

      {!isLoading && !isError ? (
        (data ?? []).length === 0 ? (
          <Text c="dimmed" size="sm">
            No lorebooks yet. Create one with + or import JSON.
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {(data ?? []).map((lorebook) => (
              <LorebookCard
                key={lorebook.id}
                lorebook={lorebook}
                onDuplicate={handleDuplicate}
                onDelete={confirmDelete}
                duplicateLoading={duplicateMutation.isPending}
                deleteLoading={deleteMutation.isPending}
              />
            ))}
          </SimpleGrid>
        )
      ) : null}
    </Stack>
  );
}

function LorebookCard({
  lorebook,
  onDuplicate,
  onDelete,
  duplicateLoading,
  deleteLoading,
}: {
  lorebook: LorebookListItem;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  duplicateLoading: boolean;
  deleteLoading: boolean;
}) {
  return (
    <Card withBorder padding={0}>
      <Link
        to="/lorebooks/$lorebookId"
        params={{ lorebookId: lorebook.id }}
        style={{
          textDecoration: "none",
          color: "inherit",
          display: "block",
        }}
      >
        <Box p="md">
          <Group justify="space-between" align="start" wrap="nowrap">
            <div style={{ minWidth: 0 }}>
              <Text size="lg" fw={600} lineClamp={1}>
                {lorebook.name || "untitled"}
              </Text>
              <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
                {lorebook.description || "No description"}
              </Text>
            </div>
            <Group gap="xs" wrap="nowrap">
              <ActionIcon
                size="sm"
                variant="subtle"
                aria-label="Duplicate"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDuplicate(lorebook.id);
                }}
                loading={duplicateLoading}
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
                  onDelete(lorebook.id, lorebook.name);
                }}
                loading={deleteLoading}
              >
                <IconTrash />
              </ActionIcon>
            </Group>
          </Group>
          <Group gap={6} mt="sm">
            <Badge size="sm" variant="light">
              {LOREBOOK_CATEGORY_LABELS[lorebook.category]}
            </Badge>
            <Badge size="sm" variant="light">
              {lorebook.entry_count}{" "}
              {lorebook.entry_count === 1 ? "entry" : "entries"}
            </Badge>
            {!lorebook.enabled ? (
              <Badge size="sm" variant="outline" color="gray">
                disabled
              </Badge>
            ) : null}
            {lorebook.global ? (
              <Badge size="sm" variant="outline">
                global
              </Badge>
            ) : null}
            {lorebook.linked_characters.length > 0 ? (
              <Badge size="sm" variant="outline">
                {lorebook.linked_characters.length}{" "}
                {lorebook.linked_characters.length === 1
                  ? "character"
                  : "characters"}
              </Badge>
            ) : null}
            {lorebook.linked_personas.length > 0 ? (
              <Badge size="sm" variant="outline">
                {lorebook.linked_personas.length}{" "}
                {lorebook.linked_personas.length === 1 ? "persona" : "personas"}
              </Badge>
            ) : null}
            {lorebook.recursive_scanning ? (
              <Badge size="sm" variant="outline">
                recursive
              </Badge>
            ) : null}
            {lorebook.token_budget != null ? (
              <Badge size="sm" variant="outline">
                {lorebook.token_budget} tok
              </Badge>
            ) : null}
          </Group>
        </Box>
      </Link>
    </Card>
  );
}
