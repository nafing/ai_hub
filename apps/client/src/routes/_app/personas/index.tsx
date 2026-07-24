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
import type { PersonaListItem } from "@ai-hub/shared";
import { api } from "@/lib/api";
import { CreatePersonaModal } from "@/features/personas/CreatePersonaModal";
import { personaAvatarSrc } from "@/features/personas/avatar-url";
import {
  useDeletePersona,
  useDuplicatePersona,
  usePersonas,
} from "@/features/personas/queries";

export const Route = createFileRoute("/_app/personas/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const { data, isLoading, isError } = usePersonas();
  const deleteMutation = useDeletePersona();
  const duplicateMutation = useDuplicatePersona();

  function confirmDelete(id: string, name: string) {
    modals.openConfirmModal({
      title: "Delete persona",
      children: (
        <Text size="sm">
          Delete <strong>{name || "this persona"}</strong>? This cannot be
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
              message: "Persona removed.",
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
      onSuccess: (persona) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${persona.name}`,
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
      <CreatePersonaModal opened={createOpened} onClose={closeCreate} />

      <Box
        pos="sticky"
        top="var(--app-shell-header-offset, 0px)"
        bg="var(--mantine-color-body)"
        style={{ zIndex: "calc(var(--mantine-z-index-app) - 1)" }}
        py="xs"
      >
        <Group justify="space-between" align="start" wrap="nowrap">
          <Title order={2}>Personas</Title>
          <ActionIcon
            variant="default"
            aria-label="New persona"
            onClick={openCreate}
          >
            <IconPlus />
          </ActionIcon>
        </Group>
        <Text c="dimmed">
          Player personas for `{"{{user}}"}`. One can be marked as default.
        </Text>
      </Box>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : null}

      {isError ? <Text c="red">Failed to load personas.</Text> : null}

      {!isLoading && !isError ? (
        (data ?? []).length === 0 ? (
          <Text c="dimmed" size="sm">
            No personas yet. Create one with +.
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {(data ?? []).map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
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

function PersonaCard({
  persona,
  onDuplicate,
  onDelete,
  duplicateLoading,
  deleteLoading,
}: {
  persona: PersonaListItem;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  duplicateLoading: boolean;
  deleteLoading: boolean;
}) {
  const avatarSrc = personaAvatarSrc(
    persona.avatar,
    String(api.defaults.baseURL),
  );

  return (
    <Card withBorder padding={0}>
      <Link
        to="/personas/$personaId"
        params={{ personaId: persona.id }}
        style={{
          textDecoration: "none",
          color: "inherit",
          display: "block",
        }}
      >
        <Box p="md">
          <Group justify="space-between" align="start" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              {avatarSrc ? (
                <Box
                  w={48}
                  h={48}
                  style={{
                    flexShrink: 0,
                    borderRadius: 6,
                    overflow: "hidden",
                    background: "var(--mantine-color-default-hover)",
                  }}
                >
                  <img
                    src={avatarSrc}
                    alt=""
                    width={48}
                    height={48}
                    style={{ objectFit: "cover", display: "block" }}
                  />
                </Box>
              ) : null}
              <div style={{ minWidth: 0 }}>
                <Text size="lg" fw={600} lineClamp={1}>
                  {persona.name || "untitled"}
                </Text>
                <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
                  {persona.description || "No description"}
                </Text>
              </div>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <ActionIcon
                size="sm"
                variant="subtle"
                aria-label="Duplicate"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDuplicate(persona.id);
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
                  onDelete(persona.id, persona.name);
                }}
                loading={deleteLoading}
              >
                <IconTrash />
              </ActionIcon>
            </Group>
          </Group>
          <Group gap={6} mt="sm">
            {persona.is_default ? (
              <Badge size="sm" variant="light">
                default
              </Badge>
            ) : null}
          </Group>
        </Box>
      </Link>
    </Card>
  );
}
