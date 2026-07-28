import { createFileRoute } from "@tanstack/react-router";
import { TwatterFeed } from "@/features/twatter/TwatterFeed";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/twatter/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <h2 className={classes.title}>Twatter</h2>
        <p className={classes.subtitle}>
          Fictional social feed for your roleplay world — like Marinara&apos;s
          Noodle. Post as your persona, invite characters, refresh the timeline
          with AI, and optionally carry activity into chats.
        </p>
      </header>

      <div className={classes.feedWrap}>
        <div className={classes.feedColumn}>
          <TwatterFeed />
        </div>
      </div>
    </div>
  );
}
