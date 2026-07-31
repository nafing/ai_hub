import { useEffect, useRef, useState, type DragEvent } from "react";
import { IconFileTypeJs, IconUpload } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  PRESET_CATEGORY_LABELS,
  PresetImportError,
  parsePresetImportFile,
  type CreatePresetInput,
} from "@ai-hub/shared";
import { Button, Modal, notifications } from "@/components/ui";
import { createPreset } from "@/features/api-queries/presets/api";
import { presetKeys } from "@/features/api-queries/presets/queries";
import classes from "./ImportPresetModal.module.css";

type ImportPresetModalProps = {
  opened: boolean;
  onClose: () => void;
};

type ImportPreview = {
  preset: CreatePresetInput;
  fileName: string;
};

export function ImportPresetModal({
  opened,
  onClose,
}: ImportPresetModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!opened) {
      setPreview(null);
      setParsing(false);
      setImporting(false);
      setDragOver(false);
    }
  }, [opened]);

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
      const preset = await parsePresetImportFile(file, bytes);
      setPreview({ preset, fileName: file.name });
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message:
          error instanceof PresetImportError || error instanceof Error
            ? error.message
            : "Could not read preset JSON",
        color: "red",
      });
    } finally {
      setParsing(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    if (importing || parsing) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (
      file.type &&
      !file.type.includes("json") &&
      !file.name.toLowerCase().endsWith(".json")
    ) {
      notifications.show({
        title: "Unsupported file",
        message: "Drop a .json preset export.",
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
      const created = await createPreset(preview.preset);
      void queryClient.invalidateQueries({ queryKey: presetKeys.list() });
      notifications.show({
        title: "Imported",
        message: `${created.name || "Preset"} (${created.sections.length} sections).`,
        color: "green",
      });
      handleClose();
      await navigate({
        to: "/presets/$presetId",
        params: { presetId: created.id },
      });
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
    <Modal opened={opened} onClose={handleClose} title="Import preset" size="lg">
      <div className={classes.body}>
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
            {parsing ? "Reading file…" : "Drop a preset JSON"}
          </span>
          <span className={classes.dropHint}>
            Accepts hub preset exports (sections, variables, groups). Click to
            browse.
          </span>
        </label>

        {preview ? (
          <p className={classes.preview}>
            Loaded <strong>{preview.preset.name || "untitled"}</strong> from{" "}
            {preview.fileName} — {PRESET_CATEGORY_LABELS[preview.preset.category]}{" "}
            · {preview.preset.sections.length}{" "}
            {preview.preset.sections.length === 1 ? "section" : "sections"} ·{" "}
            {preview.preset.variables.length}{" "}
            {preview.preset.variables.length === 1 ? "variable" : "variables"}.
          </p>
        ) : null}
      </div>

      <div className={classes.actions}>
        <Button variant="default" type="button" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          type="button"
          disabled={!preview || importing || parsing}
          onClick={() => void handleImport()}
        >
          {importing ? "Importing…" : "Import preset"}
        </Button>
      </div>
    </Modal>
  );
}
