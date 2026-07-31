import { createFileRoute } from "@tanstack/react-router";
import { PresetDetailPage } from "./-components/PresetDetailPage";

export const Route = createFileRoute("/_app/presets/$presetId/")({
  component: PresetDetailPage,
});
