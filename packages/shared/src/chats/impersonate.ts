/**
 * Default impersonate prompt template (Marinara-compatible).
 * Empty chat override falls back to this.
 */
export const DEFAULT_IMPERSONATE_PROMPT = [
  `<instruction>`,
  `You are now writing as {{user}}, the user's character.`,
  `Study {{user}}'s previous messages in the conversation and replicate their voice, mannerisms, speech patterns, and style as closely as possible.`,
  `Character description: {{persona_description}}`,
  `Additional direction for this reply: {{impersonate_direction}}`,
  `Write a single in-character response from {{user}}'s perspective. Do NOT break character or add meta-commentary. Respond exactly as {{user}} would.`,
  `</instruction>`,
].join("\n");

function punctuateDirection(direction: string): string {
  const trimmed = direction.trim();
  if (!trimmed) return "";
  const last = trimmed[trimmed.length - 1];
  return last && ".!?)]}\"'".includes(last) ? trimmed : `${trimmed}.`;
}

function renderImpersonateTemplate(
  template: string,
  input: {
    direction: string;
    personaName: string;
    personaDescription: string;
  },
): string {
  const lineIsEmptyPlaceholderOnly = (line: string): boolean => {
    let stripped = line;
    let removedEmpty = false;
    if (!input.personaDescription && stripped.includes("{{persona_description}}")) {
      stripped = stripped.replaceAll("{{persona_description}}", "");
      removedEmpty = true;
    }
    if (!input.direction && stripped.includes("{{impersonate_direction}}")) {
      stripped = stripped.replaceAll("{{impersonate_direction}}", "");
      removedEmpty = true;
    }
    return (
      removedEmpty &&
      stripped.replaceAll("{{user}}", input.personaName).trim() === ""
    );
  };

  return template
    .split(/\r?\n/)
    .filter((line) => !lineIsEmptyPlaceholderOnly(line))
    .map((line) =>
      line
        .replaceAll("{{user}}", input.personaName)
        .replaceAll("{{persona_description}}", input.personaDescription)
        .replaceAll("{{impersonate_direction}}", input.direction),
    )
    .join("\n")
    .trim();
}

/** Build the impersonate instruction injected into the prompt. */
export function buildImpersonateInstruction(input: {
  /** Chat override; empty → built-in default. */
  customPrompt?: string | null;
  direction?: string | null;
  personaName?: string | null;
  personaDescription?: string | null;
}): string {
  const personaName = input.personaName?.trim() || "User";
  const personaDescription = input.personaDescription?.trim() || "";
  const direction = (input.direction ?? "").trim();
  const custom = (input.customPrompt ?? "").trim();

  if (custom && !custom.includes("{{") && !custom.includes("}}")) {
    // Plain instruction without macros: append direction if present.
    if (!direction) return custom;
    return `${custom} ${punctuateDirection(direction)}`.trim();
  }

  const template = custom || DEFAULT_IMPERSONATE_PROMPT;
  return renderImpersonateTemplate(template, {
    direction,
    personaName,
    personaDescription,
  });
}
