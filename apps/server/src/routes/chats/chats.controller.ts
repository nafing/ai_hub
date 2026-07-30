import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  BadRequestException,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  Chat,
  ChatListItem,
  ChatMessageAttachment,
  ChatStreamEvent,
  ConversationSummariesPatchBody,
  ConversationSummaryBackfillInput,
  GenerateChatSummaryInput,
  SummaryEntriesPatchBody,
} from "@ai-hub/shared";
import { ChatSummaryService } from "./chat-summary.service";
import { ChatsService } from "./chats.service";
import { ConversationSummaryService } from "./conversation-summary.service";
import { CreateChatDto } from "./dto/create-chat.dto";
import { CreateChatMessageDto } from "./dto/create-chat-message.dto";
import { GenerateChatDto } from "./dto/generate-chat.dto";
import { GenerateChatImageDto } from "./dto/generate-chat-image.dto";
import { RegenerateChatDto } from "./dto/regenerate-chat.dto";
import { UpdateChatDto } from "./dto/update-chat.dto";
import { UpdateChatMessageDto } from "./dto/update-chat-message.dto";
import { AgentProposalActionDto } from "./dto/agent-proposal.dto";

@Controller("chats")
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly chatSummaryService: ChatSummaryService,
    private readonly conversationSummaryService: ConversationSummaryService,
  ) {}

  @Get()
  findAll(): Promise<ChatListItem[]> {
    return this.chatsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<Chat> {
    return this.chatsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateChatDto): Promise<Chat> {
    return this.chatsService.create(body);
  }

  @Post(":id/character-dms/:characterId")
  getOrCreateCharacterDm(
    @Param("id") id: string,
    @Param("characterId") characterId: string,
  ): Promise<Chat> {
    return this.chatsService.getOrCreateCharacterDm(id, characterId);
  }

  @Post(":id/connect")
  connect(
    @Param("id") id: string,
    @Body() body: { target_chat_id?: string },
  ): Promise<Chat> {
    const target = body?.target_chat_id?.trim();
    if (!target) {
      throw new BadRequestException("target_chat_id is required");
    }
    return this.chatsService.connectChats(id, target);
  }

  @Post(":id/disconnect")
  disconnect(
    @Param("id") id: string,
    @Body() body: { target_chat_id?: string },
  ): Promise<Chat> {
    const target = body?.target_chat_id?.trim();
    return this.chatsService.disconnectChat(id, target || undefined);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateChatDto,
  ): Promise<Chat> {
    return this.chatsService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.chatsService.remove(id);
    return { ok: true };
  }

  @Post(":id/messages")
  addMessage(
    @Param("id") id: string,
    @Body() body: CreateChatMessageDto,
  ): Promise<Chat> {
    return this.chatsService.addMessage(id, body);
  }

  @Post(":id/attachments")
  async uploadAttachment(
    @Param("id") id: string,
    @Req() req: FastifyRequest,
  ): Promise<ChatMessageAttachment> {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("Expected multipart file field");
    }
    const buffer = await file.toBuffer();
    return this.chatsService.uploadAttachment(id, {
      buffer,
      mime: file.mimetype || "application/octet-stream",
      name: file.filename || "attachment",
    });
  }

  @Get(":id/attachments/:attachmentId")
  getAttachment(
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    return this.chatsService.getAttachmentStream(id, attachmentId);
  }

  @Patch(":id/messages/:messageId")
  updateMessage(
    @Param("id") id: string,
    @Param("messageId") messageId: string,
    @Body() body: UpdateChatMessageDto,
  ): Promise<Chat> {
    return this.chatsService.updateMessage(id, messageId, body);
  }

  @Delete(":id/messages/:messageId")
  removeMessage(
    @Param("id") id: string,
    @Param("messageId") messageId: string,
  ): Promise<Chat> {
    return this.chatsService.removeMessage(id, messageId);
  }

  @Post(":id/generate")
  async generate(
    @Param("id") id: string,
    @Body() body: GenerateChatDto,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.stream(request, reply, (emit) =>
      this.chatsService.generate(id, body, emit),
    );
  }

  @Post(":id/regenerate")
  async regenerate(
    @Param("id") id: string,
    @Body() body: RegenerateChatDto,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.stream(request, reply, (emit) =>
      this.chatsService.regenerate(id, emit, body.messageId),
    );
  }

  @Post(":id/generate-image")
  generateImage(
    @Param("id") id: string,
    @Body() body: GenerateChatImageDto,
  ): Promise<Chat> {
    return this.chatsService.generateImage(id, body);
  }

  @Get(":id/peek-prompt")
  peekPrompt(
    @Param("id") id: string,
    @Query("messageId") messageId?: string,
  ) {
    return this.chatsService.peekPrompt(id, messageId);
  }

  @Post(":id/agent-proposals/apply")
  applyAgentProposal(
    @Param("id") id: string,
    @Body() body: AgentProposalActionDto,
  ): Promise<Chat> {
    return this.chatsService.applyAgentProposal(id, body);
  }

  @Post(":id/agent-proposals/dismiss")
  dismissAgentProposal(
    @Param("id") id: string,
    @Body() body: AgentProposalActionDto,
  ): Promise<Chat> {
    return this.chatsService.dismissAgentProposal(id, body);
  }

  @Post(":id/generate-summary")
  generateSummary(
    @Param("id") id: string,
    @Body() body: GenerateChatSummaryInput,
  ): Promise<Chat> {
    return this.chatSummaryService.generateSummary(id, body);
  }

  @Patch(":id/summary-entries")
  patchSummaryEntries(
    @Param("id") id: string,
    @Body() body: SummaryEntriesPatchBody,
  ): Promise<Chat> {
    return this.chatSummaryService.patchSummaryEntries(id, body);
  }

  @Patch(":id/summaries")
  patchConversationSummaries(
    @Param("id") id: string,
    @Body() body: ConversationSummariesPatchBody,
  ): Promise<Chat> {
    return this.conversationSummaryService.patchSummaries(id, body);
  }

  @Post(":id/backfill-summaries")
  backfillConversationSummaries(
    @Param("id") id: string,
    @Body() body: ConversationSummaryBackfillInput,
  ) {
    return this.conversationSummaryService.backfillSummaries(id, body);
  }

  @Get(":id/memories")
  listMemories(@Param("id") id: string) {
    return this.chatsService.listMemoryChunks(id);
  }

  @Post(":id/memories/rebuild")
  rebuildMemories(@Param("id") id: string): Promise<Chat> {
    return this.chatsService.rebuildChatMemories(id);
  }

  @Delete(":id/memories")
  clearMemories(@Param("id") id: string): Promise<Chat> {
    return this.chatsService.clearChatMemories(id);
  }

  @Patch(":id/memories/:chunkId")
  updateMemory(
    @Param("id") id: string,
    @Param("chunkId") chunkId: string,
    @Body() body: { content?: string },
  ): Promise<Chat> {
    return this.chatsService.updateMemoryChunk(
      id,
      chunkId,
      body.content ?? "",
    );
  }

  @Delete(":id/memories/:chunkId")
  deleteMemory(
    @Param("id") id: string,
    @Param("chunkId") chunkId: string,
  ): Promise<Chat> {
    return this.chatsService.deleteMemoryChunk(id, chunkId);
  }

  @Post(":id/memories/import")
  importMemories(
    @Param("id") id: string,
    @Body() body: { chunks?: unknown; replace?: boolean },
  ): Promise<Chat> {
    return this.chatsService.importMemoryChunks(
      id,
      body.chunks ?? [],
      Boolean(body.replace),
    );
  }

  private async stream(
    request: FastifyRequest,
    reply: FastifyReply,
    run: (emit: (event: ChatStreamEvent) => void) => Promise<void>,
  ): Promise<void> {
    // reply.raw bypasses @fastify/cors — Capacitor WebView fetch needs these.
    reply.hijack();

    const originHeader = request.headers.origin;
    const origin =
      typeof originHeader === "string" && originHeader.trim()
        ? originHeader
        : "*";

    const headers: Record<string, number | string | string[]> = {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "Content-Type, Accept, Authorization, X-Requested-With, Origin",
      "Access-Control-Expose-Headers": "Content-Disposition",
    };
    if (origin !== "*") {
      headers["Access-Control-Allow-Credentials"] = "true";
      headers.Vary = "Origin";
    }

    reply.raw.writeHead(200, headers);

    const emit = (event: ChatStreamEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      await run(emit);
    } catch (error) {
      emit({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      reply.raw.end();
    }
  }
}
