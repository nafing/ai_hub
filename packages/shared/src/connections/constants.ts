export const SERVICE_TIERS = ["", "default", "flex", "priority"] as const;
export type ServiceTier = (typeof SERVICE_TIERS)[number];

export const REASONING_EFFORTS = [
  "",
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "maximum",
] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const VERBOSITIES = ["", "none", "low", "medium", "high"] as const;
export type Verbosity = (typeof VERBOSITIES)[number];
