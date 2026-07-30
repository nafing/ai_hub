export function getNodeErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error
    ? (error as { code?: string }).code
    : undefined;
}

export function isEnoent(error: unknown): boolean {
  return getNodeErrorCode(error) === "ENOENT";
}

export async function ignoreEnoent(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (!isEnoent(error)) throw error;
  }
}
