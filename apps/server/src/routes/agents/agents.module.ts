import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LorebooksModule } from "../lorebooks/lorebooks.module";
import { ToolsModule } from "../tools/tools.module";
import { AgentEntity } from "./agent.entity";
import { AgentRunnerService } from "./agent-runner.service";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentEntity]),
    ToolsModule,
    LorebooksModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService, AgentRunnerService],
  exports: [AgentsService, AgentRunnerService],
})
export class AgentsModule {}
