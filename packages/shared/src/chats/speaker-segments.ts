/** Case-insensitive name matching for speaker parsing. */
export function normalizeTextForMatch(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export type SpeakerSegment = {
  speaker: string | null;
  text: string;
  start: number;
  end: number;
};

export type GroupedSegment = {
  speaker: string | null;
  lines: string[];
  start: number;
  end: number;
};

const ENCODED_SPEAKER_TAG_RE =
  /&(?:lt|#0*60|#x0*3c);([^<>]*?\bspeaker\b[^<>]*?)&(?:gt|#0*62|#x0*3e);/gi;

function decodeSpeakerTagAttributeEntities(value: string): string {
  return value
    .replace(/&quot;|&#0*34;|&#x0*22;/gi, '"')
    .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'");
}

export function decodeEncodedSpeakerTags(value: string): string {
  return value.replace(ENCODED_SPEAKER_TAG_RE, (match, tagBody: string) => {
    const decoded = decodeSpeakerTagAttributeEntities(tagBody).trim();
    if (/^\/\s*speaker\s*$/i.test(decoded)) return "</speaker>";

    const open = decoded.match(/^speaker\s*=\s*(["'])([^"']*)\1\s*$/i);
    if (!open?.[2]) return match;
    return `<speaker="${open[2].trim()}">`;
  });
}

export function parseSpeakerTags(
  content: string,
  knownNames: Set<string>,
): SpeakerSegment[] | null {
  const decodedContent = decodeEncodedSpeakerTags(content);
  const regex = /<speaker="([^"]*)">([\s\S]*?)<\/speaker>/g;
  let match: RegExpExecArray | null;
  const segments: SpeakerSegment[] = [];
  let lastIndex = 0;
  let foundTag = false;

  while ((match = regex.exec(decodedContent)) !== null) {
    foundTag = true;
    const speakerName = match[1]!.trim();
    const knownSpeaker = knownNames.has(normalizeTextForMatch(speakerName));
    if (match.index > lastIndex) {
      const before = decodedContent.slice(lastIndex, match.index).trim();
      if (before) {
        segments.push({
          speaker: null,
          text: before,
          start: lastIndex,
          end: match.index,
        });
      }
    }
    segments.push({
      speaker: knownSpeaker ? speakerName : null,
      text: match[2]!.trim(),
      start: match.index,
      end: regex.lastIndex,
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < decodedContent.length) {
    const after = decodedContent.slice(lastIndex).trim();
    if (after) {
      segments.push({
        speaker: null,
        text: after,
        start: lastIndex,
        end: decodedContent.length,
      });
    }
  }

  return foundTag ? segments : null;
}

export function parseNamePrefixFormat(
  content: string,
  knownNames: Set<string>,
  leadingSpeaker?: string | null,
): SpeakerSegment[] | null {
  if (!knownNames.size) return null;
  const lines = content.split("\n");
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }

  const segments: SpeakerSegment[] = [];
  let currentSpeaker: string | null = null;
  let currentLines: string[] = [];
  let currentStartLine = 0;
  let currentLastContentLine = -1;

  const flush = () => {
    if (currentLines.length === 0) return;
    const endLine =
      currentLastContentLine >= 0
        ? currentLastContentLine
        : currentStartLine + currentLines.length - 1;
    segments.push({
      speaker: currentSpeaker,
      text: currentLines.join("\n"),
      start: lineStarts[currentStartLine]!,
      end: lineStarts[endLine]! + lines[endLine]!.length,
    });
  };

  let found = false;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    const colonIdx = line.indexOf(": ");
    if (colonIdx > 0) {
      const potentialName = line.slice(0, colonIdx).trim();
      if (knownNames.has(normalizeTextForMatch(potentialName))) {
        flush();
        currentSpeaker = potentialName;
        currentLines = [line.slice(colonIdx + 2)];
        currentStartLine = li;
        currentLastContentLine = line.slice(colonIdx + 2).trim() ? li : -1;
        found = true;
        continue;
      }
    }
    if (currentLines.length === 0) currentStartLine = li;
    currentLines.push(line);
    if (line.trim()) currentLastContentLine = li;
  }
  flush();

  if (!found) return null;
  const visibleSegments = segments.filter((segment) => segment.text.trim());
  const normalizedLeadingSpeaker = leadingSpeaker
    ? normalizeTextForMatch(leadingSpeaker)
    : "";
  if (
    visibleSegments[0]?.speaker === null &&
    normalizedLeadingSpeaker &&
    knownNames.has(normalizedLeadingSpeaker)
  ) {
    visibleSegments[0] = {
      ...visibleSegments[0],
      speaker: leadingSpeaker!.trim(),
    };
  }
  return visibleSegments;
}

export function groupConsecutiveSegments(
  segments: SpeakerSegment[],
): GroupedSegment[] {
  const groups: GroupedSegment[] = [];
  for (const segment of segments) {
    const last = groups[groups.length - 1];
    const trimmed = segment.text.replace(/^\n+|\n+$/g, "");
    if (
      last &&
      last.speaker &&
      segment.speaker &&
      normalizeTextForMatch(last.speaker) ===
        normalizeTextForMatch(segment.speaker)
    ) {
      last.lines.push(trimmed);
      last.end = segment.end;
    } else {
      groups.push({
        speaker: segment.speaker,
        lines: [trimmed],
        start: segment.start,
        end: segment.end,
      });
    }
  }
  return groups;
}

export function parseGroupedSpeakerSegments(
  content: string,
  knownNames: Set<string>,
  leadingSpeaker?: string | null,
): GroupedSegment[] | null {
  const speakerSegs = parseSpeakerTags(content, knownNames);
  if (speakerSegs) return groupConsecutiveSegments(speakerSegs);
  const nameSegs = parseNamePrefixFormat(content, knownNames, leadingSpeaker);
  if (nameSegs) return groupConsecutiveSegments(nameSegs);
  return null;
}
