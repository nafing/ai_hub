import {
  PRESET_CATEGORIES,
  SECTION_KIND_LABELS,
  SECTION_KINDS,
  VARIABLE_PRESENTATIONS,
  WRAP_FORMATS,
} from "./constants";
import type { CreatePresetInput } from "./api";
import type {
  Preset,
  PresetCategory,
  Section,
  SectionKind,
  Variable,
  VariableOption,
  VariablePresentation,
  WrapFormat,
} from "./types";

function newId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // randomUUID requires a secure context (HTTPS / localhost).
    // Phones on LAN HTTP (vite --host) hit this path.
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultSection(overrides: Partial<Section> = {}): Section {
  const kind: SectionKind = overrides.kind ?? "prompt_block";
  const { kind: _kind, name, ...rest } = overrides;
  return {
    id: newId(),
    role: "system",
    content: "",
    position: "ordered",
    group: "",
    ...rest,
    kind,
    name: name ?? SECTION_KIND_LABELS[kind],
  };
}

export function createSectionFromKind(kind: SectionKind): Section {
  return defaultSection({ kind });
}

export function defaultVariableOption(
  overrides: Partial<VariableOption> = {},
): VariableOption {
  return {
    id: newId(),
    label: "",
    value: "",
    ...overrides,
  };
}

export function defaultVariable(overrides: Partial<Variable> = {}): Variable {
  return {
    id: newId(),
    variable_name: "",
    question: "",
    multi_select: false,
    presentation: "radios",
    alphabetical: false,
    selected: [],
    options: [],
    ...overrides,
  };
}

/** Baseline values for a new preset form / create payload. */
export function defaultPreset(
  overrides: Partial<CreatePresetInput> = {},
): CreatePresetInput {
  return {
    name: "",
    description: "",
    wrap_format: "xml",
    category: "roleplay",
    is_default: false,
    author: "",
    groups: [],
    sections: [],
    variables: [],
    ...overrides,
  };
}

/** Stable DB id for a built-in default preset (`default:roleplay`, …). */
export function defaultPresetId(key: string): string {
  return `default:${key}`;
}

function normalizeWrapFormat(raw: unknown): WrapFormat {
  return (WRAP_FORMATS as readonly string[]).includes(raw as string)
    ? (raw as WrapFormat)
    : "xml";
}

function normalizeCategory(raw: unknown): PresetCategory {
  return (PRESET_CATEGORIES as readonly string[]).includes(raw as string)
    ? (raw as PresetCategory)
    : "roleplay";
}

function normalizeSection(raw: unknown): Section {
  const base =
    typeof raw === "object" && raw !== null
      ? (raw as Partial<Section>)
      : {};
  const kind =
    base.kind && (SECTION_KINDS as readonly string[]).includes(base.kind)
      ? (base.kind as SectionKind)
      : "prompt_block";

  return {
    id: typeof base.id === "string" && base.id ? base.id : newId(),
    kind,
    name:
      typeof base.name === "string" && base.name
        ? base.name
        : SECTION_KIND_LABELS[kind],
    role:
      base.role === "user" ||
      base.role === "assistant" ||
      base.role === "system"
        ? base.role
        : "system",
    content: typeof base.content === "string" ? base.content : "",
    position:
      base.position === "ordered" || typeof base.position === "number"
        ? base.position
        : "ordered",
    group: typeof base.group === "string" ? base.group : "",
  };
}

function normalizeVariable(raw: unknown): Variable {
  const base =
    typeof raw === "object" && raw !== null
      ? (raw as Partial<Variable> & {
          list?: string[];
          default_value?: string;
        })
      : {};

  if (Array.isArray(base.options)) {
    const selected = Array.isArray(base.selected)
      ? base.selected.map(String).filter(Boolean)
      : typeof base.default_value === "string" && base.default_value
        ? [base.default_value]
        : [];
    const presentation =
      (VARIABLE_PRESENTATIONS as readonly string[]).includes(
        base.presentation as string,
      )
        ? (base.presentation as VariablePresentation)
        : "radios";

    return {
      id: typeof base.id === "string" && base.id ? base.id : newId(),
      variable_name:
        typeof base.variable_name === "string" ? base.variable_name : "",
      question: typeof base.question === "string" ? base.question : "",
      multi_select: Boolean(base.multi_select),
      presentation,
      alphabetical: Boolean(base.alphabetical),
      selected,
      options: base.options.map((option) => ({
        id:
          typeof option?.id === "string" && option.id ? option.id : newId(),
        label: typeof option?.label === "string" ? option.label : "",
        value: typeof option?.value === "string" ? option.value : "",
      })),
    };
  }

  const legacyList = Array.isArray(base.list) ? base.list : [];
  const legacyDefault =
    typeof base.default_value === "string" && base.default_value
      ? [base.default_value]
      : [];

  return {
    id: typeof base.id === "string" && base.id ? base.id : newId(),
    variable_name:
      typeof base.variable_name === "string" ? base.variable_name : "",
    question: typeof base.question === "string" ? base.question : "",
    multi_select: false,
    presentation: "radios",
    alphabetical: false,
    selected: legacyDefault,
    options: legacyList.map((value) => ({
      id: newId(),
      label: String(value),
      value: String(value),
    })),
  };
}

/** Coerce unknown / partial JSON into a create payload. */
export function normalizePreset(
  input: Partial<Preset> & Record<string, unknown>,
): CreatePresetInput {
  const groups = Array.isArray(input.groups)
    ? input.groups.map(String).filter(Boolean)
    : [];
  const sections = Array.isArray(input.sections)
    ? input.sections.map(normalizeSection)
    : [];
  const variables = Array.isArray(input.variables)
    ? input.variables.map(normalizeVariable)
    : [];

  return defaultPreset({
    name: typeof input.name === "string" ? input.name : "",
    description: typeof input.description === "string" ? input.description : "",
    wrap_format: normalizeWrapFormat(input.wrap_format),
    category: normalizeCategory(input.category),
    is_default: Boolean(input.is_default),
    author: typeof input.author === "string" ? input.author : "",
    groups,
    sections,
    variables,
  });
}

/** Portable preset JSON (no hub id; never marks default). */
export function toPresetExport(
  preset: CreatePresetInput | Preset,
): CreatePresetInput {
  const { id: _id, ...rest } = preset as Preset;
  return {
    ...normalizePreset(rest),
    is_default: false,
  };
}
