import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConnectionsModule } from "../connections/connections.module";
import { PresetEntity } from "./preset.entity";
import { PresetsController } from "./presets.controller";
import { PresetsService } from "./presets.service";

@Module({
  imports: [TypeOrmModule.forFeature([PresetEntity]), ConnectionsModule],
  controllers: [PresetsController],
  providers: [PresetsService],
  exports: [PresetsService],
})
export class PresetsModule {}
