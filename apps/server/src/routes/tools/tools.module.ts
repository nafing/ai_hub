import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LorebooksModule } from "../lorebooks/lorebooks.module";
import { ToolEntity } from "./tool.entity";
import { ToolExecutorService } from "./tool-executor.service";
import { ToolsController } from "./tools.controller";
import { ToolsService } from "./tools.service";

@Module({
  imports: [TypeOrmModule.forFeature([ToolEntity]), LorebooksModule],
  controllers: [ToolsController],
  providers: [ToolsService, ToolExecutorService],
  exports: [ToolsService, ToolExecutorService],
})
export class ToolsModule {}
