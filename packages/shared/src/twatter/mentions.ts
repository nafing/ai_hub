export type TwatterTextMention = {
  handle: string;
  start: number;
  end: number;
};

const TWATTER_MENTION_PATTERN =
  /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{1,40})(?![A-Za-z0-9_])/gu;

export function findTwatterTextMentions(text: string): TwatterTextMention[] {
  const mentions: TwatterTextMention[] = [];
  for (const match of text.matchAll(TWATTER_MENTION_PATTERN)) {
    const prefix = match[1] ?? "";
    const handle = match[2];
    if (!handle || match.index === undefined) continue;
    const start = match.index + prefix.length;
    mentions.push({
      handle: handle.toLowerCase(),
      start,
      end: start + handle.length + 1,
    });
  }
  return mentions;
}

export function extractTwatterMentionHandles(text: string): string[] {
  return Array.from(
    new Set(findTwatterTextMentions(text).map((mention) => mention.handle)),
  );
}

export function twatterTextMentionsHandle(
  text: string | null | undefined,
  handle: string,
): boolean {
  const normalizedHandle = handle.trim().replace(/^@+/u, "").toLowerCase();
  if (!text || !normalizedHandle) return false;
  return extractTwatterMentionHandles(text).includes(normalizedHandle);
}
