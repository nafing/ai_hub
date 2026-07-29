import type { CharacterFolder } from "@ai-hub/shared";
import { Button } from "@/components/ui";
import classes from "./CharacterFolderQuickPick.module.css";

type CharacterFolderQuickPickProps = {
  folders: CharacterFolder[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
};

/** Merge folder members into selection, preserving existing order and appending new ids. */
export function mergeFolderIntoSelection(
  selectedIds: string[],
  folderCharacterIds: string[],
): string[] {
  const seen = new Set(selectedIds);
  const next = [...selectedIds];
  for (const id of folderCharacterIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

export function CharacterFolderQuickPick({
  folders,
  selectedIds,
  onChange,
}: CharacterFolderQuickPickProps) {
  const usable = folders.filter((folder) => folder.character_ids.length > 0);
  if (usable.length === 0) return null;

  return (
    <div className={classes.wrap}>
      <span className={classes.label}>Folders</span>
      <div className={classes.chips} role="group" aria-label="Add folder">
        {usable.map((folder) => {
          const allSelected = folder.character_ids.every((id) =>
            selectedIds.includes(id),
          );
          return (
            <Button
              key={folder.id}
              type="button"
              size="sm"
              variant={allSelected ? "light" : "default"}
              className={classes.chip}
              title={
                allSelected
                  ? "All characters from this folder are already selected"
                  : `Add ${folder.character_ids.length} character${folder.character_ids.length === 1 ? "" : "s"}`
              }
              onClick={() =>
                onChange(
                  mergeFolderIntoSelection(selectedIds, folder.character_ids),
                )
              }
            >
              {folder.name}
              <span className={classes.count}>{folder.character_ids.length}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
