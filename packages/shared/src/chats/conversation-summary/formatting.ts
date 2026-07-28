import type { WrapFormat } from "../../presets/types";
import type { DaySummaryEntry, WeekSummaryEntry } from "./types";
import {
  formatConversationDateKey,
  parseConversationDateKey,
} from "./date-keys";

export function formatConversationSummaryBlock(
  label: string,
  summary: string,
  wrapFormat: WrapFormat = "none",
): string {
  if (wrapFormat === "xml") {
    return `<summary ${label}>\n${summary}\n</summary>`;
  }
  const displayLabel = label.replace(/="/g, ": ").replace(/"$/g, "");
  if (wrapFormat === "markdown") {
    return `## Summary (${displayLabel})\n${summary}`;
  }
  return `Summary (${displayLabel})\n${summary}`;
}

export function formatConversationImportantMemoryBlock(
  sections: Array<{ label: string; details: string[] }>,
  wrapFormat: WrapFormat = "none",
): string | null {
  if (sections.length === 0) return null;
  const lines = ["Things you must remember from past conversations:"];
  for (const section of sections) {
    lines.push(`[${section.label}]`);
    for (const detail of section.details) lines.push(`- ${detail}`);
  }
  const body = lines.join("\n");
  if (wrapFormat === "xml") return `<important_memories>\n${body}\n</important_memories>`;
  if (wrapFormat === "markdown") return `## Important Memories\n${body}`;
  return body;
}

export function collectConversationKeyDetailSections(input: {
  day_summaries: Record<string, DaySummaryEntry>;
  week_summaries: Record<string, WeekSummaryEntry>;
}): Array<{ label: string; details: string[] }> {
  const dayToWeek = new Map<string, string>();
  for (const weekKey of Object.keys(input.week_summaries)) {
    const monday = parseConversationDateKey(weekKey);
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + i,
      );
      dayToWeek.set(formatConversationDateKey(day), weekKey);
    }
  }

  const sections: Array<{ label: string; details: string[] }> = [];
  const sortedWeekKeys = Object.keys(input.week_summaries).sort(
    (a, b) =>
      parseConversationDateKey(a).getTime() -
      parseConversationDateKey(b).getTime(),
  );
  for (const weekKey of sortedWeekKeys) {
    const entry = input.week_summaries[weekKey];
    if (!entry?.key_details.length) continue;
    const monday = parseConversationDateKey(weekKey);
    const sunday = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + 6,
    );
    sections.push({
      label: `Week of ${weekKey} – ${formatConversationDateKey(sunday)}`,
      details: entry.key_details,
    });
  }
  for (const [date, entry] of Object.entries(input.day_summaries)) {
    if (dayToWeek.has(date) || !entry.key_details.length) continue;
    sections.push({ label: date, details: entry.key_details });
  }
  return sections;
}
