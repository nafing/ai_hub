import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CHAT_PARAMETER_SEND,
  defaultConnection,
  normalizeChatGenerationParameters,
  resolveEffectiveChatGenerationParameters,
  type Chat,
  type ChatGenerationParameterSendKey,
  type ChatGenerationParameters,
  type Connection,
} from "@ai-hub/shared";
import { NumberInput, Select, Switch, Textarea } from "@/components/ui";
import {
  useConnection,
  useDefaultConnection,
} from "@/features/api-queries/connections/queries";
import { Field, type PatchChatSettings } from "./chatSettingsUi";
import classes from "./AdvancedParametersFields.module.css";

const REASONING_CHIPS = ["none", "low", "medium", "high", "xhigh", "maximum"] as const;
const VERBOSITY_CHIPS = ["none", "low", "medium", "high"] as const;
const SERVICE_CHIPS = [
  { value: "", label: "Default" },
  { value: "flex", label: "Flex" },
  { value: "priority", label: "Priority" },
] as const;

type AdvancedParametersFieldsProps = {
  chat: Chat;
  connectionOptions: { value: string; label: string }[];
  patchSettings: PatchChatSettings;
};

function ParamNumber({
  label,
  hint,
  value,
  sendEnabled,
  onSendChange,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  hint: string;
  value: number;
  sendEnabled: boolean;
  onSendChange: (enabled: boolean) => void;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className={classes.paramCard}>
      <div className={classes.paramHeader}>
        <span className={classes.paramLabel} title={hint}>
          {label}
        </span>
        <label className={classes.sendToggle}>
          <input
            type="checkbox"
            checked={sendEnabled}
            onChange={(event) => onSendChange(event.currentTarget.checked)}
            aria-label={`Send ${label}`}
          />
          <span>Send</span>
        </label>
      </div>
      <NumberInput
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(next) => {
          if (typeof next === "number") onChange(next);
        }}
      />
    </div>
  );
}

