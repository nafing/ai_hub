import { createFileRoute } from "@tanstack/react-router";
import { ToolDetailPage } from "./-components/ToolDetailPage";

export const Route = createFileRoute("/_app/tools/$toolId/")({
  component: ToolDetailPage,
});
