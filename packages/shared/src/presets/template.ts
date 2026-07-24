import type { PresetVariableValues } from "./build-prompt";

const VAR_NAME = "[a-zA-Z_][a-zA-Z0-9_]*";

const IF_OPEN_RE = /\{\{\s*if\s+([\s\S]*?)\s*\}\}/i;
const INLINE_MACRO_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

const COMPARE_RE = new RegExp(
  `^(${VAR_NAME})\\s*(==|!=|>=|<=|>|<)\\s*([\\s\\S]*)$`,
);
const OR_RE = new RegExp(`^(${VAR_NAME})\\s*\\|\\|\\s*([\\s\\S]*)$`);
const NULLISH_RE = new RegExp(`^(${VAR_NAME})\\s*\\?\\?\\s*([\\s\\S]*)$`);
const IDENT_RE = new RegExp(`^(${VAR_NAME})$`);

function normalizeScalar(raw: string | string[] | undefined): string {
  if (raw === undefined || raw === null) return "";
  if (Array.isArray(raw)) return raw.filter(Boolean).join("\n");
  return raw;
}

/** ST-style falsy: empty, false, 0, off, no (case-insensitive). */
export function isTruthy(value: string | string[] | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  const text = normalizeScalar(value).trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  return !(
    lower === "false" ||
    lower === "0" ||
    lower === "off" ||
    lower === "no"
  );
}

export type VarLookup = {
  exists: boolean;
  value: string;
};

export function lookupVar(
  values: PresetVariableValues,
  name: string,
): VarLookup {
  if (!Object.prototype.hasOwnProperty.call(values, name)) {
    return { exists: false, value: "" };
  }
  return { exists: true, value: normalizeScalar(values[name]) };
}

function compareValues(left: string, op: string, right: string): boolean {
  if (op === "==") return left === right;
  if (op === "!=") return left !== right;

  const a = Number.parseFloat(left);
  const b = Number.parseFloat(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (op === ">") return a > b;
  if (op === ">=") return a >= b;
  if (op === "<") return a < b;
  if (op === "<=") return a <= b;
  return false;
}

/**
 * Evaluate an `{{if …}}` condition expression (no surrounding braces).
 * Supports `!…`, `name == value` (etc.), or variable / literal truthiness.
 */
export function evaluateCondition(
  expr: string,
  values: PresetVariableValues,
): boolean {
  let text = expr.trim();
  let invert = false;
  while (text.startsWith("!")) {
    invert = !invert;
    text = text.slice(1).trim();
  }

  let result: boolean;
  const compare = text.match(COMPARE_RE);
  if (compare) {
    const [, name, op, rawRight] = compare;
    const left = lookupVar(values, name!).value;
    const right = (rawRight ?? "").trim();
    result = compareValues(left, op!, right);
  } else {
    const ident = text.match(IDENT_RE);
    if (ident) {
      result = isTruthy(lookupVar(values, ident[1]!).value);
    } else {
      result = isTruthy(text);
    }
  }

  return invert ? !result : result;
}

/**
 * Resolve a single `{{…}}` body (no braces).
 * Returns `null` to keep the original `{{…}}` unchanged.
 */
export function resolveInlineMacro(
  inner: string,
  values: PresetVariableValues,
): string | null {
  const text = inner.trim();
  if (!text) return null;

  // Control leftovers should not be rewritten here.
  if (/^(if\b|else\b|\/\s*if\b)/i.test(text)) return null;

  const orMatch = text.match(OR_RE);
  if (orMatch) {
    const looked = lookupVar(values, orMatch[1]!);
    return isTruthy(looked.value) ? looked.value : (orMatch[2] ?? "");
  }

  const nullishMatch = text.match(NULLISH_RE);
  if (nullishMatch) {
    const looked = lookupVar(values, nullishMatch[1]!);
    if (!looked.exists) return nullishMatch[2] ?? "";
    return looked.value;
  }

  const compare = text.match(COMPARE_RE);
  if (compare) {
    const [, name, op, rawRight] = compare;
    const left = lookupVar(values, name!).value;
    const right = (rawRight ?? "").trim();
    return compareValues(left, op!, right) ? "true" : "false";
  }

  const ident = text.match(IDENT_RE);
  if (ident) {
    const looked = lookupVar(values, ident[1]!);
    if (!looked.exists) return null;
    // Match legacy substituteVariables: empty string keeps the placeholder.
    if (looked.value === "") return null;
    return looked.value;
  }

  return null;
}

type IfMatch = {
  start: number;
  end: number;
  condition: string;
  thenBody: string;
  elseBody: string | null;
};

function findFirstIfBlock(text: string): IfMatch | null {
  const open = IF_OPEN_RE.exec(text);
  if (!open || open.index === undefined) return null;

  const blockStart = open.index;
  const afterOpen = blockStart + open[0].length;
  const condition = (open[1] ?? "").trim();

  const tagRe = /\{\{\s*(?:if\s+[\s\S]*?|else|\/\s*if)\s*\}\}/gi;
  tagRe.lastIndex = afterOpen;

  let depth = 1;
  let elseAt: number | null = null;
  let elseTagLen = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(text)) !== null) {
    const full = match[0];
    const idx = match.index;
    const isIf = /^\{\{\s*if\b/i.test(full);
    const isElse = /^\{\{\s*else\s*\}\}$/i.test(full);
    const isClose = /^\{\{\s*\/\s*if\s*\}\}$/i.test(full);

    if (isIf) {
      depth += 1;
      continue;
    }
    if (isElse) {
      if (depth === 1 && elseAt === null) {
        elseAt = idx;
        elseTagLen = full.length;
      }
      continue;
    }
    if (isClose) {
      depth -= 1;
      if (depth === 0) {
        const closeStart = idx;
        const thenBody =
          elseAt === null
            ? text.slice(afterOpen, closeStart)
            : text.slice(afterOpen, elseAt);
        const elseBody =
          elseAt === null
            ? null
            : text.slice(elseAt + elseTagLen, closeStart);
        return {
          start: blockStart,
          end: idx + full.length,
          condition,
          thenBody,
          elseBody,
        };
      }
    }
  }

  return null;
}

function resolveIfBlocks(
  text: string,
  values: PresetVariableValues,
): string {
  let current = text;
  for (let guard = 0; guard < 1000; guard += 1) {
    const block = findFirstIfBlock(current);
    if (!block) break;

    const takeThen = evaluateCondition(block.condition, values);
    const chosen = takeThen ? block.thenBody : (block.elseBody ?? "");
    const resolvedBranch = resolveIfBlocks(chosen, values);
    current =
      current.slice(0, block.start) +
      resolvedBranch +
      current.slice(block.end);
  }
  return current;
}

function resolveInlineMacros(
  text: string,
  values: PresetVariableValues,
): string {
  return text.replace(INLINE_MACRO_RE, (full, inner: string) => {
    const resolved = resolveInlineMacro(inner, values);
    return resolved === null ? full : resolved;
  });
}

/**
 * Resolve preset section templates: `{{if}}` / `{{else}}` / `{{/if}}`,
 * comparisons, `||` / `??`, then simple `{{var}}` substitution.
 */
export function resolveTemplate(
  text: string,
  values: PresetVariableValues = {},
): string {
  if (!text) return text;
  const withoutIf = resolveIfBlocks(text, values);
  return resolveInlineMacros(withoutIf, values);
}
