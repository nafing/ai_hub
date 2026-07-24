import type { ReactNode } from "react";
import { Stack, Switch, Tabs, Text, TextInput, Textarea } from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import type { CreatePersonaInput } from "@ai-hub/shared";
import { PersonaGeneratePanel } from "./PersonaGeneratePanel";

export type PersonaFormValues = CreatePersonaInput;

type PersonaFormProps = {
  formId?: string;
  initialValues: PersonaFormValues;
  onSubmit: (values: PersonaFormValues) => Promise<void> | void;
  /** Avatar controls rendered in the Metadata tab. */
  avatarSection?: ReactNode;
  /** Linked lorebooks list rendered in the Lorebooks tab. */
  lorebooksSection?: ReactNode;
};

export function PersonaForm({
  formId = "persona-form",
  initialValues,
  onSubmit,
  avatarSection,
  lorebooksSection,
}: PersonaFormProps) {
  const form = useForm<PersonaFormValues>({
    mode: "controlled",
    initialValues,
    validate: {
      name: isNotEmpty("Name is required"),
    },
  });

  return (
    <form
      id={formId}
      onSubmit={form.onSubmit((values) => {
        void onSubmit(values);
      })}
    >
      <Tabs defaultValue="metadata">
        <Tabs.List>
          <Tabs.Tab value="metadata">Metadata</Tabs.Tab>
          <Tabs.Tab value="card">Card</Tabs.Tab>
          <Tabs.Tab value="lorebooks">Lorebooks</Tabs.Tab>
          <Tabs.Tab value="generate">Generate with AI</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="metadata" pt="md">
          <Stack gap="md">
            {avatarSection}
            <TextInput
              label="Name"
              description="Replaces `{{user}}` in prompts."
              required
              {...form.getInputProps("name")}
            />
            <Switch
              label="Default persona"
              description="Used as the active player persona when starting chats. Only one can be default."
              checked={form.values.is_default}
              onChange={(event) =>
                form.setFieldValue("is_default", event.currentTarget.checked)
              }
            />
            <Textarea
              label="Notes"
              description="Private notes — not injected into prompts."
              autosize
              minRows={2}
              {...form.getInputProps("notes")}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="card" pt="md">
          <Stack gap="md">
            <Textarea
              label="Description"
              description="Main persona definition / appearance / background."
              autosize
              minRows={4}
              {...form.getInputProps("description")}
            />
            <Textarea
              label="Personality"
              description="Trait block for the player persona."
              autosize
              minRows={3}
              {...form.getInputProps("personality")}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="lorebooks" pt="md">
          {lorebooksSection ?? (
            <Text size="sm" c="dimmed">
              No lorebooks panel available.
            </Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="generate" pt="md">
          <PersonaGeneratePanel
            personaName={form.values.name}
            description={form.values.description}
            personality={form.values.personality}
            onDescriptionChange={(value) =>
              form.setFieldValue("description", value)
            }
            onPersonalityChange={(value) =>
              form.setFieldValue("personality", value)
            }
          />
        </Tabs.Panel>
      </Tabs>
    </form>
  );
}
