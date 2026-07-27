import {
  PRESET_RUNTIME_VARIABLES,
  PRESET_TEMPLATE_MACROS,
  SECTION_KIND_LABELS,
  SECTION_MARKER_KINDS,
  type PresetMacroEntry,
  type Variable,
} from "@ai-hub/shared";
import { Button, Modal, RuntimeText } from "@/components/ui";
import classes from "./PresetMacrosModal.module.css";

type PresetMacrosModalProps = {
  opened: boolean;
  onClose: () => void;
  /** Current preset setup variables — shown as available `{{name}}` macros. */
  variables?: Variable[];
};

function MacroRow({ entry }: { entry: PresetMacroEntry }) {
  const looksLikeMacro = entry.syntax.includes("{{");
  return (
    <li className={classes.row}>
      <p className={classes.syntax}>
        {looksLikeMacro ? (
          <RuntimeText text={entry.syntax} />
        ) : (
          entry.syntax
        )}
      </p>
      <p className={classes.description}>{entry.description}</p>
    </li>
  );
}

function MacroSection({
  title,
  entries,
  empty,
}: {
  title: string;
  entries: readonly PresetMacroEntry[];
  empty?: string;
}) {
  return (
    <section className={classes.section}>
      <h3 className={classes.sectionTitle}>{title}</h3>
      {entries.length === 0 ? (
        <p className={classes.muted}>{empty}</p>
      ) : (
        <ul className={classes.list}>
          {entries.map((entry) => (
            <MacroRow key={entry.syntax} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function PresetMacrosModal({
  opened,
  onClose,
  variables = [],
}: PresetMacrosModalProps) {
  const setupEntries: PresetMacroEntry[] = variables
    .map((variable) => {
      const name = variable.variable_name.trim();
      if (!name) return null;
      return {
        syntax: `{{${name}}}`,
        description:
          variable.question.trim() ||
          `Setup variable from this preset (${variable.presentation}).`,
      } satisfies PresetMacroEntry;
    })
    .filter((entry): entry is PresetMacroEntry => Boolean(entry));

  const markerEntries: PresetMacroEntry[] = SECTION_MARKER_KINDS.map(
    (kind) => ({
      syntax: kind,
      description: `${SECTION_KIND_LABELS[kind]} — add a section of this kind; the hub fills its content at runtime.`,
    }),
  );

  return (
    <Modal opened={opened} onClose={onClose} title="Preset macros" size="lg">
      <div className={classes.stack}>
        <p className={classes.muted}>
          Use these in prompt block content. Template macros are resolved when
          the preset is built into chat / generator messages. Marker sections
          are separate slots filled by the hub (not <RuntimeText text="{{…}}" />{" "}
          text).
        </p>

        <MacroSection title="Template macros" entries={PRESET_TEMPLATE_MACROS} />

        <MacroSection
          title="This preset’s setup variables"
          entries={setupEntries}
          empty="No named setup variables on this preset yet."
        />

        <MacroSection
          title="Common runtime variables"
          entries={PRESET_RUNTIME_VARIABLES}
        />

        <MacroSection title="Marker sections" entries={markerEntries} />

        <div className={classes.actions}>
          <Button variant="default" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
