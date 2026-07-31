import { createFileRoute } from "@tanstack/react-router";
import {
  PRESET_CATEGORIES,
  type PresetCategory,
} from "@ai-hub/shared";
import { PresetsPage } from "./-components/PresetsPage";

type PresetsSearch = {
  category?: PresetCategory;
};

function parsePresetsSearch(search: Record<string, unknown>): PresetsSearch {
  const raw = search.category;
  if (
    typeof raw === "string" &&
    (PRESET_CATEGORIES as readonly string[]).includes(raw)
  ) {
    return { category: raw as PresetCategory };
  }
  return {};
}

export const Route = createFileRoute("/_app/presets/")({
  component: PresetsPage,
  validateSearch: parsePresetsSearch,
});
