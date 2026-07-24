import { useEffect, useState } from "react";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import { IconFileTypeJs, IconUpload, IconX } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LorebookImportError,
  parseLorebookImportFile,
  type CreateLorebookInput,
  type Lorebook,
} from "@ai-hub/shared";
import { createLorebook } from "./api";
import { lorebookKeys } from "./queries";

type ImportLorebookModalProps = {
  opened: boolean;
  onClose: () => void;
  /** Pre-filled draft (e.g. extracted from a character card `character_book`). */
  initialLorebook?: CreateLorebookInput | null;
  /** Label shown instead of a file name when using `initialLorebook`. */
  sourceLabel?: string;
  title?: string;
  /**
   * Called after a successful create. Return false to skip default navigation
   * to the lorebook detail page.
   */
  onImported?: (lorebook: Lorebook) => void | boolean | Promise<void | boolean>;
};

type ImportPreview = {
  lorebook: CreateLorebookInput;
  fileName: string;
};

export function ImportLorebookModal({
  opened,
  onClose,
  initialLorebook = null,
  sourceLabel = "character_book",
  title = "Import lorebook",
  onImported,
}: ImportLorebookModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const isPreset = Boolean(initialLorebook);

  useEffect(() => {
    if (!opened) {
      setPreview(null);
      setParsing(false);
      setImporting(false);
      return;
    }
    if (initialLorebook) {
      setPreview({
        lorebook: initialLorebook,
        fileName: sourceLabel,
      });
    }
  }, [opened, initialLorebook, sourceLabel]);

  function handleClose() {
    setPreview(null);
    setParsing(false);
    setImporting(false);
    onClose();
  }

  async function handleDrop(files: File[]) {
    const file = files[0];
    if (!file) return;
    setParsing(true);
    setPreview(null);
    try {
      const bytes = await file.arrayBuffer();
      const lorebook = await parseLorebookImportFile(file, bytes);
      setPreview({ lorebook, fileName: file.name });
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message:
          error instanceof LorebookImportError || error instanceof Error
            ? error.message
            : "Could not read lorebook JSON",
        color: "red",
      });
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const created = await createLorebook(preview.lorebook);
      void queryClient.invalidateQueries({ queryKey: lorebookKeys.list() });
      notifications.show({
        title: "Imported",
        message: `${created.name || "Lorebook"} (${created.entries.length} entries).`,
        color: "green",
      });
      const skipNav = (await onImported?.(created)) === false;
      handleClose();
      if (!skipNav) {
        await navigate({
          to: "/lorebooks/$lorebookId",
          params: { lorebookId: created.id },
        });
      }
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={title}
      centered
      size="lg"
    >
      <Stack gap="sm">
        {!isPreset ? (
          <Dropzone
            onDrop={(files) => void handleDrop(files)}
            onReject={() => {
              notifications.show({
                title: "Unsupported file",
                message: "Drop a .json lorebook / character_book export.",
                color: "red",
              });
            }}
            accept={["application/json", "text/json"]}
            maxFiles={1}
            loading={parsing}
            disabled={importing}
          >
            <Group
              justify="center"
              gap="md"
              mih={120}
              style={{ pointerEvents: "none" }}
            >
              <Dropzone.Accept>
                <IconUpload size={32} stroke={1.5} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={32} stroke={1.5} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconFileTypeJs size={32} stroke={1.5} />
              </Dropzone.Idle>
              <div>
                <Text size="sm" inline>
                  Drop a lorebook JSON
                </Text>
                <Text size="xs" c="dimmed" inline mt={4}>
                  Accepts character_book, standalone lorebook, or SillyTavern
                  World Info exports.
                </Text>
              </div>
            </Group>
          </Dropzone>
        ) : (
          <Text size="sm" c="dimmed">
            This character card includes an embedded lorebook
            (`character_book`). Import it as a hub lorebook linked to the
            character — the embedded book will not be stored on the card.
          </Text>
        )}

        {preview ? (
          <Text size="sm">
            Loaded <strong>{preview.lorebook.name || "untitled"}</strong> from{" "}
            {preview.fileName} — {preview.lorebook.entries.length}{" "}
            {preview.lorebook.entries.length === 1 ? "entry" : "entries"}
            {preview.lorebook.linked_characters.length > 0
              ? ` · linked to character`
              : ""}
            .
          </Text>
        ) : null}
      </Stack>

      <Group justify="flex-end" mt="md">
        <Button variant="default" type="button" onClick={handleClose}>
          {isPreset ? "Skip" : "Cancel"}
        </Button>
        <Button
          onClick={() => void handleImport()}
          loading={importing || parsing}
          disabled={!preview}
        >
          Import lorebook
        </Button>
      </Group>
    </Modal>
  );
}
