import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type {
  Chat,
  ChatListItem,
  ChatStreamEvent,
} from "@ai-hub/shared";
import { ChatsService } from "./chats.service";
import { CreateChatDto } from "./dto/create-chat.dto";
import { CreateChatMessageDto } from "./dto/create-chat-message.dto";
import { GenerateChatDto } from "./dto/generate-chat.dto";
import { RegenerateChatDto } from "./dto/regenerate-chat.dto";
import { UpdateChatDto } from "./dto/update-chat.dto";
import { UpdateChatMessageDto } from "./dto/update-chat-message.dto";

@Controller("chats")
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

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
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.stream(reply, (emit) =>
      this.chatsService.generate(id, body, emit),
    );
  }

  @Post(":id/regenerate")
  async regenerate(
    @Param("id") id: string,
    @Body() body: RegenerateChatDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.stream(reply, (emit) =>
      this.chatsService.regenerate(id, emit, body.messageId),
    );
  }

  @Get(":id/peek-prompt")
  peekPrompt(
    @Param("id") id: string,
    @Query("messageId") messageId?: string,
  ) {
    return this.chatsService.peekPrompt(id, messageId);
  }

  private async stream(
    reply: FastifyReply,
    run: (emit: (event: ChatStreamEvent) => void) => Promise<void>,
  ): Promise<void> {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

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
