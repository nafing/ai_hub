import {
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CHARA_CARD_SPEC,
  CHARA_CARD_SPEC_VERSION,
  DEFAULT_TALKATIVENESS,
  characterTalkativeness,
  normalizeConvoBehaviorInsertion,
  setCharacterTalkativeness,
  type CharacterConvoBehaviorInsertion,
  type CreateCharacterInput,
} from "@ai-hub/shared";
import {
  Select,
  Textarea,
  Tabs,
  TagsInput,
  TextInput,
  Slider,
  RuntimeText,
  Button,
} from "@/components/ui";
import { AlternateGreetingsEditor } from "./AlternateGreetingsEditor";
import { CharacterColorsPanel } from "./CharacterColorsPanel";
import { CharacterConvoPanel } from "./CharacterConvoPanel";
import { CharacterGeneratePanel } from "./CharacterGeneratePanel";
import classes from "./CharacterForm.module.css";

export type CharacterFormValues = CreateCharacterInput;

export type CharacterVersionSelect = {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (versionId: string) => void;
  /** When set, shows a delete control for the selected version. */
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deletePending?: boolean;
};

type CharacterFormProps = {
  formId?: string;
  initialValues: CharacterFormValues;
  onSubmit: (values: CharacterFormValues) => Promise<void> | void;
  /** Avatar controls rendered in the Metadata tab. */
  avatarSection?: ReactNode;
  /** Optional avatar URL for Colors preview / extract. */
  avatarUrl?: string | null;
  /** Gallery images panel rendered in the Gallery tab. */
  gallerySection?: ReactNode;
  /** Linked lorebooks list rendered in the Lorebooks tab. */
  lorebooksSection?: ReactNode;
  /**
   * When set (edit page), Character version is a Select of saved snapshots.
   * Create flow keeps a free-text label.
   */
  versionSelect?: CharacterVersionSelect;
};

type FieldErrors = Partial<Record<"name", string>>;

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={classes.field}>
      <span className={classes.fieldLabel}>
        {label}
        {required ? " *" : ""}
      </span>
      {hint ? <p className={classes.fieldHint}>{hint}</p> : null}
      {children}
      {error ? <p className={classes.fieldError}>{error}</p> : null}
    </div>
  );
}

