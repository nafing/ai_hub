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
import { api } from "@/lib/api";
import { PersonaForm } from "@/features/personas/PersonaForm";
import { personaAvatarSrc } from "@/features/personas/avatar-url";
import { LinkedLorebooksPanel } from "@/features/lorebooks/CharacterLinkedLorebooks";
import {
  useDeletePersona,
  useDeletePersonaAvatar,
  usePersona,
  useUpdatePersona,
  useUploadPersonaAvatar,
} from "@/features/personas/queries";

const FORM_ID = "persona-edit-form";

export const Route = createFileRoute("/_app/personas/$personaId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { personaId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = usePersona(personaId);
  const updateMutation = useUpdatePersona();
  const deleteMutation = useDeletePersona();
  const uploadAvatarMutation = useUploadPersonaAvatar();
  const deleteAvatarMutation = useDeletePersonaAvatar();

  function confirmDelete() {
    modals.openConfirmModal({
      title: "Delete persona",
      children: (
        <Text size="sm">
          Delete <strong>{data?.name || "this persona"}</strong>? This cannot be
          undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(personaId, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Persona removed.",
              color: "green",
            });
            void navigate({ to: "/personas" });
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

  async function handleAvatarUpload(file: File | null) {
    if (!file) return;
    try {
      await uploadAvatarMutation.mutateAsync({ id: personaId, file });
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
      await deleteAvatarMutation.mutateAsync(personaId);
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
    return <Text c="red">Persona not found.</Text>;
  }

  const { id, avatar, ...formValues } = data;
  const avatarSrc = personaAvatarSrc(avatar, String(api.defaults.baseURL));

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
            <Title order={2}>{data.name || "Edit persona"}</Title>
            <Text c="dimmed">Player persona.</Text>
          </div>
          <Group gap="xs" wrap="nowrap">
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

      <PersonaForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        lorebooksSection={
          <LinkedLorebooksPanel
            entityId={id}
            linkField="linked_personas"
            entityLabel="persona"
          />
        }
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
                Stored as PNG on the server. Not part of the persona JSON.
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
              message: "Persona updated.",
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
