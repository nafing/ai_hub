import { useEffect, useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import {
  DEFAULT_IMPERSONATE_PROMPT,
  type Chat,
} from "@ai-hub/shared";
import { Select, Switch, Textarea } from "@/components/ui";
import {
  Field,
  SettingsSection,
  type PatchChatSettings,
} from "../shared/chatSettingsUi";
import classes from "./ImpersonateSettings.module.css";

type ImpersonateSettingsProps = {
  chat: Chat;
  presetOptions: { value: string; label: string }[];
  connectionOptions: { value: string; label: string }[];
  patchSettings: PatchChatSettings;
};

export function ImpersonateSettings({
  chat,
  presetOptions,
  connectionOptions,
  patchSettings,
}: ImpersonateSettingsProps) {
  const template = chat.settings.impersonate_prompt_template ?? "";
  const [draft, setDraft] = useState(template);
  const [defaultOpen, setDefaultOpen] = useState(false);
  const hasCustom = template.trim().length > 0;

  useEffect(() => {
    setDraft(template);
  }, [template]);

  function commitTemplate() {
    if (draft === template) return;
    patchSettings({ impersonate_prompt_template: draft });
  }

  return (
    <SettingsSection value="impersonate" label="Impersonate">
      <div className={classes.promptBlock}>
        <div className={classes.promptLabelRow}>
          <span className={classes.promptLabel}>Prompt Template</span>
          <span className={classes.statusChip}>
            {hasCustom ? "Custom" : "Chat/default"}
          </span>
        </div>
        <p className={classes.promptHint}>
          Optional instruction for /impersonate and empty-send. Empty uses the
          built-in default. Macros: {"{{user}}"}, {"{{persona_description}}"},{" "}
          {"{{impersonate_direction}}"}.
        </p>
        <Textarea
          value={draft}
          rows={4}
          placeholder="Empty = use chat/built-in default"
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commitTemplate}
        />
      </div>

      <div className={classes.defaultRow}>
        <button
          type="button"
          className={classes.defaultToggle}
          onClick={() => setDefaultOpen((open) => !open)}
        >
          {defaultOpen ? (
            <IconChevronDown size={12} />
          ) : (
            <IconChevronRight size={12} />
          )}
          Built-in default
        </button>
        {hasCustom ? (
          <button
            type="button"
            className={classes.resetButton}
            onClick={() => {
              setDraft("");
              patchSettings({ impersonate_prompt_template: "" });
            }}
          >
            Reset
          </button>
        ) : null}
      </div>
      {defaultOpen ? (
        <pre className={classes.defaultPreview}>{DEFAULT_IMPERSONATE_PROMPT}</pre>
      ) : null}

      <div className={classes.overridesCard}>
        <div className={classes.overridesGrid}>
          <Field
            label="Preset"
            hint="Preset for impersonate generations only. Empty uses the chat preset."
          >
            <Select
              data={presetOptions}
              value={chat.settings.impersonate_preset_id ?? ""}
              onChange={(value) =>
                patchSettings({ impersonate_preset_id: value || null })
              }
              clearable
              searchable
              placeholder="Use chat default"
            />
          </Field>
          <Field
            label="Connection"
            hint="Connection for impersonate generations only. Empty uses the chat connection."
          >
            <Select
              data={connectionOptions}
              value={chat.settings.impersonate_connection_id ?? ""}
              onChange={(value) =>
                patchSettings({ impersonate_connection_id: value || null })
              }
              clearable
              searchable
              placeholder="Use chat default"
            />
          </Field>
        </div>

        <Switch
          variant="card"
          checked={chat.settings.impersonate_skip_agents}
          onChange={(impersonate_skip_agents) =>
            patchSettings({ impersonate_skip_agents })
          }
          label="Skip agents"
          description="Suppress trackers, routers, and other agent work."
        />
        <Switch
          variant="card"
          checked={chat.settings.impersonate_cyoa_as_direction}
          onChange={(impersonate_cyoa_as_direction) =>
            patchSettings({ impersonate_cyoa_as_direction })
          }
          label="Use CYOA as direction"
          description="Treat choices as impersonate guidance."
        />
      </div>
    </SettingsSection>
  );
}
