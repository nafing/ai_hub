import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { Agent, AgentListItem } from "@ai-hub/shared";
import { AgentsService } from "./agents.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";

@Controller("agents")
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  findAll(): Promise<AgentListItem[]> {
    return this.agentsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<Agent> {
    return this.agentsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateAgentDto): Promise<Agent> {
    return this.agentsService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateAgentDto,
  ): Promise<Agent> {
    return this.agentsService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.agentsService.remove(id);
    return { ok: true };
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string): Promise<Agent> {
    return this.agentsService.duplicate(id);
  }
}
