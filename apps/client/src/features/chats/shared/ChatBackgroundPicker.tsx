import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { Character, CharacterGalleryImage } from "@ai-hub/shared";
import { getCharacter } from "@/features/characters/api";
import { characterAvatarSrc } from "@/features/characters/avatar-url";
import { characterKeys } from "@/features/characters/queries";
import { api } from "@/lib/api";
import classes from "./ChatBackgroundPicker.module.css";

export type GalleryBackgroundOption = {
  key: string;
  characterId: string;
  characterName: string;
  image: CharacterGalleryImage;
};

type ChatBackgroundPickerProps = {
  characterIds: string[];
  /** Stored API path, e.g. `/characters/{id}/gallery/{imageId}`. */
  value: string | null;
  onChange: (url: string | null) => void;
};

export function ChatBackgroundPicker({
  characterIds,
  value,
  onChange,
}: ChatBackgroundPickerProps) {
  const apiBase = String(api.defaults.baseURL ?? "/v1/api");
  const ids = useMemo(
    () => [...new Set(characterIds.filter(Boolean))],
    [characterIds],
  );

  const characterQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: characterKeys.detail(id),
      queryFn: () => getCharacter(id),
    })),
  });

  const options = useMemo(() => {
    const next: GalleryBackgroundOption[] = [];
    for (const query of characterQueries) {
      const character = query.data as Character | undefined;
      if (!character) continue;
      const name = character.data.name.trim() || "Character";
      for (const image of character.gallery ?? []) {
        next.push({
          key: `${character.id}:${image.id}`,
          characterId: character.id,
          characterName: name,
          image,
        });
      }
    }
    return next;
  }, [characterQueries]);

  const loading =
    ids.length > 0 && characterQueries.some((query) => query.isLoading);

  if (ids.length === 0) {
    return (
      <p className={classes.empty}>
        Add characters to this chat to choose a gallery background.
      </p>
    );
  }

  if (loading && options.length === 0) {
    return <p className={classes.empty}>Loading gallery images…</p>;
  }

  if (options.length === 0) {
    return (
      <p className={classes.empty}>
        No gallery images yet. Upload images on each character&apos;s Gallery
        tab.
      </p>
    );
  }

  return (
    <div className={classes.root}>
      <div className={classes.actions}>
        <button
          type="button"
          className={[
            classes.tile,
            classes.clearTile,
            value == null ? classes.tileSelected : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={value == null}
          onClick={() => onChange(null)}
        >
          <span className={classes.clearLabel}>None</span>
        </button>
      </div>
      <ul className={classes.grid}>
        {options.map((option) => {
          const selected = value === option.image.url;
          const src = characterAvatarSrc(option.image.url, apiBase);
          return (
            <li key={option.key}>
              <button
                type="button"
                className={[
                  classes.tile,
                  selected ? classes.tileSelected : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={selected}
                title={`${option.characterName} — ${option.image.name}`}
                onClick={() =>
                  onChange(selected ? null : option.image.url)
                }
              >
                {src ? (
                  <img src={src} alt="" className={classes.thumb} />
                ) : (
                  <span className={classes.missing}>Missing</span>
                )}
                <span className={classes.caption}>
                  <span className={classes.captionName}>
                    {option.characterName}
                  </span>
                  <span className={classes.captionFile}>
                    {option.image.name}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
