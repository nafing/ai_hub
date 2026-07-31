import { useRef } from "react";
import type { CharacterGalleryImage } from "@ai-hub/shared";
import { Button, notifications } from "@/components/ui";
import { api } from "@/lib/api";
import { avatarSrc } from "@/lib/avatar-url";
import {
  useDeleteCharacterGalleryImage,
  useUploadCharacterGalleryImage,
} from "@/features/api-queries/characters/queries";
import classes from "./CharacterGalleryPanel.module.css";

type CharacterGalleryPanelProps = {
  characterId: string;
  images: CharacterGalleryImage[];
};

function sourceLabel(source: CharacterGalleryImage["source"]): string {
  if (source === "generated") return "Generated";
  if (source === "import") return "Import";
  return "Upload";
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response
  ) {
    const data = (error.response as { data?: unknown }).data;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
      if (Array.isArray(message)) return message.map(String).join(", ");
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Unknown upload error";
}

export function CharacterGalleryPanel({
  characterId,
  images,
}: CharacterGalleryPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadCharacterGalleryImage();
  const deleteMutation = useDeleteCharacterGalleryImage();
  const apiBase = String(api.defaults.baseURL);

  async function handleUpload(files: File[]) {
    if (!files.length) return;
    let ok = 0;
    let failed = 0;
    let lastError = "";
    for (const file of files) {
      try {
        await uploadMutation.mutateAsync({
          id: characterId,
          file,
          fileName: file.name,
        });
        ok += 1;
      } catch (error) {
        failed += 1;
        lastError = uploadErrorMessage(error);
      }
    }
    if (ok > 0) {
      notifications.show({
        title: ok === 1 ? "Image added" : "Images added",
        message:
          failed > 0
            ? `${ok} saved, ${failed} failed.`
            : "Saved to character gallery.",
        color: "green",
      });
    } else if (failed > 0) {
      notifications.show({
        title: "Upload failed",
        message: lastError || "Could not add images to the gallery.",
        color: "red",
      });
    }
  }

  async function handleDelete(image: CharacterGalleryImage) {
    try {
      await deleteMutation.mutateAsync({
        id: characterId,
        imageId: image.id,
      });
      notifications.show({
        title: "Removed",
        message: "Image deleted from gallery.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Remove failed",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    }
  }

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div>
          <h3 className={classes.title}>Gallery</h3>
          <p className={classes.hint}>
            Imported and generated images for this character. You can later use
            them as chat backgrounds.
          </p>
        </div>
        <div className={classes.actions}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
            multiple
            className={classes.hiddenFileInput}
            onChange={(event) => {
              // Snapshot before clearing — FileList is live and empties on reset.
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void handleUpload(files);
            }}
          />
          <Button
            variant="primary"
            size="sm"
            type="button"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadMutation.isPending ? "Uploading…" : "Add images"}
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <p className={classes.empty}>
          No gallery images yet. Upload PNGs, JPEGs, WebPs, or GIFs to start a
          library for chat backgrounds.
        </p>
      ) : (
        <ul className={classes.grid}>
          {images.map((image) => {
            const src = avatarSrc(image.url, apiBase);
            return (
              <li key={image.id} className={classes.card}>
                <div className={classes.thumb}>
                  {src ? (
                    <img src={src} alt="" className={classes.image} />
                  ) : (
                    <span className={classes.missing}>Missing</span>
                  )}
                </div>
                <div className={classes.meta}>
                  <span className={classes.name} title={image.name}>
                    {image.name}
                  </span>
                  <span className={classes.sub}>
                    {sourceLabel(image.source)} · {formatBytes(image.size)}
                  </span>
                  {image.prompt ? (
                    <span className={classes.prompt} title={image.prompt}>
                      {image.prompt}
                    </span>
                  ) : null}
                </div>
                <div className={classes.cardActions}>
                  <Button
                    variant="subtle"
                    size="sm"
                    type="button"
                    disabled={
                      deleteMutation.isPending &&
                      deleteMutation.variables?.imageId === image.id
                    }
                    onClick={() => void handleDelete(image)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
