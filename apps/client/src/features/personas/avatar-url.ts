/** Resolve persona/character avatar API path to a browser-usable URL. */
export function personaAvatarSrc(
  avatar: string | null | undefined,
  apiBaseUrl: string,
): string | null {
  if (!avatar) return null;
  if (
    avatar.startsWith("data:") ||
    avatar.startsWith("http://") ||
    avatar.startsWith("https://") ||
    avatar.startsWith("blob:")
  ) {
    return avatar;
  }
  const base = apiBaseUrl.replace(/\/$/, "");
  const path = avatar.startsWith("/") ? avatar : `/${avatar}`;
  return `${base}${path}`;
}
