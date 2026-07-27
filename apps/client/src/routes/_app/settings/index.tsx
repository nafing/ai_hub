import { createFileRoute } from "@tanstack/react-router";
import { ThemeSettings } from "@/features/theme/ThemeSettings";
import classes from "./index.module.css";

export const Route = createFileRoute("/_app/settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <h2 className={classes.title}>Settings</h2>
        <p className={classes.subtitle}>
          Customize appearance and application preferences.
        </p>
      </header>

      <section className={classes.card} data-glass-surface>
        <h3 className={classes.cardTitle}>Theme</h3>
        <ThemeSettings />
      </section>
    </div>
  );
}
