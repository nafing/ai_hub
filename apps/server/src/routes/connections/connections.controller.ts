import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import type { Connection, ConnectionListItem } from "@ai-hub/shared";
import { ConnectionsService } from "./connections.service";
import { OpenRouterService } from "./openrouter.service";
import { CreateConnectionDto } from "./dto/create-connection.dto";
import { UpdateConnectionDto } from "./dto/update-connection.dto";

@Controller("connections")
export class ConnectionsController {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly openRouterService: OpenRouterService,
  ) {}

  @Get()
  findAll(): Promise<ConnectionListItem[]> {
    return this.connectionsService.findAll();
  }

  @Get("openrouter/models")
  async listModels(
    @Query("apiKey") apiKey?: string,
    @Query("connectionId") connectionId?: string,
  ) {
    const key = await this.resolveApiKey(apiKey, connectionId);
    return this.openRouterService.fetchModels(key);
  }

  @Get("openrouter/endpoints")
  async listEndpoints(
    @Query("modelId") modelId?: string,
    @Query("apiKey") apiKey?: string,
    @Query("connectionId") connectionId?: string,
  ) {
    if (!modelId?.trim()) {
      throw new BadRequestException("modelId is required");
    }
    const key = await this.resolveApiKey(apiKey, connectionId);
    return this.openRouterService.fetchEndpoints(key, modelId.trim());
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<Connection> {
    return this.connectionsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateConnectionDto): Promise<Connection> {
    return this.connectionsService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateConnectionDto,
  ): Promise<Connection> {
    return this.connectionsService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.connectionsService.remove(id);
    return { ok: true };
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string): Promise<Connection> {
    return this.connectionsService.duplicate(id);
  }

  private async resolveApiKey(
    apiKey?: string,
    connectionId?: string,
  ): Promise<string> {
    if (apiKey?.trim()) {
      return apiKey.trim();
    }
    if (connectionId?.trim()) {
      return this.connectionsService.getApiKey(connectionId.trim());
    }
    throw new BadRequestException(
      "Provide apiKey or connectionId to call OpenRouter",
    );
  }
}
