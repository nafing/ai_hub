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
import { IconCopy, IconPlus, IconRefresh, IconTrash, IconUpload } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { CharacterListItem } from "@ai-hub/shared";
import { api } from "@/lib/api";
import { CreateCharacterModal } from "@/features/characters/CreateCharacterModal";
import { ImportCharacterModal } from "@/features/characters/ImportCharacterModal";
import { RegenerateCharactersModal } from "@/features/characters/RegenerateCharactersModal";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
import {
  useCharacters,
  useDeleteCharacter,
  useDuplicateCharacter,
} from "@/features/characters/queries";

export const Route = createFileRoute("/_app/characters/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [importOpened, { open: openImport, close: closeImport }] =
    useDisclosure(false);
  const [regenerateOpened, { open: openRegenerate, close: closeRegenerate }] =
    useDisclosure(false);
  const { data, isLoading, isError } = useCharacters();
  const deleteMutation = useDeleteCharacter();
  const duplicateMutation = useDuplicateCharacter();

  function confirmDelete(id: string, name: string) {
    modals.openConfirmModal({
      title: "Delete character",
      children: (
        <Text size="sm">
          Delete <strong>{name || "this character"}</strong>? This cannot be
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
              message: "Character removed.",
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
      onSuccess: (character) => {
        notifications.show({
          title: "Duplicated",
          message: `Created ${character.data.name}`,
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
      <CreateCharacterModal opened={createOpened} onClose={closeCreate} />
      <ImportCharacterModal opened={importOpened} onClose={closeImport} />
      <RegenerateCharactersModal
        opened={regenerateOpened}
        onClose={closeRegenerate}
      />

      <Box
        pos="sticky"
        top="var(--app-shell-header-offset, 0px)"
        bg="var(--mantine-color-body)"
        style={{ zIndex: "calc(var(--mantine-z-index-app) - 1)" }}
        py="xs"
      >
        <Group justify="space-between" align="start" wrap="nowrap">
          <Title order={2}>Characters</Title>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="default"
              aria-label="Regenerate characters"
              onClick={openRegenerate}
            >
              <IconRefresh />
            </ActionIcon>
            <ActionIcon
              variant="default"
              aria-label="Import character card"
              onClick={openImport}
            >
              <IconUpload />
            </ActionIcon>
            <ActionIcon
              variant="default"
              aria-label="New character"
              onClick={openCreate}
            >
              <IconPlus />
            </ActionIcon>
          </Group>
        </Group>
        <Text c="dimmed">
          Characters. Create, edit, duplicate, regenerate, or import JSON/PNG.
        </Text>
      </Box>

      {isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : null}

      {isError ? <Text c="red">Failed to load characters.</Text> : null}

      {!isLoading && !isError ? (
        (data ?? []).length === 0 ? (
          <Text c="dimmed" size="sm">
            No characters yet. Create one with +.
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {(data ?? []).map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
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

function CharacterCard({
  character,
  onDuplicate,
  onDelete,
  duplicateLoading,
  deleteLoading,
}: {
  character: CharacterListItem;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  duplicateLoading: boolean;
  deleteLoading: boolean;
}) {
  const avatarSrc = characterAvatarSrc(
    character.avatar,
    String(api.defaults.baseURL),
  );

  return (
    <Card withBorder padding={0}>
      <Link
        to="/characters/$characterId"
        params={{ characterId: character.id }}
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
                  {character.name || "untitled"}
                </Text>
                {character.creator ? (
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    by {character.creator}
                  </Text>
                ) : null}
                <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
                  {character.description || "No description"}
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
                  onDuplicate(character.id);
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
                  onDelete(character.id, character.name);
                }}
                loading={deleteLoading}
              >
                <IconTrash />
              </ActionIcon>
            </Group>
          </Group>
          <Group gap={6} mt="sm">
            {character.character_version ? (
              <Badge size="sm" variant="outline">
                v{character.character_version}
              </Badge>
            ) : null}
            {character.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} size="sm" variant="light">
                {tag}
              </Badge>
            ))}
            {character.tags.length > 4 ? (
              <Badge size="sm" variant="light">
                +{character.tags.length - 4}
              </Badge>
            ) : null}
          </Group>
        </Box>
      </Link>
    </Card>
  );
}
