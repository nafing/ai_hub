import { useMemo, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import type { ChatSettings } from "@ai-hub/shared";
import { Button, MultiSelect, Switch } from "@/components/ui";
import { CreateToolModal } from "@/features/tools/CreateToolModal";
import { useTools } from "@/features/tools/queries";
import { Field, SettingsSection } from "./chatSettingsUi";
import type { PatchChatSettings } from "./chatSettingsUi";
import classes from "./FunctionCallingSettings.module.css";

type FunctionCallingSettingsProps = {
  settings: Pick<ChatSettings, "enable_tools" | "tool_ids">;
  patchSettings: PatchChatSettings;
};

export function FunctionCallingSettings({
  settings,
  patchSettings,
}: FunctionCallingSettingsProps) {
  const toolsQuery = useTools();
  const [createOpen, setCreateOpen] = useState(false);

  const toolOptions = useMemo(
    () =>
      (toolsQuery.data ?? []).map((tool) => ({
        value: tool.id,
        label: tool.name,
      })),
    [toolsQuery.data],
  );

  function handleCreatedTool(toolId: string) {
    const next = settings.tool_ids.includes(toolId)
      ? settings.tool_ids
      : [...settings.tool_ids, toolId];
    patchSettings({
      enable_tools: true,
      tool_ids: next,
    });
  }

  return (
    <SettingsSection value="tools" label="Function Calling">
      <Switch
        variant="card"
        checked={settings.enable_tools}
        onChange={(enable_tools) => patchSettings({ enable_tools })}
        label="Enable Tool Use"
        description="Allow AI to call functions (dice rolls, game state, etc.)"
      />

      {settings.enable_tools ? (
        <>
          <Field
            label="Tools for this chat"
            hint={
              settings.tool_ids.length === 0
                ? "Leave empty to use all globally enabled tools. Select tools below to restrict this chat to a specific set."
                : "Only the selected tools are available in this chat. Clear the selection to use all globally enabled tools."
            }
          >
            <MultiSelect
              data={toolOptions}
              value={settings.tool_ids}
              onChange={(tool_ids) => patchSettings({ tool_ids })}
              searchable
              clearable
              placeholder="All globally enabled tools"
            />
          </Field>

          <div className={classes.actions}>
            <Button
              type="button"
              variant="default"
              size="sm"
              leftSection={<IconPlus size={14} />}
              onClick={() => setCreateOpen(true)}
            >
              New custom function
            </Button>
          </div>
        </>
      ) : (
        <p className={classes.hint}>
          Tool use is off — no functions will be available in this chat.
        </p>
      )}

      <CreateToolModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(tool) => handleCreatedTool(tool.id)}
      />
    </SettingsSection>
  );
}
