import type { CharacterListItem, ConnectionListItem, TwatterBootstrap } from "@ai-hub/shared";
import { Button, Select, Switch } from "@/components/ui";
import { usePresets } from "@/features/presets/queries";
import {
  useInviteTwatterCharacter,
  useResetTwatterTimeline,
  useUninviteTwatterCharacter,
  useUpdateTwatterSettings,
} from "./queries";
import classes from "./TwatterFeed.module.css";

type TwatterSettingsPanelProps = {
  bootstrap: TwatterBootstrap | undefined;
  characters: CharacterListItem[];
  connections: ConnectionListItem[];
  onClose: () => void;
};

export function TwatterSettingsPanel({
  bootstrap,
  characters,
  connections,
  onClose,
}: TwatterSettingsPanelProps) {
  const settings = bootstrap?.settings;
  const updateSettings = useUpdateTwatterSettings();
  const { data: presets } = usePresets();
  const inviteMutation = useInviteTwatterCharacter();
  const uninviteMutation = useUninviteTwatterCharacter();
  const resetMutation = useResetTwatterTimeline();

  const invitedIds = new Set(settings?.invited_character_ids ?? []);
  const uninvitedCharacters = characters.filter(
    (character) => !invitedIds.has(character.id),
  );

  const twatterPresets = (presets ?? []).filter(
    (preset) => preset.category === "twatter_refresh",
  );

  if (!settings) {
    return <p className={classes.status}>Loading settings…</p>;
  }

  return (
    <div className={classes.settingsPanel}>
      <section className={classes.settingsSection}>
        <h3 className={classes.settingsHeading}>Generation</h3>
        <Select
          data={connections.map((connection) => ({
            value: connection.id,
            label: connection.name,
          }))}
          value={settings.generation_connection_id ?? ""}
          onChange={(value) =>
            updateSettings.mutate({
              generation_connection_id: value || null,
            })
          }
          placeholder="Generation connection"
          clearable
        />
        <Select
          data={twatterPresets.map((preset) => ({
            value: preset.id,
            label: `${preset.name}${preset.is_default ? " (default)" : ""}`,
          }))}
          value={settings.refresh_preset_id ?? ""}
          onChange={(value) =>
            updateSettings.mutate({
              refresh_preset_id: value || null,
            })
          }
          placeholder="Refresh preset (default Twatter Refresh)"
          clearable
        />
      </section>

      <section className={classes.settingsSection}>
        <h3 className={classes.settingsHeading}>Auto refresh</h3>
        <label className={classes.settingsField}>
          Refreshes per day (0 = off)
          <input
            type="number"
            min={0}
            max={24}
            value={settings.refreshes_per_day}
            onChange={(event) =>
              updateSettings.mutate({
                refreshes_per_day: Number(event.target.value),
              })
            }
          />
        </label>
        {bootstrap?.scheduler ? (
          <p className={classes.schedulerStatus}>
            Scheduler: {bootstrap.scheduler.state}
            {bootstrap.scheduler.next_refresh_at
              ? ` · next ${new Date(bootstrap.scheduler.next_refresh_at).toLocaleString()}`
              : ""}
            {bootstrap.scheduler.last_error
              ? ` · last error: ${bootstrap.scheduler.last_error}`
              : ""}
          </p>
        ) : null}
      </section>

      <section className={classes.settingsSection}>
        <h3 className={classes.settingsHeading}>Refresh limits</h3>
        <div className={classes.settingsGrid}>
          <label className={classes.settingsField}>
            Posts / refresh
            <input
              type="number"
              min={0}
              max={100}
              value={settings.max_generated_posts_per_refresh}
              onChange={(event) =>
                updateSettings.mutate({
                  max_generated_posts_per_refresh: Number(event.target.value),
                })
              }
            />
          </label>
          <label className={classes.settingsField}>
            Replies / refresh
            <input
              type="number"
              min={0}
              max={200}
              value={settings.max_replies_per_refresh}
              onChange={(event) =>
                updateSettings.mutate({
                  max_replies_per_refresh: Number(event.target.value),
                })
              }
            />
          </label>
        </div>
      </section>

      <section className={classes.settingsSection}>
        <h3 className={classes.settingsHeading}>Carryover to chats</h3>
        <Switch
          label="Conversation chats"
          checked={settings.carryover_modes.includes("conversation")}
          onChange={(checked) => {
            const modes = new Set(settings.carryover_modes);
            if (checked) modes.add("conversation");
            else modes.delete("conversation");
            updateSettings.mutate({ carryover_modes: [...modes] });
          }}
        />
        <Switch
          label="Roleplay chats"
          checked={settings.carryover_modes.includes("roleplay")}
          onChange={(checked) => {
            const modes = new Set(settings.carryover_modes);
            if (checked) modes.add("roleplay");
            else modes.delete("roleplay");
            updateSettings.mutate({ carryover_modes: [...modes] });
          }}
        />
      </section>

      <section className={classes.settingsSection}>
        <h3 className={classes.settingsHeading}>Participants</h3>
        <Switch
          label="Allow random users"
          checked={settings.allow_random_users}
          onChange={(allow_random_users) =>
            updateSettings.mutate({ allow_random_users })
          }
        />
        {uninvitedCharacters.length > 0 ? (
          <Select
            data={uninvitedCharacters.map((character) => ({
              value: character.id,
              label: character.name || "Untitled character",
            }))}
            value=""
            onChange={(characterId) => inviteMutation.mutate(characterId)}
            placeholder="Invite character"
          />
        ) : null}
        <div className={classes.invitedList}>
          {characters
            .filter((character) => invitedIds.has(character.id))
            .map((character) => (
              <div key={character.id} className={classes.invitedRow}>
                <span>{character.name || "Untitled character"}</span>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => uninviteMutation.mutate(character.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
        </div>
      </section>

      <section className={classes.settingsSection}>
        <h3 className={classes.settingsHeading}>Danger zone</h3>
        <Button
          type="button"
          variant="dangerSolid"
          disabled={resetMutation.isPending}
          onClick={() => resetMutation.mutate()}
        >
          Reset timeline
        </Button>
      </section>

      <div className={classes.settingsFooter}>
        <Button type="button" variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
