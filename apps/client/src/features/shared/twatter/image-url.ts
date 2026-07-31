/** Resolve Twatter post image API path to a browser-usable URL. */
export function twatterPostImageSrc(
  imageUrl: string | null | undefined,
  apiBaseUrl: string,
): string | null {
  if (!imageUrl) return null;
  if (
    imageUrl.startsWith("data:") ||
    imageUrl.startsWith("http://") ||
    imageUrl.startsWith("https://") ||
    imageUrl.startsWith("blob:")
  ) {
    return imageUrl;
  }
  const base = apiBaseUrl.replace(/\/$/, "");
  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${base}${path}`;
}
