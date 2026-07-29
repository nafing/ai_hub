import { useMemo } from "react";
import {
  DEFAULT_CHAT_LOREBOOK_TOKEN_BUDGET,
  type Chat,
} from "@ai-hub/shared";
import { MultiSelect, NumberInput } from "@/components/ui";
import { useLorebooks } from "@/features/lorebooks/queries";
import {
  Field,
  SettingsSection,
  type PatchChatSettings,
} from "./chatSettingsUi";
import classes from "./ChatLorebooksSettings.module.css";

type ChatLorebooksSettingsProps = {
  chat: Chat;
  patchSettings: PatchChatSettings;
};

export function ChatLorebooksSettings({
  chat,
  patchSettings,
}: ChatLorebooksSettingsProps) {
  const lorebooksQuery = useLorebooks();
  const lorebooks = lorebooksQuery.data ?? [];
  const pinnedIds = chat.settings.lorebook_ids ?? [];
  const budget =
    chat.settings.lorebook_token_budget ?? DEFAULT_CHAT_LOREBOOK_TOKEN_BUDGET;

  const lorebookOptions = useMemo(
    () =>
      lorebooks.map((book) => ({
        value: book.id,
        label: book.name || "Unnamed",
      })),
    [lorebooks],
  );

  const globalActive = useMemo(() => {
    const pinned = new Set(pinnedIds);
    return lorebooks.filter(
      (book) => book.global && book.enabled && !pinned.has(book.id),
    );
  }, [lorebooks, pinnedIds]);

  return (
    <SettingsSection value="lorebooks" label="Lorebooks">
      <Field
        label="Lorebook token budget"
        hint={`Context cap for activated lorebook retrievals in this chat. Default: ${DEFAULT_CHAT_LOREBOOK_TOKEN_BUDGET}. Set to 0 for unlimited.`}
      >
        <NumberInput
          value={budget}
          min={0}
          onChange={(value) => {
            if (typeof value !== "number") return;
            const next = Math.max(0, Math.floor(value));
            if (next !== chat.settings.lorebook_token_budget) {
              patchSettings({ lorebook_token_budget: next });
            }
          }}
        />
      </Field>

      <Field
        label="Chat lorebooks"
        hint="Pinned to this chat only. Global lorebooks still apply separately when enabled."
      >
        <MultiSelect
          data={lorebookOptions}
          value={pinnedIds}
          onChange={(lorebook_ids) => patchSettings({ lorebook_ids })}
          searchable
          clearable
          placeholder="None pinned"
        />
      </Field>

      {globalActive.length > 0 ? (
        <div className={classes.globalBlock}>
          <span className={classes.globalLabel}>Also active from global</span>
          <ul className={classes.globalList}>
            {globalActive.map((book) => (
              <li key={book.id} className={classes.globalItem}>
                {book.name || "Unnamed"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SettingsSection>
  );
}
