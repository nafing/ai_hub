import { createFileRoute } from "@tanstack/react-router";
import { ConnectionDetailPage } from "./-components/ConnectionDetailPage";

export const Route = createFileRoute("/_app/connections/$connectionId/")({
  component: ConnectionDetailPage,
});
