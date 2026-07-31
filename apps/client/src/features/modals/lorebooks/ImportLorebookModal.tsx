import { useEffect, useRef, useState, type DragEvent } from "react";
import { IconFileTypeJs, IconUpload } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LorebookImportError,
  parseLorebookImportFile,
  type CreateLorebookInput,
  type Lorebook,
} from "@ai-hub/shared";
import { Button, Modal, notifications } from "@/components/ui";
import { createLorebook } from "@/features/api-queries/lorebooks/api";
import { lorebookKeys } from "@/features/api-queries/lorebooks/queries";
import classes from "./ImportLorebookModal.module.css";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isPreset = Boolean(initialLorebook);

  useEffect(() => {
    if (!opened) {
      setPreview(null);
      setParsing(false);
      setImporting(false);
      setDragOver(false);
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
    setDragOver(false);
    onClose();
  }

  async function handleFile(file: File) {
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

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    if (importing || parsing || isPreset) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (
      file.type &&
      !file.type.includes("json") &&
      !file.name.toLowerCase().endsWith(".json")
    ) {
      notifications.show({
        title: "Unsupported file",
        message: "Drop a .json lorebook / character_book export.",
        color: "red",
      });
      return;
    }
    void handleFile(file);
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
    <Modal opened={opened} onClose={handleClose} title={title} size="lg">
      <div className={classes.body}>
        {!isPreset ? (
          <label
            className={[
              classes.dropzone,
              dragOver ? classes.dropzoneActive : "",
              parsing || importing ? classes.dropzoneDisabled : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              className={classes.fileInput}
              type="file"
              accept="application/json,.json"
              disabled={parsing || importing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleFile(file);
              }}
            />
            <span className={classes.dropIcon}>
              {parsing ? (
                <span className={classes.spinner} aria-hidden />
              ) : dragOver ? (
                <IconUpload size={28} stroke={1.5} />
              ) : (
                <IconFileTypeJs size={28} stroke={1.5} />
              )}
            </span>
            <span className={classes.dropTitle}>
              {parsing ? "Reading file…" : "Drop a lorebook JSON"}
            </span>
            <span className={classes.dropHint}>
              Accepts character_book, standalone lorebook, or SillyTavern World
              Info exports. Click to browse.
            </span>
          </label>
        ) : (
          <p className={classes.presetHint}>
            This character card includes an embedded lorebook (
            <code>character_book</code>). Import it as a hub lorebook linked to
            the character — the embedded book will not be stored on the card.
          </p>
        )}

        {preview ? (
          <p className={classes.preview}>
            Loaded <strong>{preview.lorebook.name || "untitled"}</strong> from{" "}
            {preview.fileName} — {preview.lorebook.entries.length}{" "}
            {preview.lorebook.entries.length === 1 ? "entry" : "entries"}
            {preview.lorebook.linked_characters.length > 0
              ? " · linked to character"
              : ""}
            .
          </p>
        ) : null}
      </div>

      <div className={classes.actions}>
        <Button variant="default" type="button"
          onClick={handleClose}>
          {isPreset ? "Skip" : "Cancel"}
        </Button>
        <Button variant="primary" type="button"
          disabled={!preview || importing || parsing}
          onClick={() => void handleImport()}
        >
          {importing ? "Importing…" : "Import lorebook"}
        </Button>
      </div>
    </Modal>
  );
}
