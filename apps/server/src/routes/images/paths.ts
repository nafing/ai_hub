import path from "node:path";
import { imageApiPaths } from "@ai-hub/shared";

const SERVER_ROOT = path.resolve(__dirname, "../../..");

export { imageApiPaths };

export function uploadsPath(...segments: string[]): string {
  return path.resolve(SERVER_ROOT, "uploads", ...segments);
}
