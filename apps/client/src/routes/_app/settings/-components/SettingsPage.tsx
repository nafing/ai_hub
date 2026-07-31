import { Capacitor } from "@capacitor/core";
import { ThemeSettings } from "@/features/shared/theme/ThemeSettings";
import { SoundSettings } from "@/features/shared/sounds";
import { TextFormatsSettings } from "@/features/shared/chats/shared";
import { ServerConnectionSettings } from "@/features/shared/settings/ServerConnectionSettings";
import classes from "./SettingsPage.module.css";

export function SettingsPage() {
  const showServer = Capacitor.isNativePlatform();

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <h2 className={classes.title}>Settings</h2>
        <p className={classes.subtitle}>
          Customize appearance and application preferences.
        </p>
      </header>

      {showServer ? (
        <section className={classes.card} data-glass-surface>
          <h3 className={classes.cardTitle}>Server</h3>
          <ServerConnectionSettings />
        </section>
      ) : null}

      <section className={classes.card} data-glass-surface>
        <h3 className={classes.cardTitle}>Sounds</h3>
        <SoundSettings />
      </section>

      <section className={classes.card} data-glass-surface>
        <h3 className={classes.cardTitle}>Text formats</h3>
        <TextFormatsSettings />
      </section>

      <section className={classes.card} data-glass-surface>
        <h3 className={classes.cardTitle}>Theme</h3>
        <ThemeSettings />
      </section>
    </div>
  );
}
