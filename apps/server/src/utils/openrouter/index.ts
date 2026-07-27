export {
  OPENROUTER_BASE,
  openRouterGetJson,
  openRouterChatCompletion,
  type OpenRouterChatChoice,
  type OpenRouterChatResponse,
  type OpenRouterChatResult,
  type OpenRouterRequestOptions,
  type OpenRouterStreamHandlers,
} from "./client";
export {
  completeWithConnection,
  completeWithConnectionAndPreset,
  type CompleteWithConnectionOptions,
  type CompleteWithConnectionResult,
} from "./complete";
export { embedTexts, type OpenRouterEmbeddingResponse } from "./embeddings";
