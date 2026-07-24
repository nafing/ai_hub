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
import { ToolForm } from "@/features/tools/ToolForm";
import {
  useDeleteTool,
  useTool,
  useUpdateTool,
} from "@/features/tools/queries";

const FORM_ID = "tool-edit-form";

export const Route = createFileRoute("/_app/tools/$toolId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { toolId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useTool(toolId);
  const updateMutation = useUpdateTool();
  const deleteMutation = useDeleteTool();

  function confirmDelete() {
    modals.openConfirmModal({
      title: "Delete tool",
      children: (
        <Text size="sm">
          Delete <strong>{data?.name || "this tool"}</strong>? This cannot be
          undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(toolId, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Tool removed.",
              color: "green",
            });
            void navigate({ to: "/tools" });
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
    return <Text c="red">Tool not found.</Text>;
  }

  const { id, is_built_in, ...formValues } = data;

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
            <Title order={2}>{data.name || "Edit tool"}</Title>
            <Text c="dimmed">
              {is_built_in
                ? "Built-in default tool — can be edited, but not deleted or renamed."
                : "Function definition for LLM tool calling (OpenAI / OpenRouter)."}
            </Text>
          </div>
          <Group gap="xs" wrap="nowrap">
            <Button
              type="submit"
              form={FORM_ID}
              loading={updateMutation.isPending}
            >
              Save
            </Button>
            {!is_built_in ? (
              <Button
                color="red"
                variant="light"
                onClick={confirmDelete}
                loading={deleteMutation.isPending}
              >
                Delete
              </Button>
            ) : null}
          </Group>
        </Group>
      </Box>
      <ToolForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        nameLocked={is_built_in}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Tool updated.",
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
