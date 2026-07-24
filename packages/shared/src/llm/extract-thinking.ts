/**
 * Extract hidden reasoning from a model reply using a thinking tag template.
 * Template example: `<thinking>{{thinking}}</thinking>`
 * Built-in pairs are also recognized when no template is provided.
 */
export function extractThinking(
  reply: string,
  thinkingTag?: string | null,
): { thinking: string; content: string } {
  const pairs = collectPairs(thinkingTag);

  for (const { open, close } of pairs) {
    const openIndex = reply.indexOf(open);
    if (openIndex === -1) continue;
    const contentStart = openIndex + open.length;
    const closeIndex = reply.indexOf(close, contentStart);
    if (closeIndex === -1) continue;

    const thinking = reply.slice(contentStart, closeIndex).trim();
    const content = `${reply.slice(0, openIndex)}${reply.slice(closeIndex + close.length)}`
      .replace(/^\s*\n/, "")
      .trim();
    return { thinking, content };
  }

  return { thinking: "", content: reply };
}

function collectPairs(
  thinkingTag?: string | null,
): Array<{ open: string; close: string }> {
  const pairs: Array<{ open: string; close: string }> = [];

  const template = thinkingTag?.trim();
  if (template) {
    const marker = "{{thinking}}";
    const at = template.indexOf(marker);
    if (at !== -1) {
      pairs.push({
        open: template.slice(0, at),
        close: template.slice(at + marker.length),
      });
    }
  }

  pairs.push(
    { open: "<thinking>", close: "</thinking>" },
    { open: "<think>", close: "</think>" },
    { open: "<thought>", close: "</thought>" },
    { open: "◁think▷", close: "◁/think▷" },
    { open: "```thinking", close: "```" },
  );

  return pairs.filter((pair) => pair.open && pair.close);
}
