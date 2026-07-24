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
import { RegexForm } from "@/features/regexes/RegexForm";
import {
  useDeleteRegex,
  useRegex,
  useUpdateRegex,
} from "@/features/regexes/queries";

const FORM_ID = "regex-edit-form";

export const Route = createFileRoute("/_app/regexes/$regexId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { regexId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useRegex(regexId);
  const updateMutation = useUpdateRegex();
  const deleteMutation = useDeleteRegex();

  function confirmDelete() {
    modals.openConfirmModal({
      title: "Delete regex",
      children: (
        <Text size="sm">
          Delete <strong>{data?.name || "this regex"}</strong>? This cannot be
          undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(regexId, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Regex script removed.",
              color: "green",
            });
            void navigate({ to: "/regexes" });
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
    return <Text c="red">Regex script not found.</Text>;
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
            <Title order={2}>{data.name || "Edit regex"}</Title>
            <Text c="dimmed">
              Pattern runs when messages pass through chat (display and/or
              prompt).
            </Text>
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
      <RegexForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Regex script updated.",
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
