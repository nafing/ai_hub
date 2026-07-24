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
import {
  REGEX_APPLY_TO_LABELS,
  REGEX_TARGET_LABELS,
  type RegexApplyTo,
  type RegexTarget,
} from "@ai-hub/shared";
import { CreateRegexModal } from "@/features/regexes/CreateRegexModal";
import {
  useDeleteRegex,
  useDuplicateRegex,
  useRegexes,
} from "@/features/regexes/queries";

export const Route = createFileRoute("/_app/regexes/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const { data, isLoading, isError } = useRegexes();
  const deleteMutation = useDeleteRegex();
  const duplicateMutation = useDuplicateRegex();

  function confirmDelete(id: string, name: string) {
    modals.openConfirmModal({
      title: "Delete regex",
      children: (
        <Text size="sm">
          Delete <strong>{name || "this regex"}</strong>? This cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(id, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Regex script removed.",
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
      onSuccess: (script) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${script.name}`,
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
      <CreateRegexModal opened={createOpened} onClose={closeCreate} />

      <Box
        pos="sticky"
        top="var(--app-shell-header-offset, 0px)"
        bg="var(--mantine-color-body)"
        style={{ zIndex: "calc(var(--mantine-z-index-app) - 1)" }}
        py="xs"
      >
        <Group justify="space-between" align="start" wrap="nowrap">
          <Title order={2}>Regexes</Title>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="default"
              aria-label="New regex"
              onClick={openCreate}
            >
              <IconPlus />
            </ActionIcon>
          </Group>
        </Group>
        <Text c="dimmed">
          Find/replace scripts for AI output and user input (display and/or
          prompt).
        </Text>
      </Box>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : null}

      {isError ? <Text c="red">Failed to load regexes.</Text> : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <Text c="dimmed">No regex scripts yet. Create one to get started.</Text>
      ) : null}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {data?.map((script) => (
          <Card key={script.id} withBorder padding={0}>
            <Link
              to="/regexes/$regexId"
              params={{ regexId: script.id }}
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
                      {script.name || "Untitled"}
                    </Text>
                    <Text size="xs" c="dimmed" ff="monospace" lineClamp={1}>
                      /{script.find_regex || "…"}/ →{" "}
                      {script.replace_with || "(empty)"}
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
                        handleDuplicate(script.id);
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
                        confirmDelete(script.id, script.name);
                      }}
                      loading={deleteMutation.isPending}
                    >
                      <IconTrash />
                    </ActionIcon>
                  </Group>
                </Group>
                <Group gap={6} mt="sm">
                  <Badge size="sm" variant="light" color={script.enabled ? "green" : "gray"}>
                    {script.enabled ? "On" : "Off"}
                  </Badge>
                  <Badge size="sm" variant="outline">
                    #{script.order}
                  </Badge>
                  <Badge size="sm" variant="outline">
                    {REGEX_APPLY_TO_LABELS[script.apply_to as RegexApplyTo]}
                  </Badge>
                  {script.targets.map((target) => (
                    <Badge key={target} size="sm" variant="dot">
                      {REGEX_TARGET_LABELS[target as RegexTarget]}
                    </Badge>
                  ))}
                </Group>
              </Box>
            </Link>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
