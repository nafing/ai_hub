export type { Connection } from "./connections/types";
export { defaultConnection } from "./connections/defaults";
export {
  SERVICE_TIERS,
  REASONING_EFFORTS,
  VERBOSITIES,
  type ServiceTier,
  type ReasoningEffort,
  type Verbosity,
} from "./connections/constants";
export type {
  CreateConnectionInput,
  UpdateConnectionInput,
  ConnectionListItem,
  OpenRouterModel,
  OpenRouterEndpoint,
} from "./connections/api";
export {
  buildOpenRouterBody,
  applyAssistantPrefill,
  withPromptCaching,
  type OpenRouterChatMessage,
  type OpenRouterChatBody,
  type BuildOpenRouterBodyOptions,
} from "./connections/build-openrouter-body";

export type {
  Preset,
  WrapFormat,
  PresetCategory,
  Section,
  SectionRole,
  SectionKind,
  Variable,
  VariablePresentation,
  VariableOption,
} from "./presets/types";
export {
  WRAP_FORMATS,
  PRESET_CATEGORIES,
  GENERATOR_CATEGORIES,
  PRESET_CATEGORY_LABELS,
  SECTION_ROLES,
  SECTION_KINDS,
  SECTION_KIND_LABELS,
  SECTION_MARKER_KINDS,
  VARIABLE_PRESENTATIONS,
  isSectionMarker,
  type GeneratorCategory,
} from "./presets/constants";
export {
  defaultPreset,
  defaultPresetId,
  defaultSection,
  createSectionFromKind,
  defaultVariable,
  defaultVariableOption,
} from "./presets/defaults";
export {
  DEFAULT_PRESETS,
  type DefaultPresetDefinition,
} from "./presets/default-presets";
export type {
  CreatePresetInput,
  UpdatePresetInput,
  PresetListItem,
} from "./presets/api";
export {
  wrapSectionContent,
  substituteVariables,
  orderSections,
  clusterSectionsByGroup,
  buildPromptMessages,
  selectedVariableValues,
  type PresetVariableValues,
  type PresetMarkerContent,
  type BuildPromptOptions,
} from "./presets/build-prompt";
export {
  resolveTemplate,
  evaluateCondition,
  isTruthy,
  lookupVar,
  resolveInlineMacro,
} from "./presets/template";
export {
  formatCharacterInfoMarker,
  formatDialogueExamplesMarker,
  formatPersonaMarker,
  formatReferenceCharactersMarker,
  formatLorebookMarker,
  buildPresetPromptContext,
  type BuildPresetPromptContextOptions,
} from "./presets/prompt-context";

export type {
  ChatMessage as LlmChatMessage,
  ChatMessageRole as LlmChatMessageRole,
} from "./llm/types";
export { extractThinking } from "./llm/extract-thinking";

export type {
  RegexScript,
  RegexTarget,
  RegexApplyTo,
  RegexScope,
} from "./regexes/types";
export {
  REGEX_TARGETS,
  REGEX_APPLY_TO,
  REGEX_SCOPES,
  REGEX_TARGET_LABELS,
  REGEX_APPLY_TO_LABELS,
  REGEX_SCOPE_LABELS,
  REGEX_APPLY_TIMEOUT_MS,
} from "./regexes/constants";
export { defaultRegexScript } from "./regexes/defaults";
export type {
  CreateRegexScriptInput,
  UpdateRegexScriptInput,
  RegexScriptListItem,
} from "./regexes/api";
export {
  isUnsafeRegexPattern,
  compileRegexScript,
  sortRegexScripts,
  applyRegexScriptToText,
  applyRegexScriptsToText,
  applyRegexScriptsToMessages,
  applyRegexScriptsToPromptMessages,
  applyRegexScriptsToDisplayMessages,
  type RegexMessageRole,
  type RegexApplyMessage,
  type ApplyRegexScriptsOptions,
  type RegexApplySkipReason,
  type RegexApplyReport,
} from "./regexes/apply";

export type {
  Tool,
  ToolDefinition,
  ToolParameters,
  ToolParameterProperty,
  LlmToolDefinition,
} from "./tools/types";
export { defaultTool, emptyToolParameters, defaultToolId } from "./tools/defaults";
export type {
  CreateToolInput,
  UpdateToolInput,
  ToolListItem,
} from "./tools/api";
export {
  toLlmToolDefinition,
  toLlmToolDefinitions,
  isValidToolName,
} from "./tools/llm";
export { DEFAULT_TOOLS } from "./tools/default-tools";
export {
  parseToolParametersJson,
  formatToolParametersJson,
  countToolParameters,
} from "./tools/parameters";

