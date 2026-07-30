import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CharacterEntity } from "../characters/character.entity";
import { PersonaEntity } from "../personas/persona.entity";
import { LorebookEntity } from "./lorebook.entity";
import { LoreRetrievalService } from "./lore-retrieval.service";
import { LorebooksController } from "./lorebooks.controller";
import { LorebooksService } from "./lorebooks.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LorebookEntity,
      CharacterEntity,
      PersonaEntity,
    ]),
  ],
  controllers: [LorebooksController],
  providers: [LorebooksService, LoreRetrievalService],
  exports: [LorebooksService, LoreRetrievalService],
})
export class LorebooksModule {}
