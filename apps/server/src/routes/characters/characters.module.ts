import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CharacterFoldersModule } from "../character-folders/character-folders.module";
import { LorebooksModule } from "../lorebooks/lorebooks.module";
import { CharacterEntity } from "./character.entity";
import { CharactersController } from "./characters.controller";
import { CharactersService } from "./characters.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([CharacterEntity]),
    LorebooksModule,
    CharacterFoldersModule,
  ],
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService],
})
export class CharactersModule {}
