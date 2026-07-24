import type { ReactNode } from "react";
import {
  Slider,
  Stack,
  Tabs,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import {
  CHARA_CARD_SPEC,
  CHARA_CARD_SPEC_VERSION,
  DEFAULT_TALKATIVENESS,
  characterTalkativeness,
  setCharacterTalkativeness,
  type CreateCharacterInput,
} from "@ai-hub/shared";
import { AlternateGreetingsEditor } from "./AlternateGreetingsEditor";
import { CharacterGeneratePanel } from "./CharacterGeneratePanel";

export type CharacterFormValues = CreateCharacterInput;

type CharacterFormProps = {
  formId?: string;
  initialValues: CharacterFormValues;
  onSubmit: (values: CharacterFormValues) => Promise<void> | void;
  /** Avatar controls rendered in the Metadata tab. */
  avatarSection?: ReactNode;
  /** Linked lorebooks list rendered in the Lorebooks tab. */
  lorebooksSection?: ReactNode;
};

export function CharacterForm({
  formId = "character-form",
  initialValues,
  onSubmit,
  avatarSection,
  lorebooksSection,
}: CharacterFormProps) {
  const form = useForm<CharacterFormValues>({
    mode: "controlled",
    initialValues: {
      ...initialValues,
      data: {
        ...initialValues.data,
        talkativeness: characterTalkativeness({ data: initialValues.data }),
      },
    },
    validate: {
      data: {
        name: isNotEmpty("Name is required"),
      },
    },
  });

  const talkativeness = characterTalkativeness({ data: form.values.data });

  return (
    <form
      id={formId}
      onSubmit={form.onSubmit((values) => {
        const { character_book: _omit, ...restData } = values.data;

        void onSubmit({
          spec: CHARA_CARD_SPEC,
          spec_version: CHARA_CARD_SPEC_VERSION,
          data: {
            ...restData,
            alternate_greetings: restData.alternate_greetings
              .map((item) => item.trim())
              .filter((item) => item.length > 0),
            talkativeness: characterTalkativeness({ data: restData }),
          },
        });
      })}
    >
      <Tabs defaultValue="metadata">
        <Tabs.List>
          <Tabs.Tab value="metadata">Metadata</Tabs.Tab>
          <Tabs.Tab value="card">Card</Tabs.Tab>
          <Tabs.Tab value="lorebooks">Lorebooks</Tabs.Tab>
          <Tabs.Tab value="advanced">Advanced</Tabs.Tab>
          <Tabs.Tab value="generate">Generate with AI</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="metadata" pt="md">
          <Stack gap="md">
            {avatarSection}
            <TextInput
              label="Name"
              description="Replaces `{{char}}` in prompts."
              required
              {...form.getInputProps("data.name")}
            />
            <TextInput
              label="Creator"
              description="Author credit — not used in prompts."
              {...form.getInputProps("data.creator")}
            />
            <TextInput
              label="Character version"
              description="Optional version string for sorting/display."
              {...form.getInputProps("data.character_version")}
            />
            <TagsInput
              label="Tags"
              description="For filtering in the hub — not used in prompts."
              placeholder="Add tag"
              {...form.getInputProps("data.tags")}
            />
            <Textarea
              label="Creator notes"
              description="Shown to users — MUST NOT be injected into prompts."
              autosize
              minRows={3}
              {...form.getInputProps("data.creator_notes")}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="card" pt="md">
          <Stack gap="md">
            <Textarea
              label="Description"
              description="Main character definition / appearance / lore."
              autosize
              minRows={4}
              {...form.getInputProps("data.description")}
            />
            <Textarea
              label="Personality"
              autosize
              minRows={3}
              {...form.getInputProps("data.personality")}
            />
            <Textarea
              label="Scenario"
              autosize
              minRows={3}
              {...form.getInputProps("data.scenario")}
            />
            <div>
              <Text size="sm" fw={500} mb={4}>
                Talkativeness
              </Text>
              <Text size="xs" c="dimmed" mb="xs">
                How often this character should speak in Smart group chat (0–1).
              </Text>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={talkativeness}
                marks={[
                  { value: 0, label: "0" },
                  { value: 0.5, label: "0.5" },
                  { value: 1, label: "1" },
                ]}
                onChange={(value) =>
                  form.setFieldValue(
                    "data",
                    setCharacterTalkativeness(form.values.data, value),
                  )
                }
              />
              <Text size="xs" c="dimmed" mt="sm">
                {talkativeness.toFixed(2)}
                {talkativeness === DEFAULT_TALKATIVENESS ? " (default)" : ""}
              </Text>
            </div>
            <Textarea
              label="First message"
              description="Opening greeting (first_mes)."
              autosize
              minRows={4}
              {...form.getInputProps("data.first_mes")}
            />
            <Textarea
              label="Example messages"
              description="Dialogue examples (mes_example)."
              autosize
              minRows={4}
              {...form.getInputProps("data.mes_example")}
            />
            <AlternateGreetingsEditor
              value={form.values.data.alternate_greetings}
              onChange={(value) =>
                form.setFieldValue("data.alternate_greetings", value)
              }
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

        <Tabs.Panel value="advanced" pt="md">
          <Stack gap="md">
            <Textarea
              label="System prompt"
              description="Replaces the global system prompt when non-empty. Supports {{original}}."
              autosize
              minRows={3}
              {...form.getInputProps("data.system_prompt")}
            />
            <Textarea
              label="Post-history instructions"
              description="Replaces UJB/jailbreak when non-empty. Supports {{original}}."
              autosize
              minRows={3}
              {...form.getInputProps("data.post_history_instructions")}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="generate" pt="md">
          <CharacterGeneratePanel
            characterName={form.values.data.name}
            description={form.values.data.description}
            personality={form.values.data.personality}
            scenario={form.values.data.scenario}
            first_mes={form.values.data.first_mes}
            mes_example={form.values.data.mes_example}
            alternateGreetings={form.values.data.alternate_greetings}
            onNameChange={(value) => form.setFieldValue("data.name", value)}
            onDescriptionChange={(value) =>
              form.setFieldValue("data.description", value)
            }
            onPersonalityChange={(value) =>
              form.setFieldValue("data.personality", value)
            }
            onScenarioChange={(value) =>
              form.setFieldValue("data.scenario", value)
            }
            onFirstMesChange={(value) =>
              form.setFieldValue("data.first_mes", value)
            }
            onMesExampleChange={(value) =>
              form.setFieldValue("data.mes_example", value)
            }
            onAlternateGreetingsChange={(value) =>
              form.setFieldValue("data.alternate_greetings", value)
            }
          />
        </Tabs.Panel>
      </Tabs>
    </form>
  );
}
