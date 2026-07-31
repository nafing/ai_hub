export type { Connection } from "./connections/types";
export type { ConnectionKind } from "./connections/constants";
export {
  defaultConnection,
  defaultImageConnection,
  defaultConnectionForKind,
} from "./connections/defaults";
export {
  CONNECTION_KINDS,
  CONNECTION_KIND_LABELS,
  SERVICE_TIERS,
  REASONING_EFFORTS,
  VERBOSITIES,
  type ServiceTier,
  type ReasoningEffort,
  type Verbosity,
} from "./connections/constants";
export { connectionKind, filterConnectionsByKind, connectionOptionLabel, buildConnectionSelectOptions, resolveDefaultConnectionId } from "./connections/helpers";
export type {
  CreateConnectionInput,
  UpdateConnectionInput,
  ConnectionListItem,
  OpenRouterModel,
  OpenRouterEndpoint,
  OpenRouterImageModel,
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
  CHAT_PRESET_CATEGORIES,
  GENERATOR_CATEGORIES,
  CHAT_SUMMARY_PRESET_CATEGORIES,
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
  normalizePreset,
  toPresetExport,
} from "./presets/defaults";
export {
  parsePresetJson,
  parsePresetImportFile,
  PresetImportError,
} from "./presets/import";
export {
  DEFAULT_PRESETS,
  type DefaultPresetDefinition,
} from "./presets/default-presets";
export {
  ROLEPLAY_FORMATTING_RULES,
  ROLEPLAY_FORMATTING_REMINDER,
  NSFW_CONTENT_RULES,
  NSFW_WRITING_RULES,
  CHARACTER_CARD_DIALOGUE_FORMAT_APPEND,
  CHARACTER_CARD_FORMATTED_FIELDS,
  CHARACTER_CARD_FORMATTED_TARGET_ALL,
  characterCardTargetNeedsProseMarkup,
} from "./presets/formatting-rules";
export type {
  CreatePresetInput,
  UpdatePresetInput,
  PresetListItem,
  NeedsPresetVariablesCommand,
} from "./presets/api";
export { NEEDS_PRESET_VARIABLES_CODE } from "./presets/api";
export {
  wrapSectionContent,
  substituteVariables,
  orderSections,
  clusterSectionsByGroup,
  buildPromptMessages,
  selectedVariableValues,
  unresolvedPresetVariables,
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
  PRESET_TEMPLATE_MACROS,
  PRESET_RUNTIME_VARIABLES,
  type PresetMacroEntry,
} from "./presets/macros";
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
  LlmToolCall,
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
  GeneratorPreset,
  GeneratorPresetPromptMode,
} from "./generator-presets/types";
export { GENERATOR_PRESET_PROMPT_MODES } from "./generator-presets/types";
export type {
  CreateGeneratorPresetInput,
  UpdateGeneratorPresetInput,
  GeneratorPresetListItem,
} from "./generator-presets/api";
export {
  defaultGeneratorPreset,
  defaultGeneratorPresetId,
} from "./generator-presets/defaults";
export {
  DEFAULT_GENERATOR_PRESETS,
  defaultGeneratorPresetIdForCategory,
  type DefaultGeneratorPresetDefinition,
} from "./generator-presets/default-generator-presets";
export {
  resolveGeneratorPresetPrompt,
  type GeneratorPresetPromptFields,
} from "./generator-presets/resolve-prompt";
export {
  shouldRunAgentByInterval,
  countAssistantMessages,
  resolveAgentPromptTemplate,
  resolveAgentRuntimeSettings,
  resolveAgentRunInterval,
  resolveAgentPromptTemplateId,
  fillAgentPromptTemplate,
  parseAgentTextRewrite,
  tryParseJsonObject,
  tryParseJsonValue,
  formatAgentInjectSections,
  agentAllowedForMode,
  isTextRewriteAgent,
} from "./agents/runtime";

