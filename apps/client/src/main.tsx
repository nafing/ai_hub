import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import "./index.css";

import { routeTree } from "./routeTree.gen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationsProvider } from "@/components/ui";
import { PresetCommandBridge } from "@/features/presets/PresetCommandBridge";
import { ThemeSync } from "@/features/theme/ThemeSync";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <NotificationsProvider>
        <PresetCommandBridge>
          <RouterProvider router={router} />
        </PresetCommandBridge>
      </NotificationsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
