import {
  Box,
  Button,
  Center,
  FileButton,
  Group,
  Image,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toCharacterCardV2 } from "@ai-hub/shared";
import { api } from "@/lib/api";
import { CharacterForm } from "@/features/characters/CharacterForm";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
import { CharacterLinkedLorebooks } from "@/features/lorebooks/CharacterLinkedLorebooks";
import {
  useCharacter,
  useDeleteCharacter,
  useDeleteCharacterAvatar,
  useUpdateCharacter,
  useUploadCharacterAvatar,
} from "@/features/characters/queries";

const FORM_ID = "character-edit-form";

export const Route = createFileRoute("/_app/characters/$characterId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { characterId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useCharacter(characterId);
  const updateMutation = useUpdateCharacter();
  const deleteMutation = useDeleteCharacter();
  const uploadAvatarMutation = useUploadCharacterAvatar();
  const deleteAvatarMutation = useDeleteCharacterAvatar();

  function confirmDelete() {
    modals.openConfirmModal({
      title: "Delete character",
      children: (
        <Text size="sm">
          Delete <strong>{data?.data.name || "this character"}</strong>? This
          cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(characterId, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Character removed.",
              color: "green",
            });
            void navigate({ to: "/characters" });
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

  function handleExport() {
    if (!data) return;
    const card = toCharacterCardV2(data);
    const blob = new Blob([JSON.stringify(card, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.data.name || "character"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleAvatarUpload(file: File | null) {
    if (!file) return;
    try {
      await uploadAvatarMutation.mutateAsync({ id: characterId, file });
      notifications.show({
        title: "Avatar updated",
        message: "PNG saved on the server.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Avatar upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  async function handleAvatarRemove() {
    try {
      await deleteAvatarMutation.mutateAsync(characterId);
      notifications.show({
        title: "Avatar removed",
        message: "PNG deleted from the server.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Remove failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (isError || !data) {
    return <Text c="red">Character not found.</Text>;
  }

  const { id, avatar, ...formValues } = data;
  const avatarSrc = characterAvatarSrc(avatar, String(api.defaults.baseURL));

  return (
    <Stack>
      <Box
        pos="sticky"
        top="var(--app-shell-header-offset, 0px)"
        bg="var(--mantine-color-body)"
        style={{ zIndex: "calc(var(--mantine-z-index-app) - 1)" }}
        py="xs"
      >
        <Group justify="space-between" align="start" wrap="nowrap">
          <div>
            <Title order={2}>{data.data.name || "Edit character"}</Title>
            <Text c="dimmed">Metadata, prompt fields, and advanced JSON.</Text>
          </div>
          <Group gap="xs" wrap="nowrap">
            <Button variant="default" onClick={handleExport}>
              Export
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              loading={updateMutation.isPending}
            >
              Save
            </Button>
            <Button
              color="red"
              variant="light"
              onClick={confirmDelete}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </Group>
        </Group>
      </Box>

      <CharacterForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        lorebooksSection={<CharacterLinkedLorebooks characterId={id} />}
        avatarSection={
          <Group align="start" gap="md" wrap="nowrap">
            <Box
              w={120}
              h={120}
              style={{
                flexShrink: 0,
                borderRadius: 8,
                overflow: "hidden",
                background: "var(--mantine-color-default-hover)",
              }}
            >
              {avatarSrc ? (
                <Image src={avatarSrc} alt="" w={120} h={120} fit="cover" />
              ) : (
                <Center h="100%">
                  <Text size="xs" c="dimmed">
                    No avatar
                  </Text>
                </Center>
              )}
            </Box>
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Avatar
              </Text>
              <Text size="xs" c="dimmed">
                Stored as PNG on the server. Not part of the card JSON.
              </Text>
              <Group gap="xs">
                <FileButton
                  onChange={(file) => void handleAvatarUpload(file)}
                  accept="image/png,.png"
                >
                  {(props) => (
                    <Button
                      size="xs"
                      variant="default"
                      loading={uploadAvatarMutation.isPending}
                      {...props}
                    >
                      Upload PNG
                    </Button>
                  )}
                </FileButton>
                {avatar ? (
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    loading={deleteAvatarMutation.isPending}
                    onClick={() => void handleAvatarRemove()}
                  >
                    Remove
                  </Button>
                ) : null}
              </Group>
            </Stack>
          </Group>
        }
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Character updated.",
              color: "green",
            });
          } catch (error) {
            notifications.show({
              title: "Save failed",
              message: error instanceof Error ? error.message : "Unknown error",
              color: "red",
            });
          }
        }}
      />
    </Stack>
  );
}
