import type { Connection } from "./types";

export type CreateConnectionInput = Omit<Connection, "id">;

export type UpdateConnectionInput = Partial<CreateConnectionInput>;

export type ConnectionListItem = Omit<Connection, "api_key"> & {
  has_api_key: boolean;
};

export type OpenRouterModel = {
  /** Model id used in chat completions (may be an alias). */
  id: string;
  /** Permanent slug used by OpenRouter `/models/{slug}/endpoints`. */
  canonical_slug: string;
  name: string;
  context_length: number | null;
  max_completion_tokens: number | null;
  supported_parameters: string[];
};

export type OpenRouterEndpoint = {
  provider: string;
  name: string;
};

export type OpenRouterImageModel = {
  /** Model slug used in POST /images (e.g. bytedance-seed/seedream-4.5). */
  id: string;
  name: string;
  supported_parameters: string[];
};
