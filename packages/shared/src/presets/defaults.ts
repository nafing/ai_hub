import { SECTION_KIND_LABELS } from "./constants";
import type {
  Preset,
  Section,
  SectionKind,
  Variable,
  VariableOption,
} from "./types";

function newId() {
  return globalThis.crypto.randomUUID();
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
export function defaultPreset(): Omit<Preset, "id"> {
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
  };
}

/** Stable DB id for a built-in default preset (`default:roleplay`, …). */
export function defaultPresetId(key: string): string {
  return `default:${key}`;
}
