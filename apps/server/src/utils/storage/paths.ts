import path from "node:path";

export function resolveUploadsDir(
  envDir: string | undefined,
  dirname: string,
  ...segments: string[]
): string {
  return envDir ?? path.resolve(dirname, "../../../uploads", ...segments);
}