export type {
  Character,
  CharacterBook,
  CharacterBookEntry,
  CharacterBookEntryPosition,
  CharacterCardData,
  CharacterCardV2,
  CharacterConvoBehaviorInsertion,
  CharacterGalleryImage,
  CharacterGalleryImageSource,
  CharacterVersion,
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
  defaultCharacterBookEntry,
  defaultCharacterCardData,
  normalizeAlternateGreetings,
  normalizeCharacterCardData,
  normalizeConvoBehaviorInsertion,
  applyConvoBehaviorToCharacterCard,
  resolveConvoPostHistoryBlock,
  toCharacterCardV2,
} from "./characters/defaults";
export {
  characterTalkativeness,
  setCharacterTalkativeness,
  DEFAULT_TALKATIVENESS,
} from "./characters/talkativeness";
export {
  createCharacterVersion,
  normalizeCharacterVersions,
  nextCharacterVersionLabel,
} from "./characters/versions";
export {
  parseCharacterCardJson,
  parseCharacterCardPng,
  parseCharacterImportFile,
  CharacterImportError,
  type ParsedCharacterImport,
} from "./characters/import";

export type { CharacterFolder } from "./character-folders/types";
export type {
  CreateCharacterFolderInput,
  UpdateCharacterFolderInput,
} from "./character-folders/api";
export {
  defaultCharacterFolder,
  normalizeCharacterFolder,
} from "./character-folders/defaults";

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
export {
  defaultPersona,
  normalizePersona,
  toPersonaExport,
} from "./personas/defaults";
export {
  parsePersonaJson,
  parsePersonaImportFile,
  PersonaImportError,
} from "./personas/import";

