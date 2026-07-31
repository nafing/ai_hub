import type {
  NeedsPresetVariablesCommand,
  Variable,
} from "@ai-hub/shared";
import { NEEDS_PRESET_VARIABLES_CODE } from "@ai-hub/shared";
import { isAxiosError } from "axios";

/** Parse Nest 409 `needs_preset_variables` command from an axios error. */
export function extractNeedsPresetVariables(
  error: unknown,
): NeedsPresetVariablesCommand | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;
  const data = error.response.data as unknown;
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  const nested =
    record.message && typeof record.message === "object"
      ? (record.message as Record<string, unknown>)
      : null;

  for (const candidate of [record, nested]) {
    if (!candidate || typeof candidate !== "object") continue;
    const cmd = candidate as Partial<NeedsPresetVariablesCommand>;
    if (
      cmd.code === NEEDS_PRESET_VARIABLES_CODE &&
      typeof cmd.presetId === "string" &&
      cmd.presetId &&
      Array.isArray(cmd.variables) &&
      cmd.variables.every(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof (item as Variable).variable_name === "string",
      )
    ) {
      return {
        code: NEEDS_PRESET_VARIABLES_CODE,
        presetId: cmd.presetId,
        variables: cmd.variables as Variable[],
      };
    }
  }
  return null;
}
