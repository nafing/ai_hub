import { Button, notifications } from "@/components/ui";
import { playAppSound } from "@/features/shared/sounds";
import { useTwatterPersona } from "./TwatterPersonaContext";
import { useRefreshTwatterTimeline, useTwatterBootstrap } from "@/features/api-queries/twatter/queries";
import classes from "./TwatterFeed.module.css";

type TwatterRefreshTimelineProps = {
  className?: string;
};

export function TwatterRefreshTimeline({ className }: TwatterRefreshTimelineProps) {
  const { personaId } = useTwatterPersona();
  const { data: bootstrap } = useTwatterBootstrap();
  const refreshMutation = useRefreshTwatterTimeline();

  function handleRefresh() {
    if (!personaId) {
      notifications.show({
        title: "Persona required",
        message: "Choose an active persona before refreshing.",
        color: "yellow",
      });
      return;
    }
    refreshMutation.mutate(
      { persona_id: personaId },
      {
        onSuccess: () => {
          playAppSound("twatter");
          notifications.show({
            title: "Timeline refreshed",
            message: "Twatter timeline refreshed.",
            color: "green",
          });
        },
        onError: (error) => {
          playAppSound("twatter", "error");
          notifications.show({
            title: "Refresh failed",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  }

  return (
    <div className={[classes.refreshTimeline, className].filter(Boolean).join(" ")}>
      <Button
        type="button"
        variant="primary"
        disabled={refreshMutation.isPending}
        onClick={handleRefresh}
      >
        {refreshMutation.isPending ? "Refreshing…" : "Refresh timeline"}
      </Button>
      {bootstrap?.scheduler.last_automatic_refresh_at ? (
        <p className={classes.schedulerHint}>
          Last auto refresh:{" "}
          {new Date(bootstrap.scheduler.last_automatic_refresh_at).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
