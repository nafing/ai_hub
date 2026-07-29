import type { CharacterConvoBehaviorInsertion } from "@ai-hub/shared";
import { Checkbox, Select, Textarea, TextInput } from "@/components/ui";
import formClasses from "./CharacterForm.module.css";
import classes from "./CharacterConvoPanel.module.css";

type CharacterConvoPanelProps = {
  characterName: string;
  convoDisplayName: string;
  declareConvoNameOnCard: boolean;
  aboutMe: string;
  convoBehavior: string;
  convoBehaviorInsertion: CharacterConvoBehaviorInsertion;
  onConvoDisplayNameChange: (value: string) => void;
  onDeclareConvoNameOnCardChange: (value: boolean) => void;
  onAboutMeChange: (value: string) => void;
  onConvoBehaviorChange: (value: string) => void;
  onConvoBehaviorInsertionChange: (
    value: CharacterConvoBehaviorInsertion,
  ) => void;
};

const INSERTION_OPTIONS: Array<{
  value: CharacterConvoBehaviorInsertion;
  label: string;
}> = [
  { value: "constant_after_card", label: "Constant — after the card" },
  { value: "constant_before_card", label: "Constant — before the card" },
  { value: "append_to_post_history", label: "Append to post-history" },
  { value: "prepend_to_post_history", label: "Prepend to post-history" },
  { value: "replace_post_history", label: "Replace post-history" },
  {
    value: "marker_only",
    label: "Only where {{convo_behavior}} is placed",
  },
];

export function CharacterConvoPanel({
  characterName,
  convoDisplayName,
  declareConvoNameOnCard,
  aboutMe,
  convoBehavior,
  convoBehaviorInsertion,
  onConvoDisplayNameChange,
  onDeclareConvoNameOnCardChange,
  onAboutMeChange,
  onConvoBehaviorChange,
  onConvoBehaviorInsertionChange,
}: CharacterConvoPanelProps) {
  const displayPlaceholder = characterName.trim() || "Character";

  return (
    <div className={formClasses.stack}>
      <div className={formClasses.field}>
        <span className={formClasses.fieldLabel}>Convo display name</span>
        <p className={formClasses.fieldHint}>
          Alias used in conversation chats for grouping, About Me labels, and
          speaker names. Leave blank to use the character name.
        </p>
        <TextInput
          value={convoDisplayName}
          placeholder={displayPlaceholder}
          onChange={(event) => onConvoDisplayNameChange(event.target.value)}
        />
        <Checkbox
          className={classes.checkbox}
          checked={declareConvoNameOnCard}
          onChange={onDeclareConvoNameOnCardChange}
          label="Declare this name on the card in the prompt"
        />
      </div>

      <div className={formClasses.field}>
        <span className={formClasses.fieldLabel}>About me</span>
        <p className={formClasses.fieldHint}>
          Short bio injected into conversation chats when About Me inject is
          enabled. Can also be updated mid-chat via update_about_me.
        </p>
        <Textarea
          className={formClasses.textarea}
          value={aboutMe}
          placeholder="A line or two, an emoji, a joke, or nothing at all — whatever fits them..."
          onChange={(event) => onAboutMeChange(event.target.value)}
        />
      </div>

      <div className={formClasses.field}>
        <span className={formClasses.fieldLabel}>Convo behavior</span>
        <p className={formClasses.fieldHint}>
          Instructions for how this character should text in conversation mode
          (tone, length, formatting).
        </p>
        <Textarea
          className={formClasses.textarea}
          value={convoBehavior}
          placeholder="e.g. Keep replies short and lowercase; texts like a real person, not a narrator..."
          onChange={(event) => onConvoBehaviorChange(event.target.value)}
        />
        <div className={classes.insertionRow}>
          <span className={classes.insertionLabel}>Insertion</span>
          <Select
            data={INSERTION_OPTIONS}
            value={convoBehaviorInsertion}
            onChange={(value) =>
              onConvoBehaviorInsertionChange(
                (value as CharacterConvoBehaviorInsertion) ||
                  "constant_after_card",
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
