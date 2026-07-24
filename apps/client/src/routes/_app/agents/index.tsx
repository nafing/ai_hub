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
import type { AgentListItem } from "@ai-hub/shared";
import { CreateAgentModal } from "@/features/agents/CreateAgentModal";
import {
  useAgents,
  useDeleteAgent,
  useDuplicateAgent,
} from "@/features/agents/queries";

export const Route = createFileRoute("/_app/agents/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const { data, isLoading, isError } = useAgents();
  const deleteMutation = useDeleteAgent();
  const duplicateMutation = useDuplicateAgent();

  const { custom, builtin } = useMemo(() => {
    const customAgents: AgentListItem[] = [];
    const builtinAgents: AgentListItem[] = [];
    for (const agent of data ?? []) {
      if (agent.is_built_in) builtinAgents.push(agent);
      else customAgents.push(agent);
    }
    return { custom: customAgents, builtin: builtinAgents };
  }, [data]);

  function confirmDelete(id: string, name: string) {
    modals.openConfirmModal({
      title: "Delete agent",
      children: (
        <Text size="sm">
          Delete <strong>{name || "this agent"}</strong>? This cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(id, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Agent removed.",
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
      onSuccess: (agent) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${agent.name}`,
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
      <CreateAgentModal opened={createOpened} onClose={closeCreate} />

      <Box
        pos="sticky"
        top="var(--app-shell-header-offset, 0px)"
        bg="var(--mantine-color-body)"
        style={{ zIndex: "calc(var(--mantine-z-index-app) - 1)" }}
        py="xs"
      >
        <Group justify="space-between" align="start" wrap="nowrap">
          <Title order={2}>Agents</Title>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="default"
              aria-label="New agent"
              onClick={openCreate}
            >
              <IconPlus />
            </ActionIcon>
          </Group>
        </Group>
        <Text c="dimmed">
          Pipeline agents (pre/post/parallel). Built-ins are seeded from
          examples and cannot be deleted.
        </Text>
      </Box>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : null}

      {isError ? <Text c="red">Failed to load agents.</Text> : null}

      {!isLoading && !isError ? (
        <Stack gap="xl">
          <Stack gap="sm">
            <div>
              <Title order={4}>Custom</Title>
              <Text size="sm" c="dimmed">
                Your own agents — create, edit, and delete freely.
              </Text>
            </div>
            {custom.length === 0 ? (
              <Text c="dimmed" size="sm">
                No custom agents yet. Create one with +.
              </Text>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                {custom.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
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
                Default agents shipped with the hub — editable, not deletable.
              </Text>
            </div>
            {builtin.length === 0 ? (
              <Text c="dimmed" size="sm">
                No built-in agents loaded.
              </Text>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                {builtin.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
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

function AgentCard({
  agent,
  onDuplicate,
  onDelete,
  duplicateLoading,
  deleteLoading,
}: {
  agent: AgentListItem;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  duplicateLoading: boolean;
  deleteLoading: boolean;
}) {
  return (
    <Card withBorder padding={0}>
      <Link
        to="/agents/$agentId"
        params={{ agentId: agent.id }}
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
                {agent.name || "untitled"}
              </Text>
              <Text size="xs" c="dimmed" ff="monospace" lineClamp={1}>
                {agent.slug}
              </Text>
              <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
                {agent.description || "No description"}
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
                  onDuplicate(agent.id);
                }}
                loading={duplicateLoading}
              >
                <IconCopy />
              </ActionIcon>
              {!agent.is_built_in ? (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  aria-label="Delete"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDelete(agent.id, agent.name);
                  }}
                  loading={deleteLoading}
                >
                  <IconTrash />
                </ActionIcon>
              ) : null}
            </Group>
          </Group>
          <Group gap={6} mt="sm">
            <Badge size="sm" variant="light">
              {agent.phase}
            </Badge>
            <Badge size="sm" variant="outline">
              {agent.category}
            </Badge>
            {agent.execution === "feature" ? (
              <Badge size="sm" variant="outline" color="orange">
                feature
              </Badge>
            ) : null}
            {agent.default_tools.length > 0 ? (
              <Badge size="sm" variant="outline">
                {agent.default_tools.length}{" "}
                {agent.default_tools.length === 1 ? "tool" : "tools"}
              </Badge>
            ) : null}
          </Group>
        </Box>
      </Link>
    </Card>
  );
}
