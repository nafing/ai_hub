import { createFileRoute } from "@tanstack/react-router";
import { AgentDetailPage } from "./-components/AgentDetailPage";

export const Route = createFileRoute("/_app/agents/$agentId/")({
  component: AgentDetailPage,
});
