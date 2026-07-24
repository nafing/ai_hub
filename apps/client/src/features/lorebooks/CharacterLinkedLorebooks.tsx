import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconLinkOff } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
  LOREBOOK_CATEGORY_LABELS,
  type LorebookListItem,
  type UpdateLorebookInput,
} from "@ai-hub/shared";
import { useLorebooks, useUpdateLorebook } from "./queries";

type LinkedLorebooksPanelProps = {
  /** Entity id stored in lorebook `linked_characters` or `linked_personas`. */
  entityId: string;
  linkField: "linked_characters" | "linked_personas";
  entityLabel: "character" | "persona";
};

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
      <Center py="md">
        <Loader size="sm" />
      </Center>
    );
  }

  if (isError) {
    return <Text c="red">Failed to load lorebooks.</Text>;
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Link hub lorebooks to this {entityLabel} via `{linkField}`.
      </Text>

      <Group align="flex-end" wrap="nowrap" gap="sm">
        <Select
          style={{ flex: 1 }}
          label="Link lorebook"
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
          value={selectedToLink}
          onChange={setSelectedToLink}
          disabled={unlinkedOptions.length === 0 || pendingId != null}
        />
        <Button
          onClick={() => void handleLink()}
          disabled={!selectedToLink || pendingId != null}
          loading={pendingId != null && pendingId === selectedToLink}
        >
          Link
        </Button>
      </Group>

      {linked.length === 0 ? (
        <Text size="sm" c="dimmed">
          No lorebooks linked yet.
        </Text>
      ) : (
        <Stack gap="sm">
          {linked.map((lorebook) => (
            <LinkedLorebookRow
              key={lorebook.id}
              lorebook={lorebook}
              unlinking={pendingId === lorebook.id}
              disabled={pendingId != null}
              onUnlink={() => void setLinked(lorebook, false)}
            />
          ))}
        </Stack>
      )}
    </Stack>
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
    <Card withBorder padding={0}>
      <Box p="md">
        <Group justify="space-between" align="start" wrap="nowrap">
          <Link
            to="/lorebooks/$lorebookId"
            params={{ lorebookId: lorebook.id }}
            style={{
              textDecoration: "none",
              color: "inherit",
              display: "block",
              minWidth: 0,
              flex: 1,
            }}
          >
            <Text fw={600} lineClamp={1}>
              {lorebook.name || "untitled"}
            </Text>
            <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
              {lorebook.description || "No description"}
            </Text>
          </Link>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="red"
            aria-label="Unlink lorebook"
            title="Unlink"
            loading={unlinking}
            disabled={disabled && !unlinking}
            onClick={onUnlink}
          >
            <IconLinkOff size={16} />
          </ActionIcon>
        </Group>
        <Group gap={6} mt="sm">
          <Badge size="sm" variant="light">
            {LOREBOOK_CATEGORY_LABELS[lorebook.category]}
          </Badge>
          <Badge size="sm" variant="light">
            {lorebook.entry_count}{" "}
            {lorebook.entry_count === 1 ? "entry" : "entries"}
          </Badge>
          {!lorebook.enabled ? (
            <Badge size="sm" variant="outline" color="gray">
              disabled
            </Badge>
          ) : null}
          {lorebook.global ? (
            <Badge size="sm" variant="outline">
              global
            </Badge>
          ) : null}
        </Group>
      </Box>
    </Card>
  );
}

/** @deprecated Prefer LinkedLorebooksPanel — kept for existing character imports. */
export function CharacterLinkedLorebooks({
  characterId,
}: {
  characterId: string;
}) {
  return (
    <LinkedLorebooksPanel
      entityId={characterId}
      linkField="linked_characters"
      entityLabel="character"
    />
  );
}