export type {
  Chat,
  ChatMode,
  ChatMessage,
  ChatMessageRole,
  ChatMessageAttachment,
  ChatMemoryChunk,
  ChatSettings,
  ChatAgentSetting,
  ChatAgentSettingsMap,
  GroupChatMode,
  GroupResponseOrder,
  RoleplayDmSource,
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
  GenerateChatImageInput,
  ChatListItem,
  ChatStreamEvent,
  PeekPromptResult,
  PeekPromptLoreHit,
} from "./chats/api";
export type {
  ChatSummaryEntry,
  GenerateChatSummaryInput,
  SummaryEntriesPatchBody,
} from "./chats/summary";
export {
  CHAT_SUMMARY_OUTPUT_TOKENS,
  DEFAULT_SUMMARY_RUN_INTERVAL,
  DEFAULT_SUMMARY_CONTEXT_SIZE,
  estimateChatSummaryTokens,
  normalizeChatSummaryEntries,
  compileChatSummaryEntries,
  appendChatSummaryEntry,
  createChatSummaryEntry,
  clampSummaryRunInterval,
  clampSummaryContextSize,
  clampSummaryMaxTokens,
  parseChatSummaryText,
  formatRoleplaySummaryChatLog,
  countUserMessagesAfterSummaryAnchor,
  selectRollingSummaryMessages,
  roleplaySummaryEnabled,
  SUMMARY_TAIL_MESSAGES,
  normalizeSummaryTailMessages,
  isMessageHiddenFromPrompt,
  computeSummaryHideIds,
  setMessagesHiddenFromPrompt,
  resolveEntryUnhideIds,
} from "./chats/summary";
export type {
  DaySummaryEntry,
  WeekSummaryEntry,
  ConversationSummaryFailureRecord,
  ConversationSummaryFailures,
  ConversationSummaryBackfillInput,
  ConversationSummaryBackfillResult,
  ConversationSummariesPatchBody,
} from "./chats/conversation-summary";
export {
  parseConversationDateKey,
  formatConversationDateKey,
  getConversationWeekMonday,
  weekRangeLabel,
  normalizeDaySummaries,
  normalizeWeekSummaries,
  normalizeConversationSummaryFailures,
  normalizePromptTimeZone,
  formatZonedConversationDate,
  formatZonedConversationTime,
  formatConversationSummaryBlock,
  formatConversationImportantMemoryBlock,
  collectConversationKeyDetailSections,
} from "./chats/conversation-summary";
export {
  defaultChatSettings,
  createChatMessage,
  primaryCharacterId,
  DEFAULT_CHAT_HISTORY_DEPTH,
  DEFAULT_CHAT_LOREBOOK_TOKEN_BUDGET,
  effectiveChatContextLimit,
} from "./chats/defaults";
export {
  normalizeInactiveCharacterIds,
  activeCharacterIds,
  isCharacterInactiveInChat,
} from "./chats/active-characters";
export {
  CONVERSATION_PRESENCE_STATUSES,
  CONVERSATION_SCHEDULE_DAYS,
  CONVERSATION_COMMAND_KEYS,
  toConversationScheduleWallClockDate,
  getCurrentStatus,
  getActiveStatusOverride,
  getEffectiveCurrentStatus,
  dailyCapFromTalkativeness,
  dailyCapForCharacter,
  busyDelayMsForStatus,
  inactivityThresholdMinutes,
  normalizeWeekSchedule,
  normalizeCharacterSchedules,
  normalizeStatusOverrides,
  normalizeAutonomousDailyBudget,
  emptyWeekSchedule,
  filterOnlineCharacterIds,
  type ConversationPresenceStatus,
  type ConversationStatusOverride,
  type ConversationMessageIntent,
  type ScheduleBlock,
  type DaySchedule,
  type WeekSchedule,
  type CharacterSchedules,
  type AutonomousDailyBudget,
  type CurrentConversationStatus,
  type ConversationCommandKey,
} from "./chats/conversation-presence";
export {
  parseConversationCommands,
  filterEnabledConversationCommands,
  buildConversationCommandsReminder,
  buildAboutMePromptBlock,
  isConversationCommandEnabled,
  type ConversationCommand,
} from "./chats/conversation-commands";
export {
  IMAGE_ASPECT_RATIOS,
  IMAGE_RESOLUTIONS,
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_RESOLUTION,
  IMAGE_ASPECT_RATIO_LABELS,
  IMAGE_RESOLUTION_LABELS,
  normalizeImageAspectRatio,
  normalizeImageResolution,
  type ImageAspectRatio,
  type ImageResolution,
} from "./chats/image-settings";
export {
  buildAwarenessBlock,
  buildConnectedParentChatBlock,
  recallLexicalMemories,
} from "./chats/conversation-awareness";
export {
  CONNECTED_NOTES_BUDGET_CHARS,
  CONNECTED_RECENT_MESSAGE_LIMIT,
  CONNECTED_MESSAGE_CHAR_LIMIT,
  pruneConnectedNotes,
  normalizeConnectedNotes,
  normalizeConnectedInfluences,
  parseConnectedSideEffectTags,
  parseOocTags,
  buildConnectedLinkedRoleplayBlock,
  buildConnectedLinkInstructions,
  buildConnectedInfluencesBlock,
  buildConnectedNotesBlock,
  buildConnectedOocInstruction,
} from "./chats/connected-chats";
export {
  CHAT_GENERATION_PARAMETER_SEND_KEYS,
  DEFAULT_CHAT_PARAMETER_SEND,
  normalizeChatGenerationParameters,
  resolveEffectiveChatGenerationParameters,
  connectionWithChatParameters,
  shouldSendChatParameter,
} from "./chats/generation-parameters";
export type {
  ChatGenerationParameterSendKey,
  ChatGenerationParameterSendMap,
  ChatGenerationParameters,
  EffectiveChatGenerationParameters,
} from "./chats/generation-parameters";
export {
  DEFAULT_IMPERSONATE_PROMPT,
  buildImpersonateInstruction,
} from "./chats/impersonate";
export {
  normalizeConnectedChatIds,
  addConnectedChatId,
  removeConnectedChatId,
} from "./chats/connected-chat-ids";
export {
  MEMORY_CHUNK_SIZE,
  normalizeChatMemoryChunks,
  appendPendingMemoryChunks,
  rebuildMemoryChunks,
  recallMemoryChunks,
  formatMemoryRecallBlock,
} from "./chats/memory-recall";
export {
  parseDirectMessageCommands,
  buildRoleplayDmCommandReminder,
  resolveRoleplayDmTarget,
  formatUnresolvedRoleplayDmFallback,
  replaceRoleplayDmCommandText,
  type DirectMessageCommand,
} from "./chats/roleplay-dm";
export {
  buildGroupChatRuntimeInstructions,
  buildConversationGroupOutputFormat,
  groupSpeakerTagsEnabled,
  shouldPrefixGroupHistorySpeakers,
  groupHistoryUsesSpeakerPrefix,
  isGroupChat as isGroupChatSettings,
} from "./chats/group-prompt";
export {
  parseGroupedSpeakerSegments,
  normalizeTextForMatch,
  type GroupedSegment,
  type SpeakerSegment,
} from "./chats/speaker-segments";
export { activeMessageText, formatChatHistoryMarker } from "./chats/history";
export {
  activeMessageAttachments,
  assignSwipeAttachments,
  removeSwipeAttachments,
  activeMessageCommandTags,
  assignSwipeCommandTags,
} from "./chats/attachments";
export {
  normalizeChatMessages,
  visibleChatMessages,
  visibleChatMessagesThrough,
  promptVisibleChatMessages,
  promptVisibleChatMessagesThrough,
  ancestorChatMessages,
  branchParentOf,
  chatMessageSubtreeIds,
  removeChatMessageSwipe,
  removeChatMessageSubtree,
} from "./chats/branches";
export { buildCharacterGreetingMessage } from "./chats/seed-messages";
export { imageApiPaths } from "./images/paths";
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
  getSlashCompletions,
  matchSlashCommand,
  executeSlashCommand,
  type ChatSlashMode,
  type SlashCommandDef,
  type SlashCommandAction,
  type SlashCommandContext,
  type SlashCommandResult,
} from "./chats/slash-commands";

