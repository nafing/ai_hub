import { Outlet, createRootRoute } from "@tanstack/react-router";
import { CharacterImportJobsHost } from "@/features/characters/CharacterImportJobsHost";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <CharacterImportJobsHost />
      <Outlet />
    </>
  );
}
