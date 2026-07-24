import { Module } from "@nestjs/common";
import { ConnectionsModule } from "../routes/connections/connections.module";
import { PresetsModule } from "../routes/presets/presets.module";
import { LlmService } from "./llm.service";

@Module({
  imports: [ConnectionsModule, PresetsModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
