import { useEffect, useRef, useState } from "react";
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
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  selectedVariableValues,
  type PresetVariableValues,
  type Variable,
} from "@ai-hub/shared";
import {
  PresetForm,
  type PresetFormHandle,
} from "@/features/presets/PresetForm";
import { SetupVariablesModal } from "@/features/presets/SetupVariablesModal";
import {
  useDeletePreset,
  usePreset,
  useUpdatePreset,
} from "@/features/presets/queries";

const FORM_ID = "preset-edit-form";

export const Route = createFileRoute("/_app/presets/$presetId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { presetId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = usePreset(presetId);
  const updateMutation = useUpdatePreset();
  const deleteMutation = useDeletePreset();
  const formRef = useRef<PresetFormHandle>(null);
  const [variablesOpened, { open: openVariables, close: closeVariables }] =
    useDisclosure(false);
  const [modalVariables, setModalVariables] = useState<Variable[]>([]);
  const [variableValues, setVariableValues] = useState<PresetVariableValues>(
    {},
  );

  useEffect(() => {
    if (!data) return;
    setVariableValues(selectedVariableValues(data.variables));
  }, [data]);

  function confirmDelete() {
    modals.openConfirmModal({
      title: "Delete preset",
      children: (
        <Text size="sm">
          Delete <strong>{data?.name || "this preset"}</strong>? This cannot be
          undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteMutation.mutate(presetId, {
          onSuccess: () => {
            notifications.show({
              title: "Deleted",
              message: "Preset removed.",
              color: "green",
            });
            void navigate({ to: "/presets" });
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

  function handleOpenVariables() {
    const values = formRef.current?.getValues();
    setModalVariables(values?.variables ?? data?.variables ?? []);
    openVariables();
  }

  function handleApplyVariables(variables: Variable[]) {
    formRef.current?.setVariables(variables);
    setVariableValues(selectedVariableValues(variables));
    notifications.show({
      title: "Variables applied",
      message: "Prompt preview will use the selected values.",
      color: "green",
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
    return <Text c="red">Preset not found.</Text>;
  }

  const { id, ...formValues } = data;

  return (
    <Stack>
      <SetupVariablesModal
        opened={variablesOpened}
        onClose={closeVariables}
        variables={modalVariables}
        onApply={handleApplyVariables}
      />

      <Box
        pos="sticky"
        top="var(--app-shell-header-offset, 0px)"
        bg="var(--mantine-color-body)"
        style={{ zIndex: "calc(var(--mantine-z-index-app) - 1)" }}
        py="xs"
      >
        <Stack gap="xs">
          <div>
            <Title order={2}>{data.name || "Edit preset"}</Title>
            <Text c="dimmed">Update prompt preset settings.</Text>
          </div>
          <Group gap="xs">
            <Button variant="default" onClick={handleOpenVariables}>
              Setup Variables
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
        </Stack>
      </Box>
      <PresetForm
        key={id}
        ref={formRef}
        formId={FORM_ID}
        presetId={id}
        initialValues={formValues}
        variableValues={variableValues}
        onSubmit={async (values) => {
          try {
            await updateMutation.mutateAsync({ id, input: values });
            setVariableValues(selectedVariableValues(values.variables));
            notifications.show({
              title: "Saved",
              message: "Preset updated.",
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
