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
import { ConnectionForm } from "@/features/connections/ConnectionForm";
import {
  useConnection,
  useDeleteConnection,
  useUpdateConnection,
} from "@/features/connections/queries";

const FORM_ID = "connection-edit-form";

export const Route = createFileRoute("/_app/connections/$connectionId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { connectionId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useConnection(connectionId);
  const updateMutation = useUpdateConnection();
  const deleteMutation = useDeleteConnection();

  function confirmDelete() {
    modals.openConfirmModal({
      title: "Delete connection",
      children: (
        <Text size="sm">
          Delete <strong>{data?.name || "this connection"}</strong>? This cannot
          be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(connectionId, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Connection removed.",
              color: "green",
            });
            void navigate({ to: "/connections" });
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

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (isError || !data) {
    return <Text c="red">Connection not found.</Text>;
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
        <Stack>
          <div>
            <Title order={2}>{data.name || "Edit connection"}</Title>
            <Text c="dimmed">Update OpenRouter connection settings.</Text>
          </div>
          <Group gap="xs">
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
        </Stack>
      </Box>
      <ConnectionForm
        key={id}
        formId={FORM_ID}
        connectionId={id}
        initialValues={formValues}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Connection updated.",
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