function ChoiceChips({
  label,
  hint,
  value,
  options,
  sendEnabled,
  onSendChange,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  sendEnabled?: boolean;
  onSendChange?: (enabled: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className={classes.choiceBlock}>
      <div className={classes.paramHeader}>
        <span className={classes.paramLabel} title={hint}>
          {label}
        </span>
        {onSendChange ? (
          <label className={classes.sendToggle}>
            <input
              type="checkbox"
              checked={sendEnabled !== false}
              onChange={(event) => onSendChange(event.currentTarget.checked)}
              aria-label={`Send ${label}`}
            />
            <span>Send</span>
          </label>
        ) : null}
      </div>
      <div className={classes.chips}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value || "default"}
              type="button"
              className={active ? classes.chipActive : classes.chip}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function resolveBaselineConnection(
  chatConnection: Connection | undefined,
  defaultConnectionRow: Connection | undefined,
): Connection {
  return (
    chatConnection ??
    defaultConnectionRow ??
    ({ id: "", ...defaultConnection() } as Connection)
  );
}

export function AdvancedParametersFields({
  chat,
  connectionOptions,
  patchSettings,
}: AdvancedParametersFieldsProps) {
  const connectionId = chat.settings.connection_id ?? undefined;
  const chatConnectionQuery = useConnection(connectionId);
  const defaultConnectionQuery = useDefaultConnection(
    connectionId ? undefined : "llm",
  );
  const baseline = resolveBaselineConnection(
    chatConnectionQuery.data,
    defaultConnectionQuery.data,
  );

  const effective = useMemo(
    () =>
      resolveEffectiveChatGenerationParameters(
        baseline,
        chat.settings.chat_parameters,
      ),
    [baseline, chat.settings.chat_parameters],
  );

  const [customDraft, setCustomDraft] = useState(() =>
    JSON.stringify(effective.custom_parameters ?? {}, null, 2),
  );
  const [customError, setCustomError] = useState<string | null>(null);
  const [thinkingDraft, setThinkingDraft] = useState(effective.thinking_tag);
  const [prefillDraft, setPrefillDraft] = useState(effective.assistant_prefill);

  useEffect(() => {
    setCustomDraft(JSON.stringify(effective.custom_parameters ?? {}, null, 2));
    setCustomError(null);
  }, [effective.custom_parameters]);

  useEffect(() => {
    setThinkingDraft(effective.thinking_tag);
  }, [effective.thinking_tag]);

  useEffect(() => {
    setPrefillDraft(effective.assistant_prefill);
  }, [effective.assistant_prefill]);

  function patchParams(partial: ChatGenerationParameters) {
    const current = normalizeChatGenerationParameters(
      chat.settings.chat_parameters,
    );
    const next: ChatGenerationParameters = {
      ...current,
      ...partial,
      enabled_parameters: {
        ...DEFAULT_CHAT_PARAMETER_SEND,
        ...current.enabled_parameters,
        ...partial.enabled_parameters,
      },
      custom_parameters:
        partial.custom_parameters ?? current.custom_parameters,
    };
    // Persist effective numeric/string values so generation doesn't depend on
    // connection changing underneath an already-edited chat.
    for (const key of [
      "temperature",
      "max_completion_tokens",
      "top_p",
      "top_k",
      "frequency_penalty",
      "presence_penalty",
      "assistant_prefill",
      "thinking_tag",
      "service_tier",
      "reasoning_effort",
      "verbosity",
    ] as const) {
      if (next[key] === undefined) {
        (next as Record<string, unknown>)[key] = effective[key];
      }
    }
    if (!next.custom_parameters) {
      next.custom_parameters = effective.custom_parameters;
    }
    patchSettings({ chat_parameters: next });
  }

  function setSend(key: ChatGenerationParameterSendKey, enabled: boolean) {
    patchParams({
      enabled_parameters: { [key]: enabled },
    });
  }

  function commitCustom() {
    try {
      const parsed = JSON.parse(customDraft || "{}") as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setCustomError("Must be a JSON object.");
        return;
      }
      setCustomError(null);
      patchParams({ custom_parameters: parsed as Record<string, unknown> });
    } catch {
      setCustomError("Invalid JSON.");
    }
  }

  return (
    <>
      <div className={classes.paramGrid}>
        <ParamNumber
          label="Temperature"
          hint="Controls randomness. Lower = focused; higher = creative."
          value={effective.temperature}
          sendEnabled={effective.enabled_parameters.temperature}
          onSendChange={(enabled) => setSend("temperature", enabled)}
          onChange={(temperature) => patchParams({ temperature })}
          min={0}
          max={2}
          step={0.05}
        />
        <ParamNumber
          label="Max Output Tokens"
          hint="Maximum tokens the model can generate in one response."
          value={effective.max_completion_tokens}
          sendEnabled={effective.enabled_parameters.max_completion_tokens}
          onSendChange={(enabled) => setSend("max_completion_tokens", enabled)}
          onChange={(max_completion_tokens) =>
            patchParams({ max_completion_tokens })
          }
          min={1}
          step={256}
        />
        <ParamNumber
          label="Top P"
          hint="Nucleus sampling threshold. Lower = more focused."
          value={effective.top_p}
          sendEnabled={effective.enabled_parameters.top_p}
          onSendChange={(enabled) => setSend("top_p", enabled)}
          onChange={(top_p) => patchParams({ top_p })}
          min={0}
          max={1}
          step={0.05}
        />
        <ParamNumber
          label="Top K"
          hint="Only consider the top K tokens. 0 disables."
          value={effective.top_k}
          sendEnabled={effective.enabled_parameters.top_k}
          onSendChange={(enabled) => setSend("top_k", enabled)}
          onChange={(top_k) => patchParams({ top_k })}
          min={0}
          max={500}
          step={1}
        />
        <ParamNumber
          label="Frequency"
          hint="Penalty for repeated tokens (−2…2)."
          value={effective.frequency_penalty}
          sendEnabled={effective.enabled_parameters.frequency_penalty}
          onSendChange={(enabled) => setSend("frequency_penalty", enabled)}
          onChange={(frequency_penalty) => patchParams({ frequency_penalty })}
          min={-2}
          max={2}
          step={0.05}
        />
        <ParamNumber
          label="Presence"
          hint="Penalty for tokens that already appeared (−2…2)."
          value={effective.presence_penalty}
          sendEnabled={effective.enabled_parameters.presence_penalty}
          onSendChange={(enabled) => setSend("presence_penalty", enabled)}
          onChange={(presence_penalty) => patchParams({ presence_penalty })}
          min={-2}
          max={2}
          step={0.05}
        />
      </div>

      <Field
        label="Assistant Prefill"
        hint="Optional assistant-role text appended after the final user message."
      >
        <Textarea
          value={prefillDraft}
          rows={2}
          onChange={(event) => setPrefillDraft(event.currentTarget.value)}
          onBlur={() => {
            if (prefillDraft !== effective.assistant_prefill) {
              patchParams({ assistant_prefill: prefillDraft });
            }
          }}
          placeholder="<thinking>"
        />
      </Field>

      <Field
        label="Thinking Tags"
        hint="One wrapper per line. {{thinking}} is replaced by content between the tags."
      >
        <Textarea
          value={thinkingDraft}
          rows={2}
          onChange={(event) => setThinkingDraft(event.currentTarget.value)}
          onBlur={() => {
            if (thinkingDraft !== effective.thinking_tag) {
              patchParams({ thinking_tag: thinkingDraft });
            }
          }}
          placeholder={"<thinking>{{thinking}}</thinking>"}
        />
      </Field>

      <Field
        label="Custom Parameters"
        hint="Accepts strings, numbers, booleans, null, arrays, and nested objects."
      >
        <Textarea
          value={customDraft}
          rows={3}
          onChange={(event) => {
            setCustomDraft(event.currentTarget.value);
            setCustomError(null);
          }}
          onBlur={commitCustom}
          placeholder='{ "reasoning_effort": "high" }'
        />
        {customError ? <p className={classes.error}>{customError}</p> : null}
      </Field>

      <ChoiceChips
        label="OpenRouter Service Tier"
        hint="Default omits service_tier. Flex can be cheaper/slower; Priority faster/costlier."
        value={
          effective.service_tier === "default" ? "" : effective.service_tier
        }
        options={SERVICE_CHIPS.map((item) => ({
          value: item.value,
          label: item.label,
        }))}
        onChange={(service_tier) => patchParams({ service_tier })}
      />

      <ChoiceChips
        label="Reasoning Effort"
        hint="How much reasoning work the provider should spend before responding."
        value={effective.reasoning_effort || "none"}
        options={REASONING_CHIPS.map((value) => ({
          value,
          label: value === "none" ? "None" : value.charAt(0).toUpperCase() + value.slice(1),
        }))}
        sendEnabled={effective.enabled_parameters.reasoning_effort}
        onSendChange={(enabled) => setSend("reasoning_effort", enabled)}
        onChange={(reasoning_effort) =>
          patchParams({
            reasoning_effort: reasoning_effort === "none" ? "none" : reasoning_effort,
          })
        }
      />

      <ChoiceChips
        label="Verbosity"
        hint="Controls how long and detailed responses should be."
        value={effective.verbosity || "none"}
        options={VERBOSITY_CHIPS.map((value) => ({
          value,
          label: value === "none" ? "None" : value.charAt(0).toUpperCase() + value.slice(1),
        }))}
        sendEnabled={effective.enabled_parameters.verbosity}
        onSendChange={(enabled) => setSend("verbosity", enabled)}
        onChange={(verbosity) =>
          patchParams({
            verbosity: verbosity === "none" ? "none" : verbosity,
          })
        }
      />

      <Switch
        variant="card"
        checked={chat.settings.context_message_limit != null}
        onChange={(checked) =>
          patchSettings({
            context_message_limit: checked
              ? (chat.settings.context_message_limit ??
                chat.settings.history_depth ??
                50)
              : null,
          })
        }
        label="Limit Context Messages"
        description="Only send the last N messages to the model."
      />
      {chat.settings.context_message_limit != null ? (
        <Field label="Context message limit">
          <NumberInput
            value={chat.settings.context_message_limit}
            min={1}
            max={9999}
            onChange={(value) => {
              if (typeof value === "number") {
                patchSettings({ context_message_limit: value });
              }
            }}
          />
        </Field>
      ) : null}
      <Switch
        variant="card"
        checked={chat.settings.exclude_past_reasoning !== false}
        onChange={(exclude_past_reasoning) =>
          patchSettings({ exclude_past_reasoning })
        }
        label="Exclude Past Reasoning"
        description="Keep stored thinking/reasoning metadata out of future prompts."
      />
      <Switch
        variant="card"
        checked={chat.settings.image_captioning_enabled}
        onChange={(image_captioning_enabled) =>
          patchSettings({ image_captioning_enabled })
        }
        label="Image Captioning"
        description="Describe image attachments with a selected connection instead of sending native images. Text-only endpoints may fail."
      />
      {chat.settings.image_captioning_enabled ? (
        <Field
          label="Captioning connection"
          hint="Empty uses the chat connection."
        >
          <Select
            data={connectionOptions}
            value={chat.settings.image_captioning_connection_id ?? ""}
            onChange={(value) =>
              patchSettings({
                image_captioning_connection_id: value || null,
              })
            }
            clearable
            searchable
            placeholder="Use chat connection"
          />
        </Field>
      ) : null}
    </>
  );
}
