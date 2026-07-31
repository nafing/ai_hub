import { createFileRoute } from "@tanstack/react-router";
import { ToolsPage } from "./-components/ToolsPage";

export const Route = createFileRoute("/_app/tools/")({
  component: ToolsPage,
});
