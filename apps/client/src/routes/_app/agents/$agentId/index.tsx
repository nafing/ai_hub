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
import { AgentForm } from "@/features/agents/AgentForm";
import {
  useAgent,
  useDeleteAgent,
  useUpdateAgent,
} from "@/features/agents/queries";

const FORM_ID = "agent-edit-form";

export const Route = createFileRoute("/_app/agents/$agentId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { agentId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useAgent(agentId);
  const updateMutation = useUpdateAgent();
  const deleteMutation = useDeleteAgent();

  function confirmDelete() {
    modals.openConfirmModal({
      title: "Delete agent",
      children: (
        <Text size="sm">
          Delete <strong>{data?.name || "this agent"}</strong>? This cannot be
          undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(agentId, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Agent removed.",
              color: "green",
            });
            void navigate({ to: "/agents" });
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
    return <Text c="red">Agent not found.</Text>;
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
            <Title order={2}>{data.name || "Edit agent"}</Title>
            <Text c="dimmed">
              {is_built_in
                ? "Built-in default agent — can be edited, but not deleted or re-slugged."
                : "Prompt, tools, and pipeline settings for this agent."}
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
      <AgentForm
        key={id}
        formId={FORM_ID}
        initialValues={formValues}
        slugLocked={is_built_in}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            notifications.show({
              title: "Saved",
              message: "Agent updated.",
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
