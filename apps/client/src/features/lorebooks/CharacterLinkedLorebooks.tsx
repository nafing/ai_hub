import { useMemo, useState, type ReactNode } from "react";
import { IconLinkOff } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
  LOREBOOK_CATEGORY_LABELS,
  type LorebookListItem,
  type UpdateLorebookInput,
} from "@ai-hub/shared";
import { ActionIcon, Button, Select, notifications } from "@/components/ui";
import { useLorebooks, useUpdateLorebook } from "./queries";
import classes from "./CharacterLinkedLorebooks.module.css";

type LinkedLorebooksPanelProps = {
  /** Entity id stored in lorebook `linked_characters` or `linked_personas`. */
  entityId: string;
  linkField: "linked_characters" | "linked_personas";
  entityLabel: "character" | "persona";
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={classes.field}>
      <span className={classes.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

export function LinkedLorebooksPanel({
  entityId,
  linkField,
  entityLabel,
}: LinkedLorebooksPanelProps) {
  const { data, isLoading, isError } = useLorebooks();
  const updateMutation = useUpdateLorebook();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedToLink, setSelectedToLink] = useState<string | null>(null);

  const lorebooks = data ?? [];

  const { linked, unlinkedOptions } = useMemo(() => {
    const linkedList: LorebookListItem[] = [];
    const options: { value: string; label: string }[] = [];
    for (const lorebook of lorebooks) {
      if (lorebook[linkField].includes(entityId)) {
        linkedList.push(lorebook);
      } else {
        options.push({
          value: lorebook.id,
          label: lorebook.name || lorebook.id,
        });
      }
    }
    return { linked: linkedList, unlinkedOptions: options };
  }, [lorebooks, entityId, linkField]);

  async function setLinked(
    lorebook: LorebookListItem,
    shouldLink: boolean,
  ): Promise<void> {
    const current = lorebook[linkField];
    const next = shouldLink
      ? current.includes(entityId)
        ? current
        : [...current, entityId]
      : current.filter((id) => id !== entityId);

    const input: UpdateLorebookInput = { [linkField]: next };

    setPendingId(lorebook.id);
    try {
      await updateMutation.mutateAsync({
        id: lorebook.id,
        input,
      });
      notifications.show({
        title: shouldLink ? "Linked" : "Unlinked",
        message: shouldLink
          ? `${lorebook.name || "Lorebook"} linked to this ${entityLabel}.`
          : `${lorebook.name || "Lorebook"} unlinked from this ${entityLabel}.`,
        color: "green",
      });
      if (shouldLink) {
        setSelectedToLink(null);
      }
    } catch (error) {
      notifications.show({
        title: shouldLink ? "Link failed" : "Unlink failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setPendingId(null);
    }
  }

  async function handleLink() {
    if (!selectedToLink) return;
    const lorebook = lorebooks.find((item) => item.id === selectedToLink);
    if (!lorebook) return;
    await setLinked(lorebook, true);
  }

  if (isLoading) {
    return (
      <div className={classes.loadingWrap}>
        <span className={classes.spinner} aria-label="Loading lorebooks" />
      </div>
    );
  }

  if (isError) {
    return <p className={classes.error}>Failed to load lorebooks.</p>;
  }

  return (
    <div className={classes.stack}>
      <p className={classes.muted}>
        Link hub lorebooks to this {entityLabel} via{" "}
        <code className={classes.inlineCode}>{linkField}</code>.
      </p>

      <div className={classes.linkRow}>
        <div className={classes.linkField}>
          <Field label="Link lorebook">
            <Select
              placeholder={
                unlinkedOptions.length > 0
                  ? "Select a lorebook"
                  : lorebooks.length === 0
                    ? "No lorebooks yet"
                    : "All lorebooks are linked"
              }
              searchable
              clearable
              data={unlinkedOptions}
              value={selectedToLink ?? ""}
              onChange={(value) => setSelectedToLink(value || null)}
              disabled={unlinkedOptions.length === 0 || pendingId != null}
            />
          </Field>
        </div>
        <Button variant="default" type="button"
          onClick={() => void handleLink()}
          disabled={!selectedToLink || pendingId != null}
        >
          {pendingId != null && pendingId === selectedToLink ? (
            <span className={classes.spinner} aria-hidden />
          ) : null}
          Link
        </Button>
      </div>

      {linked.length === 0 ? (
        <p className={classes.muted}>No lorebooks linked yet.</p>
      ) : (
        <div className={classes.list}>
          {linked.map((lorebook) => (
            <LinkedLorebookRow
              key={lorebook.id}
              lorebook={lorebook}
              unlinking={pendingId === lorebook.id}
              disabled={pendingId != null}
              onUnlink={() => void setLinked(lorebook, false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinkedLorebookRow({
  lorebook,
  unlinking,
  disabled,
  onUnlink,
}: {
  lorebook: LorebookListItem;
  unlinking: boolean;
  disabled: boolean;
  onUnlink: () => void;
}) {
  return (
    <article className={classes.card}>
      <div className={classes.cardBody}>
        <div className={classes.cardTop}>
          <Link
            to="/lorebooks/$lorebookId"
            params={{ lorebookId: lorebook.id }}
            className={classes.cardLink}
          >
            <h3 className={classes.cardName}>{lorebook.name || "untitled"}</h3>
            <p className={classes.cardDescription}>
              {lorebook.description || "No description"}
            </p>
          </Link>
          <ActionIcon type="button" variant="default" aria-label="Unlink lorebook" title="Unlink" disabled={disabled && !unlinking} loading={unlinking} onClick={onUnlink}>
            {!unlinking ? <IconLinkOff size={16} /> : null}
          </ActionIcon>
        </div>
        <div className={classes.badges}>
          <span className={classes.badge}>
            {LOREBOOK_CATEGORY_LABELS[lorebook.category]}
          </span>
          <span className={classes.badge}>
            {lorebook.entry_count}{" "}
            {lorebook.entry_count === 1 ? "entry" : "entries"}
          </span>
          {!lorebook.enabled ? (
            <span className={classes.badgeMuted}>disabled</span>
          ) : null}
          {lorebook.global ? (
            <span className={classes.badgeOutline}>global</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
