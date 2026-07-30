import type { ReactNode } from "react";
import type { ChatSettings } from "@ai-hub/shared";
import { Accordion } from "@/components/ui";
import classes from "./ChatSettingsPanel.module.css";

export type PatchChatSettings = (partial: Partial<ChatSettings>) => void;

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={classes.field}>
      <span className={classes.fieldLabel}>{label}</span>
      {hint ? <p className={classes.fieldHint}>{hint}</p> : null}
      {children}
    </div>
  );
}

export function SettingsSection({
  value,
  label,
  children,
}: {
  value: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Accordion.Item value={value}>
      <Accordion.Control>
        <span className={classes.accordionTitle}>{label}</span>
      </Accordion.Control>
      <Accordion.Panel>
        <div className={classes.sectionStack}>{children}</div>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
