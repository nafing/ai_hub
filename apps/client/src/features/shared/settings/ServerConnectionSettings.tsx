import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Button, TextInput } from "@/components/ui";
import {
  clearApiBaseUrl,
  getApiBaseUrl,
  setApiBaseUrl,
} from "@/lib/api";
import classes from "./ServerConnectionSettings.module.css";

export function ServerConnectionSettings() {
  const [value, setValue] = useState(() => getApiBaseUrl());
  const [saved, setSaved] = useState(getApiBaseUrl());

  if (!Capacitor.isNativePlatform()) return null;

  return (
    <div className={classes.panel}>
      <p className={classes.hint}>
        Any LAN host running the AI Hub server. Emulator default is{" "}
        <code>10.0.2.2</code>; on a phone use your PC&apos;s LAN IP.
      </p>
      <TextInput
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        placeholder="http://192.168.1.10:5174/v1/api"
        aria-label="API base URL"
      />
      <div className={classes.actions}>
        <Button
          type="button"
          onClick={() => {
            setApiBaseUrl(value);
            setSaved(value.trim().replace(/\/$/, ""));
          }}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="subtle"
          onClick={() => {
            clearApiBaseUrl();
            const next = getApiBaseUrl();
            setValue(next);
            setSaved(next);
          }}
        >
          Reset
        </Button>
      </div>
      <p className={classes.current}>Active: {saved}</p>
    </div>
  );
}