export type {
  Agent,
  AgentDefinition,
  AgentPhase,
  AgentCategory,
  AgentResultType,
  AgentExecution,
  AgentPromptTemplate,
} from "./agents/types";
export {
  defaultAgent,
  defaultAgentId,
  slugifyAgentName,
  isValidAgentSlug,
  AGENT_PHASES,
  AGENT_CATEGORIES,
  AGENT_EXECUTIONS,
} from "./agents/defaults";
export type {
  CreateAgentInput,
  UpdateAgentInput,
  AgentListItem,
} from "./agents/api";
export { DEFAULT_AGENTS } from "./agents/default-agents";

export type {
  Character,
  CharacterBook,
  CharacterBookEntry,
  CharacterBookEntryPosition,
  CharacterCardData,
  CharacterCardV2,
} from "./characters/types";
export {
  CHARA_CARD_SPEC,
  CHARA_CARD_SPEC_VERSION,
} from "./characters/types";
export type {
  CreateCharacterInput,
  UpdateCharacterInput,
  CharacterListItem,
} from "./characters/api";
export {
  defaultCharacter,
  defaultCharacterBook,
  defaultCharacterBookEntry,
  defaultCharacterCardData,
  normalizeAlternateGreetings,
  normalizeCharacterCardData,
  toCharacterCardV2,
} from "./characters/defaults";
export {
  characterTalkativeness,
  setCharacterTalkativeness,
  DEFAULT_TALKATIVENESS,
} from "./characters/talkativeness";
export {
  parseCharacterCardJson,
  parseCharacterCardPng,
  parseCharacterImportFile,
  CharacterImportError,
  type ParsedCharacterImport,
} from "./characters/import";

export type {
  Lorebook,
  LorebookCategory,
  LorebookEntry,
  LorebookEntryPosition,
} from "./lorebooks/types";
export type {
  CreateLorebookInput,
  UpdateLorebookInput,
  LorebookListItem,
} from "./lorebooks/api";
export {
  LOREBOOK_ENTRY_POSITIONS,
  LOREBOOK_CATEGORIES,
  LOREBOOK_CATEGORY_LABELS,
  DEFAULT_LOREBOOK_SCAN_DEPTH,
  DEFAULT_LOREBOOK_TOKEN_BUDGET,
  defaultLorebook,
  defaultLorebookEntry,
  normalizeLorebook,
  normalizeLorebookCategory,
  normalizeLorebookEntry,
  lorebookFromCharacterBook,
  toCharacterBook,
} from "./lorebooks/defaults";
export {
  parseLorebookJson,
  parseLorebookImportFile,
  LorebookImportError,
} from "./lorebooks/import";

export type { Persona } from "./personas/types";
export type {
  CreatePersonaInput,
  UpdatePersonaInput,
  PersonaListItem,
} from "./personas/api";
export { defaultPersona, normalizePersona } from "./personas/defaults";

export type {
  Chat,
  ChatMode,
  ChatMessage,
  ChatMessageRole,
  ChatSettings,
  GroupChatMode,
  GroupResponseOrder,
} from "./chats/types";
export {
  CHAT_MODES,
  CHAT_MODE_LABELS,
  GROUP_CHAT_MODES,
  GROUP_CHAT_MODE_LABELS,
  GROUP_RESPONSE_ORDERS,
  GROUP_RESPONSE_ORDER_LABELS,
} from "./chats/types";
export type {
  CreateChatInput,
  UpdateChatInput,
  CreateChatMessageInput,
  UpdateChatMessageInput,
  GenerateChatInput,
  ChatListItem,
  ChatStreamEvent,
  PeekPromptResult,
} from "./chats/api";
export {
  defaultChatSettings,
  defaultChatCreateInput,
  createChatMessage,
  primaryCharacterId,
} from "./chats/defaults";
export { activeMessageText, formatChatHistoryMarker } from "./chats/history";
export {
  parseMesExample,
  resolveGreetingSwipes,
  buildCharacterGreetingMessage,
} from "./chats/seed-messages";
export type { MesExampleTurn } from "./chats/seed-messages";
export {
  parseMentions,
  parseSlashCommand,
  resolveSpeakerQueue,
  fallbackSpeakerId,
  isGroupChat,
  formatSmartCandidate,
  formatRecentHistoryForSmart,
  parseSmartSpeakerIds,
  type SlashCommand,
  type SpeakerQueueResult,
  type SpeakerTurn,
} from "./chats/group-chat";
export {
  getAvailableSlashCommands,
  getSlashCompletions,
  matchSlashCommand,
  executeSlashCommand,
  type ChatSlashMode,
  type SlashCommandDef,
  type SlashCommandAction,
  type SlashCommandContext,
  type SlashCommandResult,
} from "./chats/slash-commands";
