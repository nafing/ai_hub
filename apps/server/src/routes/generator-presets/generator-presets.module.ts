import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GeneratorPresetEntity } from "./generator-preset.entity";
import { GeneratorPresetsController } from "./generator-presets.controller";
import { GeneratorPresetsService } from "./generator-presets.service";

@Module({
  imports: [TypeOrmModule.forFeature([GeneratorPresetEntity])],
  controllers: [GeneratorPresetsController],
  providers: [GeneratorPresetsService],
  exports: [GeneratorPresetsService],
})
export class GeneratorPresetsModule {}
