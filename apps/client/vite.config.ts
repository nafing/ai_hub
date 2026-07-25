import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.resolve(__dirname, "../..");

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");

  return {
    envDir,
    envPrefix: ["VITE_", "SERVER_"],
    resolve: {
      // Prefer TS source so Vite gets real ESM named exports (dist is CJS for Nest).
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@ai-hub/shared": path.resolve(
          __dirname,
          "../../packages/shared/src/index.ts",
        ),
      },
    },
    plugins: [
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
    ],
    server: {
      host: env.CLIENT_HOST ?? true,
      port: Number(env.CLIENT_PORT) || 5173,

      proxy: {
        [env.SERVER_GLOBAL_PREFIX]: {
          target: `http://${env.SERVER_HOST}:${env.SERVER_PORT}`,
          changeOrigin: true,
        },
      },
    },
  };
});
