import { Module } from "@nestjs/common";
import { ConnectionsModule } from "../connections/connections.module";
import { PresetsModule } from "../presets/presets.module";
import { GeneratorsController } from "./generators.controller";
import { GeneratorsService } from "./generators.service";

@Module({
  imports: [PresetsModule, ConnectionsModule],
  controllers: [GeneratorsController],
  providers: [GeneratorsService],
  exports: [GeneratorsService],
})
export class GeneratorsModule {}
