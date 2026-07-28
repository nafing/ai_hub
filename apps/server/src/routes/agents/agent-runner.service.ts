import { Injectable, Logger } from "@nestjs/common";
import {
  agentAllowedForMode,
  countAssistantMessages,
  fillAgentPromptTemplate,
  formatAgentInjectSections,
  formatChatHistoryMarker,
  isTextRewriteAgent,
  parseAgentTextRewrite,
  resolveAgentPromptTemplate,
  resolveAgentPromptTemplateId,
  resolveAgentRunInterval,
  resolveAgentRuntimeSettings,
  shouldRunAgentByInterval,
  toLlmToolDefinitions,
  tryParseJsonObject,
  tryParseJsonValue,
  type Agent,
  type Chat,
  type ChatMessage,
  type ChatSettings,
  type ChatStreamEvent,
  type Connection,
  type LlmChatMessage,
  type Lorebook,
  type LorebookEntry,
} from "@ai-hub/shared";
import { completeWithConnection } from "../../utils/openrouter";
import { LorebooksService } from "../lorebooks/lorebooks.service";
import { ToolExecutorService } from "../tools/tool-executor.service";
import { ToolsService } from "../tools/tools.service";
import { AgentsService } from "./agents.service";

export type AgentEmit = (event: ChatStreamEvent) => void;

export type AgentRunnerMutableState = {
  summary: string;
  agentState: Record<string, unknown>;
  messages: ChatMessage[];
};

export type AgentRunnerContext = {
  chat: Chat;
  settings: ChatSettings;
  connection: Connection;
  historyMessages: ChatMessage[];
  characterName?: string;
  userName?: string;
  /** Serialized character cards for card-evolution auditor. */
  characterCards?: string;
  lorebooks?: Lorebook[];
  /** Run Narrative Director in pre_generation. */
  runDirector?: boolean;
  emit?: AgentEmit;
  /** Live chat fields tools may mutate. */
  mutable?: AgentRunnerMutableState;
};

export type PreGenerationResult = {
  injectTexts: string[];
  agentStatePatch: Record<string, unknown>;
};

export type ParallelRunHandle = {
  promise: Promise<Record<string, unknown>>;
};

export type PostProcessingResult = {
  content: string;
  agentStatePatch: Record<string, unknown>;
};

