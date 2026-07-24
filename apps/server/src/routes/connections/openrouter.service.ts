import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import type { OpenRouterEndpoint, OpenRouterModel } from "@ai-hub/shared";
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
}
