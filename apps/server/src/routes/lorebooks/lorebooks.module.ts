import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LancedbModule } from "../../lancedb/lancedb.module";
import { CharacterEntity } from "../characters/character.entity";
import { PersonaEntity } from "../personas/persona.entity";
import { LorebookEntity } from "./lorebook.entity";
import { LorebooksController } from "./lorebooks.controller";
import { LorebooksService } from "./lorebooks.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LorebookEntity,
      CharacterEntity,
      PersonaEntity,
    ]),
    forwardRef(() => LancedbModule),
  ],
  controllers: [LorebooksController],
  providers: [LorebooksService],
  exports: [LorebooksService],
})
export class LorebooksModule {}
