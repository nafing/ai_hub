import { useEffect, useMemo, useState, type ReactNode } from "react";
import { IconSparkles } from "@tabler/icons-react";
import {
  buildPresetPromptContext,
  type PresetVariableValues,
  type Variable,
} from "@ai-hub/shared";
import {
  Button,
  MultiSelect,
  Select,
  Textarea,
  notifications,
} from "@/components/ui";
import { useConnectionSelectOptions } from "@/features/connections/queries";
import { getCharacter } from "@/features/characters/api";
import { useCharacters } from "@/features/characters/queries";
import { useGeneratorJobsStore } from "@/features/generators/generatorJobsStore";
import {
  useDefaultPreset,
  usePreset,
  usePresets,
} from "@/features/presets/queries";
import classes from "./PersonaGeneratePanel.module.css";

type PersonaGeneratePanelProps = {
  personaName: string;
  description: string;
  appearance: string;
  personality: string;
  onDescriptionChange: (value: string) => void;
  onAppearanceChange: (value: string) => void;
  onPersonalityChange: (value: string) => void;
};

type GenerateField = "description" | "appearance" | "personality" | "both";

/** Value injected into `{{target_field}}` when generating all card fields. */
const TARGET_FIELD_BOTH = "description, appearance, and personality";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={classes.field}>
      <span className={classes.fieldLabel}>{label}</span>
      {hint ? <p className={classes.fieldHint}>{hint}</p> : null}
      {children}
      {error ? <p className={classes.fieldError}>{error}</p> : null}
    </div>
  );
}

function targetFieldValue(field: GenerateField): string {
  return field === "both" ? TARGET_FIELD_BOTH : field;
}

function resolvePresetVariables(variables: Variable[]): PresetVariableValues {
  const out: PresetVariableValues = {};
  for (const variable of variables) {
    const name = variable.variable_name.trim();
    if (!name) continue;
    const resolved = (variable.selected ?? [])
      .map((selected) => {
        const match = variable.options.find(
          (option) =>
            option.value === selected ||
            option.id === selected ||
            option.id.endsWith(`:${selected}`),
        );
        return match?.value ?? selected;
      })
      .filter(Boolean);
    if (resolved.length === 0) continue;
    out[name] = variable.multi_select ? resolved : resolved[0]!;
  }
  return out;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function readStringField(
  parsed: Record<string, unknown>,
  field: "description" | "appearance" | "personality",
): string | undefined {
  const value = parsed[field];
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function extractGeneratedFields(
  raw: string,
  field: GenerateField,
): {
  description?: string;
  appearance?: string;
  personality?: string;
} {
  const text = stripCodeFence(raw);
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      if (field === "both") {
        return {
          description: readStringField(record, "description"),
          appearance: readStringField(record, "appearance"),
          personality: readStringField(record, "personality"),
        };
      }
      const value = readStringField(record, field);
      return value ? { [field]: value } : {};
    }
  } catch {
    // fall through — model may have returned plain text
  }
  if (field === "both") return {};
  return { [field]: text };
}

/** Runtime vars for persona_generator placeholders (not markers). */
function buildGeneratorVariables(options: {
  field: GenerateField;
  personaName: string;
  description: string;
  appearance: string;
  personality: string;
  presetVariables: Variable[];
}): PresetVariableValues {
  return {
    ...resolvePresetVariables(options.presetVariables),
    user: options.personaName.trim(),
    target_field: targetFieldValue(options.field),
    existing_description: options.description.trim(),
    existing_appearance: options.appearance.trim(),
    existing_personality: options.personality.trim(),
  };
}