export function CharacterForm({
  formId = "character-form",
  initialValues,
  onSubmit,
  avatarSection,
  avatarUrl = null,
  gallerySection,
  lorebooksSection,
  versionSelect,
}: CharacterFormProps) {
  const [values, setValues] = useState<CharacterFormValues>(() => ({
    ...initialValues,
    data: {
      ...initialValues.data,
      tags: [...(initialValues.data.tags ?? [])],
      alternate_greetings: [...(initialValues.data.alternate_greetings ?? [])],
      talkativeness: characterTalkativeness({ data: initialValues.data }),
    },
  }));
  const [errors, setErrors] = useState<FieldErrors>({});

  const talkativeness = characterTalkativeness({ data: values.data });

  function setDataField<K extends keyof CharacterFormValues["data"]>(
    key: K,
    value: CharacterFormValues["data"][K],
  ) {
    setValues((current) => ({
      ...current,
      data: { ...current.data, [key]: value },
    }));
    if (key === "name" && errors.name) {
      setErrors((current) => {
        const next = { ...current };
        delete next.name;
        return next;
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = values.data.name.trim();
    if (!name) {
      setErrors({ name: "Name is required" });
      return;
    }

    const { character_book: _omit, ...restData } = values.data;

    void onSubmit({
      spec: CHARA_CARD_SPEC,
      spec_version: CHARA_CARD_SPEC_VERSION,
      data: {
        ...restData,
        name,
        alternate_greetings: restData.alternate_greetings
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
        talkativeness: characterTalkativeness({ data: restData }),
      },
    });
  }

  return (
    <form id={formId} className={classes.form} onSubmit={handleSubmit}>
      <Tabs defaultValue="metadata">
        <Tabs.List>
          <Tabs.Tab value="metadata">Metadata</Tabs.Tab>
          <Tabs.Tab value="card">Card</Tabs.Tab>
          <Tabs.Tab value="convo">Convo</Tabs.Tab>
          <Tabs.Tab value="colors">Colors</Tabs.Tab>
          <Tabs.Tab value="gallery">Gallery</Tabs.Tab>
          <Tabs.Tab value="lorebooks">Lorebooks</Tabs.Tab>
          <Tabs.Tab value="advanced">Advanced</Tabs.Tab>
          <Tabs.Tab value="generate">Generate with AI</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="metadata">
          <div className={classes.stack}>
            {avatarSection}
            <Field
              label="Name"
              hint={
                <>
                  Replaces <RuntimeText>{"{{char}}"}</RuntimeText> in prompts.
                </>
              }
              required
              error={errors.name}
            >
              <TextInput
                error={Boolean(errors.name)}
                value={values.data.name}
                required
                onChange={(event) => setDataField("name", event.target.value)}
              />
            </Field>
            <Field
              label="Creator"
              hint="Author credit — not used in prompts."
            >
              <TextInput
                value={values.data.creator}
                onChange={(event) => setDataField("creator", event.target.value)}
              />
            </Field>
            <Field
              label="Character version"
              hint={
                versionSelect
                  ? "Select a saved version to edit. Save activates it for chats."
                  : "Optional version label for sorting/display."
              }
            >
              {versionSelect ? (
                <div className={classes.versionRow}>
                  <Select
                    data={versionSelect.options}
                    value={versionSelect.value}
                    onChange={versionSelect.onChange}
                    searchable
                  />
                  {versionSelect.onDelete ? (
                    <Button
                      variant="danger"
                      type="button"
                      disabled={
                        versionSelect.deleteDisabled ||
                        versionSelect.deletePending
                      }
                      onClick={versionSelect.onDelete}
                    >
                      {versionSelect.deletePending
                        ? "Deleting…"
                        : "Delete version"}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <TextInput
                  value={values.data.character_version}
                  onChange={(event) =>
                    setDataField("character_version", event.target.value)
                  }
                />
              )}
            </Field>
            <Field
              label="Tags"
              hint="For filtering in the hub — not used in prompts."
            >
              <TagsInput
                placeholder="Add tag"
                value={values.data.tags}
                onChange={(next) => setDataField("tags", next)}
              />
            </Field>
            <Field
              label="Creator notes"
              hint="Shown to users — MUST NOT be injected into prompts."
            >
              <Textarea
                className={classes.textarea}
                value={values.data.creator_notes}
                onChange={(event) =>
                  setDataField("creator_notes", event.target.value)
                }
              />
            </Field>
            <div className={classes.field}>
              <span className={classes.fieldLabel}>Talkativeness</span>
              <p className={classes.fieldHint}>
                How often this character should speak in Smart group chat (0–1).
              </p>
              <div className={classes.sliderWrap}>
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
                    setValues((current) => ({
                      ...current,
                      data: setCharacterTalkativeness(current.data, value),
                    }))
                  }
                />
                <p className={classes.sliderValue}>
                  {talkativeness.toFixed(2)}
                  {talkativeness === DEFAULT_TALKATIVENESS ? " (default)" : ""}
                </p>
              </div>
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="card">
          <div className={classes.stack}>
            <Field
              label="Description"
              hint="Background, role, and durable facts the model should know."
            >
              <Textarea
                className={classes.textarea}
                value={values.data.description}
                onChange={(event) =>
                  setDataField("description", event.target.value)
                }
              />
            </Field>
            <Field
              label="Appearance"
              hint="Physical look and visual presentation (used for image prompts)."
            >
              <Textarea
                className={classes.textarea}
                value={values.data.appearance}
                onChange={(event) =>
                  setDataField("appearance", event.target.value)
                }
              />
            </Field>
            <Field label="Personality">
              <Textarea
                className={classes.textarea}
                value={values.data.personality}
                onChange={(event) =>
                  setDataField("personality", event.target.value)
                }
              />
            </Field>
            <Field label="Scenario">
              <Textarea
                className={classes.textarea}
                value={values.data.scenario}
                onChange={(event) => setDataField("scenario", event.target.value)}
              />
            </Field>
            <Field
              label="First message"
              hint="Opening greeting (first_mes)."
            >
              <Textarea
                className={classes.textarea}
                value={values.data.first_mes}
                onChange={(event) => setDataField("first_mes", event.target.value)}
              />
            </Field>
            <Field
              label="Example messages"
              hint="Dialogue examples (mes_example)."
            >
              <Textarea
                className={classes.textarea}
                value={values.data.mes_example}
                onChange={(event) =>
                  setDataField("mes_example", event.target.value)
                }
              />
            </Field>
            <AlternateGreetingsEditor
              value={values.data.alternate_greetings}
              onChange={(next) => setDataField("alternate_greetings", next)}
            />
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="convo">
          <CharacterConvoPanel
            characterName={values.data.name}
            convoDisplayName={values.data.convo_display_name ?? ""}
            declareConvoNameOnCard={Boolean(
              values.data.declare_convo_name_on_card,
            )}
            aboutMe={values.data.about_me ?? ""}
            convoBehavior={values.data.convo_behavior ?? ""}
            convoBehaviorInsertion={normalizeConvoBehaviorInsertion(
              values.data.convo_behavior_insertion,
            )}
            onConvoDisplayNameChange={(value) =>
              setDataField("convo_display_name", value)
            }
            onDeclareConvoNameOnCardChange={(value) =>
              setDataField("declare_convo_name_on_card", value)
            }
            onAboutMeChange={(value) => setDataField("about_me", value)}
            onConvoBehaviorChange={(value) =>
              setDataField("convo_behavior", value)
            }
            onConvoBehaviorInsertionChange={(value) =>
              setDataField(
                "convo_behavior_insertion",
                value as CharacterConvoBehaviorInsertion,
              )
            }
          />
        </Tabs.Panel>

        <Tabs.Panel value="colors">
          <CharacterColorsPanel
            characterName={values.data.name}
            avatarUrl={avatarUrl}
            nameColor={values.data.name_color ?? null}
            dialogueColor={values.data.dialogue_color ?? null}
            messageBoxColor={values.data.message_box_color ?? null}
            onNameColorChange={(value) => setDataField("name_color", value)}
            onDialogueColorChange={(value) =>
              setDataField("dialogue_color", value)
            }
            onMessageBoxColorChange={(value) =>
              setDataField("message_box_color", value)
            }
          />
        </Tabs.Panel>

        <Tabs.Panel value="gallery">
          {gallerySection ?? (
            <p className={classes.muted}>
              Save the character first to manage gallery images.
            </p>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="lorebooks">
          {lorebooksSection ?? (
            <p className={classes.muted}>No lorebooks panel available.</p>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="advanced">
          <div className={classes.stack}>
            <Field
              label="System prompt"
              hint={
                <>
                  Replaces the global system prompt when non-empty. Supports{" "}
                  <RuntimeText>{"{{original}}"}</RuntimeText>.
                </>
              }
            >
              <Textarea
                className={classes.textarea}
                value={values.data.system_prompt}
                onChange={(event) =>
                  setDataField("system_prompt", event.target.value)
                }
              />
            </Field>
            <Field
              label="Post-history instructions"
              hint={
                <>
                  Replaces UJB/jailbreak when non-empty. Supports{" "}
                  <RuntimeText>{"{{original}}"}</RuntimeText>.
                </>
              }
            >
              <Textarea
                className={classes.textarea}
                value={values.data.post_history_instructions}
                onChange={(event) =>
                  setDataField("post_history_instructions", event.target.value)
                }
              />
            </Field>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="generate">
          <CharacterGeneratePanel
            characterName={values.data.name}
            description={values.data.description}
            appearance={values.data.appearance}
            personality={values.data.personality}
            scenario={values.data.scenario}
            first_mes={values.data.first_mes}
            mes_example={values.data.mes_example}
            alternateGreetings={values.data.alternate_greetings}
            onNameChange={(value) => setDataField("name", value)}
            onDescriptionChange={(value) => setDataField("description", value)}
            onAppearanceChange={(value) => setDataField("appearance", value)}
            onPersonalityChange={(value) => setDataField("personality", value)}
            onScenarioChange={(value) => setDataField("scenario", value)}
            onFirstMesChange={(value) => setDataField("first_mes", value)}
            onMesExampleChange={(value) => setDataField("mes_example", value)}
            onAlternateGreetingsChange={(value) =>
              setDataField("alternate_greetings", value)
            }
          />
        </Tabs.Panel>
      </Tabs>
    </form>
  );
}
