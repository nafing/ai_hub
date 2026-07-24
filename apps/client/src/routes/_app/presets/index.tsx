import { useMemo } from "react";
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
import {
  PRESET_CATEGORIES,
  PRESET_CATEGORY_LABELS,
  type PresetCategory,
  type PresetListItem,
} from "@ai-hub/shared";
import { CreatePresetModal } from "@/features/presets/CreatePresetModal";
import {
  useDeletePreset,
  useDuplicatePreset,
  usePresets,
  useUpdatePreset,
} from "@/features/presets/queries";

export const Route = createFileRoute("/_app/presets/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const { data, isLoading, isError } = usePresets();
  const deleteMutation = useDeletePreset();
  const duplicateMutation = useDuplicatePreset();
  const updateMutation = useUpdatePreset();

  const grouped = useMemo(() => {
    const byCategory = new Map<PresetCategory, PresetListItem[]>();
    for (const category of PRESET_CATEGORIES) {
      byCategory.set(category, []);
    }
    for (const preset of data ?? []) {
      const list = byCategory.get(preset.category) ?? [];
      list.push(preset);
      byCategory.set(preset.category, list);
    }
    return PRESET_CATEGORIES.map((category) => ({
      category,
      presets: byCategory.get(category) ?? [],
    })).filter((group) => group.presets.length > 0);
  }, [data]);

  function confirmDelete(id: string, name: string) {
    modals.openConfirmModal({
      title: "Delete preset",
      children: (
        <Text size="sm">
          Delete <strong>{name || "this preset"}</strong>? This cannot be
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
              message: "Preset removed.",
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
      onSuccess: (preset) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${preset.name}`,
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
      <CreatePresetModal opened={createOpened} onClose={closeCreate} />

      <Box
        pos="sticky"
        top="var(--app-shell-header-offset, 0px)"
        bg="var(--mantine-color-body)"
        style={{ zIndex: "calc(var(--mantine-z-index-app) - 1)" }}
        py="xs"
      >
        <Group justify="space-between" align="start" wrap="nowrap">
          <Title order={2}>Presets</Title>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="default"
              aria-label="New preset"
              onClick={openCreate}
            >
              <IconPlus />
            </ActionIcon>
          </Group>
        </Group>
        <Text c="dimmed">Manage prompt presets for chats.</Text>
      </Box>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : null}

      {isError ? <Text c="red">Failed to load presets.</Text> : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <Text c="dimmed">No presets yet. Create one to get started.</Text>
      ) : null}

      {grouped.map(({ category, presets }) => (
        <Stack key={category} gap="sm">
          <Title order={4}>{PRESET_CATEGORY_LABELS[category]}</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {presets.map((preset) => (
              <Card key={preset.id} withBorder padding={0}>
                <Link
                  to="/presets/$presetId"
                  params={{ presetId: preset.id }}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                  }}
                >
                  <Box p="md">
                    <Group justify="space-between" align="start" wrap="nowrap">
                      <Text size="lg" fw={600} lineClamp={1}>
                        {preset.name || "Untitled"}
                      </Text>
                      <Group gap="xs" wrap="nowrap">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color={preset.is_default ? "yellow" : "gray"}
                          aria-label={
                            preset.is_default
                              ? "Default preset"
                              : "Set as default"
                          }
                          disabled={preset.is_default}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleSetDefault(preset.id);
                          }}
                          loading={
                            updateMutation.isPending &&
                            updateMutation.variables?.id === preset.id
                          }
                        >
                          {preset.is_default ? (
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
                            handleDuplicate(preset.id);
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
                            confirmDelete(preset.id, preset.name);
                          }}
                          loading={deleteMutation.isPending}
                        >
                          <IconTrash />
                        </ActionIcon>
                      </Group>
                    </Group>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {preset.description || "No description"}
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>
                      {preset.wrap_format} · {preset.sections_count} sections ·{" "}
                      {preset.variables_count} variables
                    </Text>
                  </Box>
                </Link>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      ))}
    </Stack>
  );
}