export type {
  TwatterAccountKind,
  TwatterInteractionType,
  TwatterPostSource,
  TwatterParticipantSelectionMode,
  TwatterCarryoverTarget,
  TwatterAccountSocialSettings,
  TwatterAccountProfileSettings,
  TwatterAccountSettings,
  TwatterSettings,
  TwatterAccount,
  TwatterAuthorSnapshot,
  TwatterPoll,
  TwatterPollOption,
  TwatterPost,
  TwatterInteraction,
  TwatterDigestEntry,
  TwatterNotificationKind,
  TwatterNotification,
  TwatterRefreshSchedulerStatus,
  TwatterBootstrap,
} from "./twatter/types";
export {
  TWATTER_MAX_CONTENT,
  TWATTER_MAX_REPLY_CONTENT,
  TWATTER_FEED_LIMIT,
  TWATTER_CARRYOVER_TOKEN_BUDGET,
  DEFAULT_TWATTER_SETTINGS,
  TWATTER_RANDOM_USERS,
  twatterHandleFromName,
  normalizeTwatterHandle,
  defaultTwatterAccountSettings,
  normalizeTwatterSettings,
  mergeTwatterSettings,
  mergeAccountSocialSettings,
  accountSnapshot,
  normalizeTwatterContent,
  parseTwatterPollFromMetadata,
  buildTwatterPollMetadata,
  tryParseTwatterGeneratedRefresh,
  validateTwatterGeneratedRefresh,
  buildTwatterCarryoverBlock,
  modeAllowsTwatterCarryover,
  findTwatterTextMentions,
  extractTwatterMentionHandles,
  twatterTextMentionsHandle,
  TWATTER_REFRESH_SCHEDULE_VERSION,
  localScheduleDate,
  localScheduleTimezone,
  generateTwatterRefreshTimes,
  reconcileTwatterRefreshSchedule,
  dueTwatterRefreshTimes,
  nextTwatterRefreshTime,
  markTwatterRefreshAttempt,
  markTwatterRefreshSuccess,
  markTwatterRefreshFailure,
  twatterRefreshSchedulerStatus,
  buildTwatterNotifications,
  countUnreadTwatterNotifications,
  type PersistedTwatterRefreshSchedule,
  type TwatterGeneratedRefresh,
} from "./twatter";
export type {
  TwatterSettingsUpdateInput,
  TwatterInviteInput,
  TwatterBulkInviteInput,
  CreateTwatterPostInput,
  UpdateTwatterPostInput,
  CreateTwatterInteractionInput,
  RemoveTwatterInteractionInput,
  TwatterAccountProfileUpdateInput,
  TwatterFollowUpdateInput,
  TwatterRefreshInput,
  TwatterBootstrapResponse,
  TwatterTimelineTab,
  TwatterView,
  TwatterSearchResult,
  TwatterAccountProfile,
  TwatterNotificationsResponse,
  TwatterMarkNotificationsReadInput,
  TwatterSearchQuery,
} from "./twatter/api";
