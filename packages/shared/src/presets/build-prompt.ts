import { isSectionMarker } from "./constants";
import type { Preset, Section, SectionKind, SectionRole, Variable, WrapFormat } from "./types";
import type { ChatMessage } from "../llm/types";
import { resolveTemplate } from "./template";

export type PresetVariableValues = Record<string, string | string[]>;

/** Runtime content injected into marker sections (by kind). */
export type PresetMarkerContent = Partial<
  Record<Exclude<SectionKind, "prompt_block">, string>
>;

export type BuildPromptOptions = {
  /** Selected values keyed by `variable.variable_name`. */
  variables?: PresetVariableValues;
  /** Text to inject at marker section slots. Empty markers are skipped. */
  markers?: PresetMarkerContent;
  /** When true (default), consecutive messages with the same role are merged. */
  mergeSameRole?: boolean;
};

function slugifyTag(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "section";
}

/** Format a section body according to the preset wrap format. */
export function wrapSectionContent(
  name: string,
  content: string,
  format: WrapFormat,
): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  if (format === "none") return trimmed;

  if (format === "markdown") {
    const heading = name.trim() || "Section";
    return `## ${heading}\n${trimmed}`;
  }

  const tag = slugifyTag(name);
  return `<${tag}>\n${trimmed}\n</${tag}>`;
}

/**
 * Resolve `{{…}}` placeholders in preset text: variables, `{{if}}` blocks,
 * comparisons, and `||` / `??` (see `resolveTemplate`).
 */
export function substituteVariables(
  text: string,
  values: PresetVariableValues = {},
): string {
  return resolveTemplate(text, values);
}

/**
 * Order sections: `ordered` keep relative list order as the base, then
 * numeric `position` sections are inserted at that index.
 */
export function orderSections(sections: Section[]): Section[] {
  const ordered: Section[] = [];
  const indexed: Array<{ section: Section; index: number }> = [];

  for (const section of sections) {
    if (section.position === "ordered") {
      ordered.push(section);
    } else if (typeof section.position === "number") {
      indexed.push({ section, index: Math.max(0, section.position) });
    } else {
      ordered.push(section);
    }
  }

  indexed.sort((a, b) => a.index - b.index || 0);

  const result = [...ordered];
  for (const { section, index } of indexed) {
    const at = Math.min(index, result.length);
    result.splice(at, 0, section);
  }
  return result;
}

function resolveSectionContent(
  section: Section,
  markers: PresetMarkerContent | undefined,
): string {
  if (isSectionMarker(section.kind)) {
    const marker =
      markers?.[section.kind as Exclude<SectionKind, "prompt_block">] ?? "";
    return marker.trim() ? marker : section.content;
  }
  return section.content;
}

function mergeMessages(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const message of messages) {
    const prev = out[out.length - 1];
    if (prev && prev.role === message.role) {
      prev.content = `${prev.content}\n\n${message.content}`;
    } else {
      out.push({ ...message });
    }
  }
  return out;
}

type PreparedSection = {
  role: SectionRole;
  group: string;
  name: string;
  body: string;
};

type SectionCluster = {
  role: SectionRole;
  group: string;
  parts: Array<{ name: string; body: string }>;
};

function prepareSections(
  sections: Section[],
  variables: PresetVariableValues,
  markers: PresetMarkerContent | undefined,
): PreparedSection[] {
  const prepared: PreparedSection[] = [];

  for (const section of orderSections(sections)) {
    const raw = resolveSectionContent(section, markers);
    const body = substituteVariables(raw, variables).trim();
    if (!body) continue;
    prepared.push({
      role: section.role,
      group: section.group.trim(),
      name: section.name,
      body,
    });
  }

  return prepared;
}

/**
 * Cluster consecutive sections that share the same non-empty group and role.
 * Ungrouped sections stay as single-item clusters.
 */
export function clusterSectionsByGroup(
  sections: PreparedSection[],
): SectionCluster[] {
  const clusters: SectionCluster[] = [];

  for (const section of sections) {
    const prev = clusters[clusters.length - 1];
    const canJoin =
      Boolean(section.group) &&
      prev &&
      prev.group === section.group &&
      prev.role === section.role;

    if (canJoin) {
      prev.parts.push({ name: section.name, body: section.body });
    } else {
      clusters.push({
        role: section.role,
        group: section.group,
        parts: [{ name: section.name, body: section.body }],
      });
    }
  }

  return clusters;
}

function renderCluster(
  cluster: SectionCluster,
  format: WrapFormat,
): string {
  const wrappedParts = cluster.parts
    .map((part) => wrapSectionContent(part.name, part.body, format))
    .filter(Boolean);

  if (wrappedParts.length === 0) return "";

  const joined = wrappedParts.join("\n\n");
  if (!cluster.group) return joined;

  // Group wrapper around the already-wrapped member sections.
  return wrapSectionContent(cluster.group, joined, format);
}

/**
 * Build chat messages from a preset: order sections, inject markers,
 * substitute variables, wrap content (including prompt groups), map roles.
 *
 * Sections that share the same non-empty `group` and `role` (and are adjacent
 * after ordering) are nested under a single group wrapper.
 */
export function buildPromptMessages(
  preset: Pick<Preset, "wrap_format" | "sections">,
  options: BuildPromptOptions = {},
): ChatMessage[] {
  const {
    variables = {},
    markers,
    mergeSameRole = true,
  } = options;

  const messages: ChatMessage[] = [];
  const clusters = clusterSectionsByGroup(
    prepareSections(preset.sections, variables, markers),
  );

  for (const cluster of clusters) {
    const content = renderCluster(cluster, preset.wrap_format);
    if (!content) continue;
    messages.push({ role: cluster.role, content });
  }

  return mergeSameRole ? mergeMessages(messages) : messages;
}

/** Build a variables map from each variable's `selected` values. */
export function selectedVariableValues(
  variables: Array<Pick<Variable, "variable_name" | "multi_select" | "selected">>,
): PresetVariableValues {
  const out: PresetVariableValues = {};
  for (const variable of variables) {
    const name = variable.variable_name.trim();
    if (!name) continue;
    const selected = (variable.selected ?? []).filter(Boolean);
    if (selected.length === 0) continue;
    out[name] = variable.multi_select ? selected : selected[0]!;
  }
  return out;
}
