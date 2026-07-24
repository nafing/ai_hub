import { useMemo } from "react";
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
import { IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ToolListItem } from "@ai-hub/shared";
import { CreateToolModal } from "@/features/tools/CreateToolModal";
import {
  useDeleteTool,
  useDuplicateTool,
  useTools,
} from "@/features/tools/queries";

export const Route = createFileRoute("/_app/tools/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const { data, isLoading, isError } = useTools();
  const deleteMutation = useDeleteTool();
  const duplicateMutation = useDuplicateTool();

  const { custom, builtin } = useMemo(() => {
    const customTools: ToolListItem[] = [];
    const builtinTools: ToolListItem[] = [];
    for (const tool of data ?? []) {
      if (tool.is_built_in) builtinTools.push(tool);
      else customTools.push(tool);
    }
    return { custom: customTools, builtin: builtinTools };
  }, [data]);

  function confirmDelete(id: string, name: string) {
    modals.openConfirmModal({
      title: "Delete tool",
      children: (
        <Text size="sm">
          Delete <strong>{name || "this tool"}</strong>? This cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(id, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Tool removed.",
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
      onSuccess: (tool) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${tool.name}`,
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
      <CreateToolModal opened={createOpened} onClose={closeCreate} />

      <Box
        pos="sticky"
        top="var(--app-shell-header-offset, 0px)"
        bg="var(--mantine-color-body)"
        style={{ zIndex: "calc(var(--mantine-z-index-app) - 1)" }}
        py="xs"
      >
        <Group justify="space-between" align="start" wrap="nowrap">
          <Title order={2}>Tools</Title>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="default"
              aria-label="New tool"
              onClick={openCreate}
            >
              <IconPlus />
            </ActionIcon>
          </Group>
        </Group>
        <Text c="dimmed">
          LLM function tools for agents. Built-in tools are seeded automatically
          and cannot be deleted.
        </Text>
      </Box>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : null}

      {isError ? <Text c="red">Failed to load tools.</Text> : null}

      {!isLoading && !isError ? (
        <Stack gap="xl">
          <Stack gap="sm">
            <div>
              <Title order={4}>Custom</Title>
              <Text size="sm" c="dimmed">
                Your own tools — create, edit, and delete freely.
              </Text>
            </div>
            {custom.length === 0 ? (
              <Text c="dimmed" size="sm">
                No custom tools yet. Create one with +.
              </Text>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                {custom.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onDuplicate={handleDuplicate}
                    onDelete={confirmDelete}
                    duplicateLoading={duplicateMutation.isPending}
                    deleteLoading={deleteMutation.isPending}
                  />
                ))}
              </SimpleGrid>
            )}
          </Stack>

          <Stack gap="sm">
            <div>
              <Title order={4}>Built-in</Title>
              <Text size="sm" c="dimmed">
                Default tools shipped with the hub — editable, not deletable.
              </Text>
            </div>
            {builtin.length === 0 ? (
              <Text c="dimmed" size="sm">
                No built-in tools loaded.
              </Text>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                {builtin.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onDuplicate={handleDuplicate}
                    onDelete={confirmDelete}
                    duplicateLoading={duplicateMutation.isPending}
                    deleteLoading={deleteMutation.isPending}
                  />
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}

function ToolCard({
  tool,
  onDuplicate,
  onDelete,
  duplicateLoading,
  deleteLoading,
}: {
  tool: ToolListItem;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  duplicateLoading: boolean;
  deleteLoading: boolean;
}) {
  return (
    <Card withBorder padding={0}>
      <Link
        to="/tools/$toolId"
        params={{ toolId: tool.id }}
        style={{
          textDecoration: "none",
          color: "inherit",
          display: "block",
        }}
      >
        <Box p="md">
          <Group justify="space-between" align="start" wrap="nowrap">
            <div style={{ minWidth: 0 }}>
              <Text size="lg" fw={600} ff="monospace" lineClamp={1}>
                {tool.name || "untitled"}
              </Text>
              <Text size="sm" c="dimmed" lineClamp={2}>
                {tool.description || "No description"}
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
                  onDuplicate(tool.id);
                }}
                loading={duplicateLoading}
              >
                <IconCopy />
              </ActionIcon>
              {!tool.is_built_in ? (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  aria-label="Delete"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDelete(tool.id, tool.name);
                  }}
                  loading={deleteLoading}
                >
                  <IconTrash />
                </ActionIcon>
              ) : null}
            </Group>
          </Group>
          <Group gap={6} mt="sm">
            <Badge size="sm" variant="outline">
              {tool.parameter_count}{" "}
              {tool.parameter_count === 1 ? "param" : "params"}
            </Badge>
          </Group>
        </Box>
      </Link>
    </Card>
  );
}
