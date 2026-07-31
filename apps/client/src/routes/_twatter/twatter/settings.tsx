import { createFileRoute } from "@tanstack/react-router";
import { TwatterSubpageHeader } from "@/features/shared/twatter/TwatterSubpageHeader";
import { TwatterRefreshTimeline } from "@/features/shared/twatter/TwatterRefreshTimeline";
import { TwatterSettingsPanel } from "@/features/shared/twatter/TwatterSettingsPanel";
import { PersonaPicker } from "@/features/shared/twatter/ComposePost";
import { useTwatterPersona } from "@/features/shared/twatter/TwatterPersonaContext";
import { useLlmConnections } from "@/features/api-queries/connections/queries";
import { useCharacters } from "@/features/api-queries/characters/queries";
import { usePersonas } from "@/features/api-queries/personas/queries";
import { useTwatterBootstrap } from "@/features/api-queries/twatter/queries";
import classes from "@/features/shared/twatter/TwatterFeed.module.css";

export const Route = createFileRoute("/_twatter/twatter/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: bootstrap } = useTwatterBootstrap();
  const { data: characters } = useCharacters();
  const { data: connections } = useLlmConnections();
  const { data: personas } = usePersonas();
  const { personaId, setPersonaId } = useTwatterPersona();

  return (
    <>
      <TwatterSubpageHeader title="Settings" />
      <div className={`${classes.panel} ${classes.settingsPage}`}>
        <section className={classes.settingsSection}>
          <h3 className={classes.settingsHeading}>Active persona</h3>
          <PersonaPicker
            personas={(personas ?? []).map((persona) => ({
              id: persona.id,
              name: persona.name,
            }))}
            value={personaId}
            onChange={setPersonaId}
          />
        </section>
        <section className={classes.settingsSection}>
          <h3 className={classes.settingsHeading}>Timeline</h3>
          <TwatterRefreshTimeline />
        </section>
        <TwatterSettingsPanel
          bootstrap={bootstrap}
          characters={characters ?? []}
          connections={connections ?? []}
          onClose={() => undefined}
          embedded
        />
      </div>
    </>
  );
}