export function PersonaGeneratePanel({
  personaName,
  description,
  appearance,
  personality,
  onDescriptionChange,
  onAppearanceChange,
  onPersonalityChange,
}: PersonaGeneratePanelProps) {
  const connectionsQuery = useConnectionSelectOptions("llm");
  const charactersQuery = useCharacters();
  const presetsQuery = usePresets();
  const defaultPresetQuery = useDefaultPreset("persona_generator");

  const defaultConnectionId = connectionsQuery.defaultId || null;

  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [presetInitialized, setPresetInitialized] = useState(false);
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [brief, setBrief] = useState("");
  const [pendingField, setPendingField] = useState<GenerateField | null>(null);

  useEffect(() => {
    if (presetInitialized) return;
    if (defaultPresetQuery.data?.id) {
      setPresetId(defaultPresetQuery.data.id);
      setPresetInitialized(true);
      return;
    }
    if (defaultPresetQuery.isError || defaultPresetQuery.isSuccess) {
      const fallback = (presetsQuery.data ?? []).find(
        (preset) => preset.category === "persona_generator",
      );
      if (fallback) {
        setPresetId(fallback.id);
        setPresetInitialized(true);
      } else if (presetsQuery.isSuccess || presetsQuery.isError) {
        setPresetInitialized(true);
      }
    }
  }, [
    presetInitialized,
    defaultPresetQuery.data,
    defaultPresetQuery.isError,
    defaultPresetQuery.isSuccess,
    presetsQuery.data,
    presetsQuery.isSuccess,
    presetsQuery.isError,
  ]);

  const resolvedConnectionId = connectionId ?? defaultConnectionId;
  const presetDetailQuery = usePreset(presetId ?? undefined);

  const characterOptions = useMemo(
    () =>
      (charactersQuery.data ?? []).map((character) => ({
        value: character.id,
        label: character.name || character.id,
      })),
    [charactersQuery.data],
  );

  const presetOptions = useMemo(() => {
    const personaPresets = (presetsQuery.data ?? []).filter(
      (preset) => preset.category === "persona_generator",
    );
    const list =
      personaPresets.length > 0 ? personaPresets : (presetsQuery.data ?? []);
    return list.map((preset) => ({
      value: preset.id,
      label: `${preset.name || "untitled"}${preset.is_default ? " (default)" : ""}${preset.category !== "persona_generator" ? ` · ${preset.category}` : ""}`,
    }));
  }, [presetsQuery.data]);

  async function handleGenerate(field: GenerateField) {
    if (!resolvedConnectionId) {
      notifications.show({
        title: "No connection",
        message: "Select a connection first.",
        color: "red",
      });
      return;
    }

    const preset = presetDetailQuery.data;
    if (!presetId || !preset) {
      notifications.show({
        title: "No preset",
        message: "Select a Persona Generator preset first.",
        color: "red",
      });
      return;
    }

    setPendingField(field);
    try {
      const characters = await Promise.all(
        characterIds.map((id) => getCharacter(id)),
      );
      const promptContext = buildPresetPromptContext({
        generatorBrief: brief.trim() || null,
        referenceCharacterList: characters,
        variables: buildGeneratorVariables({
          field,
          personaName,
          description,
          appearance,
          personality,
          presetVariables: preset.variables,
        }),
      });

      const fieldLabels: Record<GenerateField, string> = {
        both: "description, appearance & personality",
        description: "description",
        appearance: "appearance",
        personality: "personality",
      };
      const displayName = personaName.trim() || "persona";

      const result = await useGeneratorJobsStore.getState().runTrackedGenerator({
        category: "persona_generator",
        connectionId: resolvedConnectionId,
        presetId: preset.id,
        variables: promptContext.variables,
        markers: promptContext.markers,
        title: `Generate ${fieldLabels[field]} · ${displayName}`,
      });

      const raw = result.content || result.reply || "";
      const extracted = extractGeneratedFields(raw, field);
      if (field === "both") {
        if (
          !extracted.description &&
          !extracted.appearance &&
          !extracted.personality
        ) {
          throw new Error("Model returned an empty result");
        }
        if (extracted.description) onDescriptionChange(extracted.description);
        if (extracted.appearance) onAppearanceChange(extracted.appearance);
        if (extracted.personality) onPersonalityChange(extracted.personality);
      } else if (field === "description") {
        if (!extracted.description) {
          throw new Error("Model returned an empty result");
        }
        onDescriptionChange(extracted.description);
      } else if (field === "appearance") {
        if (!extracted.appearance) {
          throw new Error("Model returned an empty result");
        }
        onAppearanceChange(extracted.appearance);
      } else {
        if (!extracted.personality) {
          throw new Error("Model returned an empty result");
        }
        onPersonalityChange(extracted.personality);
      }

      const labels: Record<GenerateField, string> = {
        both: "Description, appearance, and personality",
        description: "Description",
        appearance: "Appearance",
        personality: "Personality",
      };
      notifications.show({
        title: "Generated",
        message: `${labels[field]} updated — save the persona to keep it.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Generate failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setPendingField(null);
    }
  }

  const generateDisabled =
    pendingField != null ||
    !resolvedConnectionId ||
    !presetId ||
    presetDetailQuery.isLoading;

  const connectionError = connectionsQuery.isError
    ? "Failed to load connections"
    : !connectionsQuery.isLoading && !connectionsQuery.options.length
      ? "Create a connection first"
      : undefined;

  const presetError = presetsQuery.isError
    ? "Failed to load presets"
    : presetDetailQuery.isError
      ? "Failed to load preset details"
      : !presetsQuery.isLoading && !presetOptions.length
        ? "No presets available"
        : undefined;

  return (
    <div className={classes.stack}>
      <p className={classes.muted}>
        Uses the selected Persona Generator preset. Brief and reference
        characters fill marker sections; target field and existing card values
        are preset variables. Remember to Save after generating.
      </p>

      <div className={`${classes.grid} ${classes.grid2}`}>
        <Field
          label="Connection"
          hint="Defaults to the active connection."
          error={connectionError}
        >
          <Select
            placeholder={
              connectionsQuery.isLoading
                ? "Loading connections…"
                : "Select connection"
            }
            data={connectionsQuery.options}
            value={resolvedConnectionId ?? ""}
            onChange={(value) => setConnectionId(value || null)}
            searchable
            disabled={!connectionsQuery.options.length}
            error={Boolean(connectionError)}
          />
        </Field>
        <Field
          label="Preset"
          hint="Prefer presets in the Persona Generator category."
          error={presetError}
        >
          <Select
            placeholder={
              presetsQuery.isLoading ? "Loading presets…" : "Select preset"
            }
            data={presetOptions}
            value={presetId ?? ""}
            onChange={(value) => setPresetId(value || null)}
            searchable
            disabled={!presetOptions.length}
            error={Boolean(presetError)}
          />
        </Field>
      </div>

      <Field
        label="Reference characters"
        hint="Fills the Reference Characters marker."
        error={
          charactersQuery.isError ? "Failed to load characters" : undefined
        }
      >
        <MultiSelect
          placeholder={
            charactersQuery.isLoading
              ? "Loading characters…"
              : "Select characters"
          }
          clearable
          data={characterOptions}
          value={characterIds}
          onChange={setCharacterIds}
          disabled={!characterOptions.length}
          error={charactersQuery.isError}
        />
      </Field>

      <Field
        label="Generator brief"
        hint="Fills the Generator Brief marker."
      >
        <Textarea
          className={classes.textarea}
          value={brief}
          onChange={(event) => setBrief(event.currentTarget.value)}
          placeholder="e.g. A cautious archivist who knows the selected characters from university, dry humor, soft-spoken…"
        />
      </Field>

      <div className={classes.actionsEnd}>
        <Button
          type="button"
          variant="default"
          size="sm"
          loading={pendingField === "both"}
          disabled={generateDisabled}
          leftSection={<IconSparkles size={14} />}
          onClick={() => void handleGenerate("both")}
        >
          Generate description, appearance & personality
        </Button>
      </div>

      <div className={classes.stackSm}>
        <div className={classes.fieldHeader}>
          <p className={classes.fieldTitle}>Description</p>
          <Button
            type="button"
            variant="default"
            size="sm"
            loading={pendingField === "description"}
            disabled={generateDisabled}
            leftSection={<IconSparkles size={14} />}
            onClick={() => void handleGenerate("description")}
          >
            Generate
          </Button>
        </div>
        <p className={classes.fieldHint}>
          Background / role — same field as Card.
        </p>
        <Textarea
          className={classes.textarea}
          value={description}
          onChange={(event) => onDescriptionChange(event.currentTarget.value)}
        />
      </div>

      <div className={classes.stackSm}>
        <div className={classes.fieldHeader}>
          <p className={classes.fieldTitle}>Appearance</p>
          <Button
            type="button"
            variant="default"
            size="sm"
            loading={pendingField === "appearance"}
            disabled={generateDisabled}
            leftSection={<IconSparkles size={14} />}
            onClick={() => void handleGenerate("appearance")}
          >
            Generate
          </Button>
        </div>
        <p className={classes.fieldHint}>
          Physical look / visual presentation — same field as Card.
        </p>
        <Textarea
          className={classes.textarea}
          value={appearance}
          onChange={(event) => onAppearanceChange(event.currentTarget.value)}
        />
      </div>

      <div className={classes.stackSm}>
        <div className={classes.fieldHeader}>
          <p className={classes.fieldTitle}>Personality</p>
          <Button
            type="button"
            variant="default"
            size="sm"
            loading={pendingField === "personality"}
            disabled={generateDisabled}
            leftSection={<IconSparkles size={14} />}
            onClick={() => void handleGenerate("personality")}
          >
            Generate
          </Button>
        </div>
        <p className={classes.fieldHint}>Traits / voice — same field as Card.</p>
        <Textarea
          className={classes.textarea}
          value={personality}
          onChange={(event) => onPersonalityChange(event.currentTarget.value)}
        />
      </div>
    </div>
  );
}
