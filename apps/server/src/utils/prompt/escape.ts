export function escapePromptAttribute(value: string): string {
  return value.replace(/"/g, "'").replace(/[<>]/g, "");
}

export function escapeQuotesForAttribute(value: string): string {
  return value.replace(/"/g, "'");
}
