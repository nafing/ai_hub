import { createFileRoute } from "@tanstack/react-router";
import { GeneratorPresetDetailPage } from "./-components/GeneratorPresetDetailPage";

export const Route = createFileRoute("/_app/presets/generator/$generatorPresetId/")({
  component: GeneratorPresetDetailPage,
});