/**
 * Chat agent pipeline:
 * pre_generation → (inject) → main + parallel → post_processing.
 *
 * Order and contracts are defined by built-in agent slugs in DEFAULT_AGENTS.
 */
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);
  private static readonly MAX_TOOL_ROUNDS = 6;

  constructor(
    private readonly agents: AgentsService,
    private readonly tools: ToolsService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly lorebooksService: LorebooksService,
  ) {}

  async loadSelectedAgents(input: {
    settings: ChatSettings;
    mode: Chat["mode"];
    historyMessages: ChatMessage[];
    runDirector?: boolean;
    parentChatId?: string | null;
  }): Promise<Agent[]> {
    const agentIds = input.settings.agent_ids ?? [];
    if (!agentIds.length) return [];

    const allAgents = await Promise.all(
      agentIds.map((agentId) => this.agents.findOne(agentId).catch(() => null)),
    );

    const assistantTurnNumber =
      countAssistantMessages(input.historyMessages) + 1;

    return allAgents.filter((agent): agent is Agent => {
      if (!agent || agent.runtime_disabled) return false;
      if (agent.execution !== "llm" && agent.execution !== "feature") {
        return false;
      }
      if (!agentAllowedForMode(agent, input.mode)) return false;
      if (agent.slug === "director" && !input.runDirector) return false;
      const interval = resolveAgentRunInterval(
        agent,
        input.settings.agent_settings,
      );
      return shouldRunAgentByInterval(interval, assistantTurnNumber);
    });
  }

  async runPreGeneration(
    ctx: AgentRunnerContext,
    selected: Agent[],
  ): Promise<PreGenerationResult> {
    const injectTexts: string[] = [];
    const agentStatePatch: Record<string, unknown> = {};

    const injectSections = formatAgentInjectSections(
      ctx.chat.agent_state ?? {},
      selected,
    );
    injectTexts.push(...injectSections);

    const preAgents = selected.filter(
      (agent) => agent.phase === "pre_generation",
    );

    for (const agent of preAgents) {
      this.emitPhase(ctx, agent, "pre_generation");
      try {
        if (agent.execution === "feature") {
          const state = await this.runFeatureAgent(agent, ctx);
          if (state !== undefined) agentStatePatch[agent.slug] = state;
        } else {
          const raw = await this.runAgentLlm(agent, ctx, {
            assistantResponse: "",
            phase: "pre_generation",
          });
          const handled = this.handlePreResult(agent, raw, ctx);
          if (handled.inject) injectTexts.push(handled.inject);
          if (handled.state !== undefined) {
            agentStatePatch[agent.slug] = handled.state;
          }
        }
        this.emitDone(ctx, agent, "pre_generation");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(`Pre agent ${agent.slug} failed: ${message}`);
        agentStatePatch[agent.slug] = { error: message };
        this.emitDone(ctx, agent, "pre_generation", message);
      }
    }

    return { injectTexts, agentStatePatch };
  }

  startParallel(
    ctx: AgentRunnerContext,
    selected: Agent[],
    assistantResponse: string,
  ): ParallelRunHandle {
    const parallelAgents = selected.filter(
      (agent) => agent.phase === "parallel",
    );

    const promise = (async () => {
      const patch: Record<string, unknown> = {};
      await Promise.all(
        parallelAgents.map(async (agent) => {
          this.emitPhase(ctx, agent, "parallel");
          try {
            if (agent.execution === "feature") {
              const state = await this.runFeatureAgent(agent, ctx);
              if (state !== undefined) patch[agent.slug] = state;
            } else {
              const raw = await this.runAgentLlm(agent, ctx, {
                assistantResponse,
                phase: "parallel",
              });
              patch[agent.slug] = tryParseJsonValue(raw) ?? { raw };
            }
            this.emitDone(ctx, agent, "parallel");
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            this.logger.warn(`Parallel agent ${agent.slug} failed: ${message}`);
            patch[agent.slug] = { error: message };
            this.emitDone(ctx, agent, "parallel", message);
          }
        }),
      );
      return patch;
    })();

    return { promise };
  }

  async runPostProcessing(
    ctx: AgentRunnerContext,
    selected: Agent[],
    content: string,
  ): Promise<PostProcessingResult> {
    let nextContent = content;
    const agentStatePatch: Record<string, unknown> = {};

    const featureAgents = selected.filter(
      (agent) =>
        agent.phase === "post_processing" && agent.execution === "feature",
    );
    for (const agent of featureAgents) {
      this.emitPhase(ctx, agent, "post_processing");
      try {
        const state = await this.runFeatureAgent(agent, ctx);
        if (state !== undefined) agentStatePatch[agent.slug] = state;
        this.emitDone(ctx, agent, "post_processing");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        agentStatePatch[agent.slug] = { error: message };
        this.emitDone(ctx, agent, "post_processing", message);
      }
    }

    const rewriteAgents = selected.filter(
      (agent) => agent.execution === "llm" && isTextRewriteAgent(agent),
    );
    for (const agent of rewriteAgents) {
      this.emitPhase(ctx, agent, "post_processing");
      try {
        const raw = await this.runAgentLlm(agent, ctx, {
          assistantResponse: nextContent,
          phase: "post_processing",
        });
        const rewritten = parseAgentTextRewrite(raw);
        if (rewritten) nextContent = rewritten;
        agentStatePatch[agent.slug] = tryParseJsonObject(raw) ?? {
          rewritten: Boolean(rewritten),
        };
        this.emitDone(ctx, agent, "post_processing");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(`Rewrite agent ${agent.slug} failed: ${message}`);
        agentStatePatch[agent.slug] = { error: message };
        this.emitDone(ctx, agent, "post_processing", message);
      }
    }

    const otherPost = selected.filter(
      (agent) =>
        agent.phase === "post_processing" &&
        agent.execution === "llm" &&
        !isTextRewriteAgent(agent),
    );

    await Promise.all(
      otherPost.map(async (agent) => {
        this.emitPhase(ctx, agent, "post_processing");
        try {
          const raw = await this.runAgentLlm(agent, ctx, {
            assistantResponse: nextContent,
            phase: "post_processing",
          });
          let state: unknown = tryParseJsonValue(raw) ?? { raw };
          if (agent.slug === "lorebook-keeper") {
            state = await this.applyLorebookKeeperUpdates(state, ctx);
          }
          if (agent.slug === "card-evolution-auditor") {
            state = this.normalizeCardEvolutionProposals(state);
          }
          agentStatePatch[agent.slug] = state;
          this.emitDone(ctx, agent, "post_processing");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(`Post agent ${agent.slug} failed: ${message}`);
          agentStatePatch[agent.slug] = { error: message };
          this.emitDone(ctx, agent, "post_processing", message);
        }
      }),
    );

    return { content: nextContent, agentStatePatch };
  }

  private handlePreResult(
    agent: Agent,
    raw: string,
    ctx: AgentRunnerContext,
  ): { inject?: string; state?: unknown } {
    if (agent.slug === "knowledge-router") {
      const parsed = tryParseJsonObject(raw);
      const entryIds = Array.isArray(parsed?.entryIds)
        ? (parsed.entryIds as unknown[]).map(String)
        : [];
      const content = this.resolveLoreEntriesByIds(ctx.lorebooks ?? [], entryIds);
      return {
        inject: content
          ? `<knowledge_router>\n${content}\n</knowledge_router>`
          : undefined,
        state: parsed ?? { raw, entryIds },
      };
    }

    if (agent.slug === "knowledge-retrieval") {
      const text = raw.trim();
      if (!text || /^no relevant information found\.?$/i.test(text)) {
        return { state: { raw: text } };
      }
      return {
        inject: `<knowledge_retrieval>\n${text}\n</knowledge_retrieval>`,
        state: { extracted: text },
      };
    }

    if (agent.slug === "director") {
      const parsed = tryParseJsonObject(raw);
      const direction =
        typeof parsed?.direction === "string" ? parsed.direction.trim() : "";
      return {
        inject: direction
          ? `<narrative_direction>\n${direction}\n</narrative_direction>`
          : undefined,
        state: parsed ?? { raw },
      };
    }

    const parsed = tryParseJsonValue(raw);
    return {
      inject: `<agent_pre slug="${agent.slug}">\n${raw.trim()}\n</agent_pre>`,
      state: parsed ?? { raw },
    };
  }

  private resolveLoreEntriesByIds(
    lorebooks: Lorebook[],
    entryIds: string[],
  ): string {
    if (!entryIds.length) return "";
    const chunks: string[] = [];
    const wanted = new Set(entryIds);

    for (const book of lorebooks) {
      book.entries.forEach((entry, index) => {
        const id = this.loreEntryId(book.id, entry, index);
        if (!wanted.has(id) && !wanted.has(String(entry.id ?? "")) && !wanted.has(entry.name ?? "")) {
          return;
        }
        const name = entry.name?.trim() || entry.keys?.[0] || id;
        const content = (entry.content ?? "").trim();
        if (!content) return;
        chunks.push(`### ${name}\n${content}`);
      });
    }
    return chunks.join("\n\n");
  }

  private loreEntryId(
    lorebookId: string,
    entry: LorebookEntry,
    index: number,
  ): string {
    if (entry.id != null) return `${lorebookId}:${entry.id}`;
    if (entry.name?.trim()) return `${lorebookId}:${entry.name.trim()}`;
    return `${lorebookId}:idx:${index}`;
  }

  private buildLoreCatalog(lorebooks: Lorebook[]): string {
    const lines: string[] = [];
    for (const book of lorebooks) {
      book.entries.forEach((entry, index) => {
        if (entry.enabled === false) return;
        const id = this.loreEntryId(book.id, entry, index);
        const name = entry.name?.trim() || entry.keys?.[0] || id;
        const keys = (entry.keys ?? []).join(", ");
        const snippet = (entry.content ?? "").trim().slice(0, 180);
        lines.push(
          `- id: ${id} | name: ${name} | keys: ${keys || "—"} | snippet: ${snippet}`,
        );
      });
    }
    return lines.join("\n") || "(no entries)";
  }

  private buildSourceMaterial(lorebooks: Lorebook[]): string {
    const chunks: string[] = [];
    for (const book of lorebooks) {
      for (const entry of book.entries) {
        if (entry.enabled === false) continue;
        const name = entry.name?.trim() || entry.keys?.[0] || "Entry";
        const content = (entry.content ?? "").trim();
        if (!content) continue;
        chunks.push(`### ${name}\n${content}`);
      }
    }
    return chunks.join("\n\n").slice(0, 24_000) || "(no source material)";
  }

  async runAgentLlm(
    agent: Agent,
    ctx: AgentRunnerContext,
    options: {
      assistantResponse: string;
      phase: Agent["phase"];
    },
  ): Promise<string> {
    const settings = resolveAgentRuntimeSettings(
      agent,
      ctx.settings.agent_settings,
    );
    const templateId = resolveAgentPromptTemplateId(
      agent,
      ctx.settings.agent_settings,
    );
    const template = resolveAgentPromptTemplate(agent, templateId);

    const stringSettings: Record<string, string> = {};
    for (const [key, value] of Object.entries(settings)) {
      if (value == null) continue;
      stringSettings[key] =
        typeof value === "string" ? value : JSON.stringify(value);
    }

    const filled = fillAgentPromptTemplate(template, {
      ...stringSettings,
      user: ctx.userName ?? "User",
      char: ctx.characterName ?? "Character",
      banned: stringSettings.banned ?? "",
      avoid: stringSettings.avoid ?? "",
      prefer: stringSettings.prefer ?? "",
      directorMode: stringSettings.directorMode ?? "natural",
    });

    const contextSize =
      typeof settings.contextSize === "number" && settings.contextSize > 0
        ? Math.floor(settings.contextSize)
        : 12;
    const historySlice = ctx.historyMessages.slice(-contextSize);
    const history = formatChatHistoryMarker(historySlice, {
      charName: ctx.characterName,
      userName: ctx.userName,
    });

    const parts = [
      filled,
      "",
      "<chat_history>",
      history || "(none)",
      "</chat_history>",
    ];

    if (options.assistantResponse.trim()) {
      parts.push(
        "",
        "<assistant_response>",
        options.assistantResponse,
        "</assistant_response>",
      );
    }

    parts.push(
      "",
      "<current_game_state>",
      JSON.stringify(ctx.chat.agent_state ?? {}, null, 2),
      "</current_game_state>",
    );

    if (agent.slug === "knowledge-retrieval") {
      parts.push(
        "",
        "<source_material>",
        this.buildSourceMaterial(ctx.lorebooks ?? []),
        "</source_material>",
      );
      const previous = ctx.chat.agent_state?.["knowledge-retrieval"];
      if (previous) {
        parts.push(
          "",
          "<previous_extracted>",
          typeof previous === "string"
            ? previous
            : JSON.stringify(previous, null, 2),
          "</previous_extracted>",
        );
      }
    }

    if (agent.slug === "knowledge-router") {
      parts.push(
        "",
        "<entry_catalog>",
        this.buildLoreCatalog(ctx.lorebooks ?? []),
        "</entry_catalog>",
      );
    }

    if (agent.slug === "card-evolution-auditor" && ctx.characterCards) {
      parts.push(
        "",
        "<character_cards>",
        ctx.characterCards,
        "</character_cards>",
      );
    }

    if (agent.slug === "cyoa") {
      const prev = ctx.chat.agent_state?.cyoa;
      if (prev) {
        parts.push(
          "",
          "<previous_cyoa_choices>",
          JSON.stringify(prev, null, 2),
          "</previous_cyoa_choices>",
        );
      }
    }

    if (agent.slug === "lorebook-keeper") {
      const existing = (ctx.lorebooks ?? [])
        .flatMap((book) =>
          book.entries.map((entry) => ({
            lorebook: book.name,
            name: entry.name,
            keys: entry.keys,
            content: (entry.content ?? "").slice(0, 400),
          })),
        )
        .slice(0, 80);
      parts.push(
        "",
        "<existing_entries>",
        JSON.stringify(existing, null, 2),
        "</existing_entries>",
        "",
        "<chat_summary>",
        ctx.chat.summary || "(none)",
        "</chat_summary>",
      );
    }

    const messages: LlmChatMessage[] = [
      { role: "user", content: parts.join("\n") },
    ];

    const toolDefs =
      agent.default_tools?.length > 0
        ? await this.tools.findByNames(agent.default_tools)
        : [];
    const llmTools = toLlmToolDefinitions(toolDefs);

    const maxTokens =
      typeof settings.maxTokens === "number" && settings.maxTokens > 0
        ? Math.floor(settings.maxTokens)
        : undefined;

    for (let round = 0; round < AgentRunnerService.MAX_TOOL_ROUNDS; round += 1) {
      const result = await completeWithConnection(ctx.connection, messages, {
        parseThinking: true,
        body: {
          stream: false,
          tools: llmTools.length ? llmTools : undefined,
          tool_choice: llmTools.length ? "auto" : undefined,
          overrides: {
            stream: false,
            ...(maxTokens ? { max_tokens: maxTokens } : {}),
          },
        },
      });

      if (!result.toolCalls.length) {
        return result.content || result.reply;
      }

      messages.push({
        role: "assistant",
        content: result.content || result.reply || "",
        tool_calls: result.toolCalls,
      });

      const mutable = ctx.mutable ?? {
        summary: ctx.chat.summary,
        agentState: { ...(ctx.chat.agent_state ?? {}) },
        messages: [...ctx.historyMessages],
      };
      ctx.mutable = mutable;

      for (const call of result.toolCalls) {
        const executed = await this.toolExecutor.execute(
          call.function.name,
          call.function.arguments,
          {
            chat: ctx.chat,
            settings: ctx.settings,
            lorebooks: ctx.lorebooks ?? [],
            summary: mutable.summary,
            agentState: mutable.agentState,
            messages: mutable.messages,
          },
        );
        if (executed.patch?.summary !== undefined) {
          mutable.summary = executed.patch.summary;
        }
        if (executed.patch?.agentState) {
          mutable.agentState = executed.patch.agentState;
          ctx.chat = { ...ctx.chat, agent_state: mutable.agentState };
        }
        if (executed.patch?.messages) {
          mutable.messages = executed.patch.messages;
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(
            executed.ok
              ? { ok: true, result: executed.result }
              : { ok: false, error: executed.error },
          ),
        });
      }
    }

    return "(agent tool loop exceeded max rounds)";
  }

  /**
   * Non-LLM agents (`execution: "feature"`). Register handlers by slug here.
   * Built-in seed currently has none; this keeps the pipeline ready.
   */
  private async runFeatureAgent(
    agent: Agent,
    _ctx: AgentRunnerContext,
  ): Promise<unknown> {
    switch (agent.slug) {
      case "feature-noop":
        return { ok: true, note: "feature noop handler" };
      default:
        return {
          skipped: true,
          reason: `No feature handler registered for slug "${agent.slug}"`,
        };
    }
  }

  private normalizeCardEvolutionProposals(state: unknown): unknown {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return state;
    }
    const record = state as Record<string, unknown>;
    const updates = Array.isArray(record.updates) ? record.updates : [];
    return {
      ...record,
      updates: updates.map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return item;
        }
        const update = item as Record<string, unknown>;
        return {
          ...update,
          id:
            typeof update.id === "string" && update.id
              ? update.id
              : `proposal-${index}`,
          status:
            update.status === "approved" || update.status === "dismissed"
              ? update.status
              : "pending",
        };
      }),
    };
  }

  private async applyLorebookKeeperUpdates(
    state: unknown,
    ctx: AgentRunnerContext,
  ): Promise<unknown> {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return state;
    }
    const record = state as Record<string, unknown>;
    const updates = Array.isArray(record.updates) ? record.updates : [];
    const target = ctx.lorebooks?.[0];
    if (!target) {
      return {
        ...record,
        warning: "No lorebook attached to this chat; updates were not applied",
        applied: [],
      };
    }

    const applied: string[] = [];
    let entries = [...target.entries];

    for (const item of updates) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const update = item as Record<string, unknown>;
      const action = String(update.action ?? "");
      const entryName = String(update.entryName ?? "").trim();
      if (!entryName) continue;

      const index = entries.findIndex(
        (entry) =>
          (entry.name ?? "").trim().toLowerCase() === entryName.toLowerCase(),
      );

      if (action === "update" && index >= 0) {
        const existing = entries[index]!;
        if (existing.extensions?.locked === true) continue;
        const newFacts = Array.isArray(update.newFacts)
          ? update.newFacts.map(String).filter(Boolean)
          : [];
        const replacement =
          typeof update.content === "string" && update.content.trim()
            ? update.content.trim()
            : null;
        const nextContent = replacement
          ? replacement
          : newFacts.length
            ? `${existing.content}\n${newFacts.join("\n")}`.trim()
            : existing.content;
        const keys = Array.isArray(update.keys)
          ? update.keys.map(String).filter(Boolean)
          : existing.keys;
        entries[index] = {
          ...existing,
          content: nextContent,
          keys: keys.length ? keys : existing.keys,
        };
        applied.push(`update:${entryName}`);
      } else if (action === "create") {
        if (index >= 0) continue;
        const content =
          typeof update.content === "string" ? update.content.trim() : "";
        if (!content) continue;
        const keys = Array.isArray(update.keys)
          ? update.keys.map(String).filter(Boolean)
          : [entryName];
        entries.push({
          keys,
          content,
          extensions: {},
          enabled: true,
          insertion_order: 100 + entries.length,
          name: entryName,
          comment:
            typeof update.tag === "string" ? update.tag : undefined,
        });
        applied.push(`create:${entryName}`);
      }
    }

    if (applied.length) {
      await this.lorebooksService.update(target.id, { entries });
      if (ctx.lorebooks) {
        const refreshed = await this.lorebooksService.findOne(target.id);
        ctx.lorebooks = ctx.lorebooks.map((book) =>
          book.id === target.id ? refreshed : book,
        );
      }
    }

    return { ...record, applied };
  }

  private emitPhase(
    ctx: AgentRunnerContext,
    agent: Agent,
    phase: Agent["phase"],
  ): void {
    ctx.emit?.({
      type: "agent_phase",
      phase,
      slug: agent.slug,
      name: agent.name,
    });
  }

  private emitDone(
    ctx: AgentRunnerContext,
    agent: Agent,
    phase: Agent["phase"],
    error?: string,
  ): void {
    ctx.emit?.({
      type: "agent_done",
      phase,
      slug: agent.slug,
      name: agent.name,
      ...(error ? { error } : {}),
    });
  }
}
