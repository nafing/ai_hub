import {
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { OPENROUTER_BASE } from "./client";

export type OpenRouterEmbeddingResponse = {
  data?: Array<{ embedding?: number[]; index?: number }>;
  model?: string;
  error?: { message?: string; code?: string | number };
};

/**
 * Embed one or more texts via OpenRouter `/embeddings`.
 * Returns vectors in the same order as `texts`.
 */
export async function embedTexts(
  apiKey: string,
  model: string,
  texts: string[],
): Promise<number[][]> {
  if (!apiKey.trim()) {
    throw new BadRequestException("OpenRouter API key is required for embeddings");
  }
  if (!model.trim()) {
    throw new BadRequestException("Embedding model is required");
  }
  if (texts.length === 0) return [];

  const response = await fetch(`${OPENROUTER_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: texts.length === 1 ? texts[0] : texts,
    }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new UnauthorizedException("OpenRouter rejected the API key");
  }

  const raw = (await response.json()) as OpenRouterEmbeddingResponse;
  if (!response.ok) {
    throw new BadRequestException(
      raw.error?.message || `OpenRouter embeddings failed (${response.status})`,
    );
  }

  const rows = [...(raw.data ?? [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
  if (rows.length !== texts.length) {
    throw new BadRequestException(
      `OpenRouter returned ${rows.length} embeddings for ${texts.length} inputs`,
    );
  }

  return rows.map((row, index) => {
    const vector = row.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new BadRequestException(`Missing embedding for input ${index}`);
    }
    return vector;
  });
}
