import { Module } from "@nestjs/common";
import { ConnectionsModule } from "../connections/connections.module";
import { GeneratorPresetsModule } from "../generator-presets/generator-presets.module";
import { PresetsModule } from "../presets/presets.module";
import { GeneratorsController } from "./generators.controller";
import { GeneratorsService } from "./generators.service";

@Module({
  imports: [PresetsModule, GeneratorPresetsModule, ConnectionsModule],
  controllers: [GeneratorsController],
  providers: [GeneratorsService],
  exports: [GeneratorsService],
})
export class GeneratorsModule {}
