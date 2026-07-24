import {
  Box,
  Button,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toCharacterBook } from "@ai-hub/shared";
import { LorebookForm } from "@/features/lorebooks/LorebookForm";
import {
  useDeleteLorebook,
  useLorebook,
  useUpdateLorebook,
} from "@/features/lorebooks/queries";

const FORM_ID = "lorebook-edit-form";

export const Route = createFileRoute("/_app/lorebooks/$lorebookId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { lorebookId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useLorebook(lorebookId);
  const updateMutation = useUpdateLorebook();
  const deleteMutation = useDeleteLorebook();

  function confirmDelete() {
    modals.openConfirmModal({
      title: "Delete lorebook",
      children: (
        <Text size="sm">
          Delete <strong>{data?.name || "this lorebook"}</strong>? This cannot
          be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(lorebookId, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Lorebook removed.",
              color: "green",
            });
            void navigate({ to: "/lorebooks" });
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
    const book = toCharacterBook(data);
    const blob = new Blob([JSON.stringify(book, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.name || "lorebook"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (isError || !data) {
    return <Text c="red">Lorebook not found.</Text>;
  }

  const { id, ...formValues } = data;

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
            <Title order={2}>{data.name || "Edit lorebook"}</Title>
            <Text c="dimmed">Overview, keyword entries, and extensions.</Text>
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

      <LorebookForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Lorebook updated.",
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
