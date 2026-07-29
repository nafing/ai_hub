import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import type {
  OpenRouterEndpoint,
  OpenRouterImageModel,
  OpenRouterModel,
} from "@ai-hub/shared";
import {
  OPENROUTER_BASE,
  openRouterGetJson,
} from "../../utils/openrouter";

type OpenRouterModelsResponse = {
  data?: Array<{
    id?: string;
    canonical_slug?: string;
    name?: string;
    context_length?: number | null;
    top_provider?: { max_completion_tokens?: number | null } | null;
    supported_parameters?: string[] | null;
    links?: { details?: string | null } | null;
  }>;
};

type OpenRouterEndpointsResponse = {
  data?: {
    endpoints?: Array<{
      provider_name?: string;
      name?: string;
    }>;
  };
};

type OpenRouterImageModelsResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    supported_parameters?: string[] | null;
  }>;
};

type OpenRouterImageEndpointsResponse = {
  data?: {
    endpoints?: Array<{
      provider_name?: string;
      name?: string;
    }>;
  };
};

function splitImageModelId(modelId: string): { author: string; slug: string } {
  const trimmed = modelId.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash >= trimmed.length - 1) {
    throw new BadRequestException(
      `Invalid image model id "${modelId}". Expected author/slug.`,
    );
  }
  return {
    author: trimmed.slice(0, slash),
    slug: trimmed.slice(slash + 1),
  };
}

@Injectable()
export class OpenRouterService {
  async fetchModels(apiKey: string): Promise<OpenRouterModel[]> {
    const payload = await openRouterGetJson<OpenRouterModelsResponse>(
      `${OPENROUTER_BASE}/models`,
      apiKey,
    );
    return (payload.data ?? [])
      .filter((model): model is { id: string } & typeof model =>
        Boolean(model.id),
      )
      .map((model) => ({
        id: model.id,
        canonical_slug: model.canonical_slug ?? model.id,
        name: model.name ?? model.id,
        context_length: model.context_length ?? null,
        max_completion_tokens:
          model.top_provider?.max_completion_tokens ?? null,
        supported_parameters: model.supported_parameters ?? [],
      }));
  }

  async fetchEndpoints(
    apiKey: string,
    modelId: string,
  ): Promise<OpenRouterEndpoint[]> {
    // Endpoints are keyed by canonical_slug (e.g. deepseek/deepseek-v4-flash-20260423),
    // not the chat alias id (deepseek/deepseek-v4-flash).
    const models = await this.fetchModels(apiKey);
    const match = models.find(
      (model) => model.id === modelId || model.canonical_slug === modelId,
    );
    const slug = match?.canonical_slug ?? modelId;
    const path = slug
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const payload = await openRouterGetJson<OpenRouterEndpointsResponse>(
      `${OPENROUTER_BASE}/models/${path}/endpoints`,
      apiKey,
    );
    return (payload.data?.endpoints ?? [])
      .map((endpoint) => ({
        provider: endpoint.provider_name ?? "",
        name: endpoint.name ?? endpoint.provider_name ?? "",
      }))
      .filter((endpoint) => endpoint.provider);
  }

  async fetchImageModels(apiKey: string): Promise<OpenRouterImageModel[]> {
    const payload = await openRouterGetJson<OpenRouterImageModelsResponse>(
      `${OPENROUTER_BASE}/images/models`,
      apiKey,
    );
    return (payload.data ?? [])
      .filter((model): model is { id: string } & typeof model =>
        Boolean(model.id),
      )
      .map((model) => ({
        id: model.id,
        name: model.name ?? model.id,
        supported_parameters: model.supported_parameters ?? [],
      }));
  }

  async fetchImageEndpoints(
    apiKey: string,
    modelId: string,
  ): Promise<OpenRouterEndpoint[]> {
    const { author, slug } = splitImageModelId(modelId);
    const path = [author, slug]
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const payload = await openRouterGetJson<OpenRouterImageEndpointsResponse>(
      `${OPENROUTER_BASE}/images/models/${path}/endpoints`,
      apiKey,
    );
    return (payload.data?.endpoints ?? [])
      .map((endpoint) => ({
        provider: endpoint.provider_name ?? "",
        name: endpoint.name ?? endpoint.provider_name ?? "",
      }))
      .filter((endpoint) => endpoint.provider);
  }
}
