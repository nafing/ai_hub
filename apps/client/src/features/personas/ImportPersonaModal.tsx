import { useEffect, useRef, useState, type DragEvent } from "react";
import { IconFileTypeJs, IconUpload } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  PersonaImportError,
  parsePersonaImportFile,
  type CreatePersonaInput,
} from "@ai-hub/shared";
import { Button, Modal, notifications } from "@/components/ui";
import { createPersona } from "./api";
import { personaKeys } from "./queries";
import classes from "./ImportPersonaModal.module.css";

type ImportPersonaModalProps = {
  opened: boolean;
  onClose: () => void;
};

type ImportPreview = {
  persona: CreatePersonaInput;
  fileName: string;
};

export function ImportPersonaModal({
  opened,
  onClose,
}: ImportPersonaModalProps) {
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
      const persona = await parsePersonaImportFile(file, bytes);
      setPreview({ persona, fileName: file.name });
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message:
          error instanceof PersonaImportError || error instanceof Error
            ? error.message
            : "Could not read persona JSON",
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
        message: "Drop a .json persona export.",
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
      const created = await createPersona(preview.persona);
      void queryClient.invalidateQueries({ queryKey: personaKeys.list() });
      notifications.show({
        title: "Imported",
        message: created.name || "Persona",
        color: "green",
      });
      handleClose();
      await navigate({
        to: "/personas/$personaId",
        params: { personaId: created.id },
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
    <Modal opened={opened} onClose={handleClose} title="Import persona" size="lg">
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
            {parsing ? "Reading file…" : "Drop a persona JSON"}
          </span>
          <span className={classes.dropHint}>
            Accepts hub persona exports. Avatar is not included — upload it
            after import. Click to browse.
          </span>
        </label>

        {preview ? (
          <p className={classes.preview}>
            Loaded <strong>{preview.persona.name || "untitled"}</strong> from{" "}
            {preview.fileName}.
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
          {importing ? "Importing…" : "Import persona"}
        </Button>
      </div>
    </Modal>
  );
}
