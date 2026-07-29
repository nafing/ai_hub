import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CharacterEntity } from "../characters/character.entity";
import { CharacterFolderEntity } from "./character-folder.entity";
import { CharacterFoldersController } from "./character-folders.controller";
import { CharacterFoldersService } from "./character-folders.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([CharacterFolderEntity, CharacterEntity]),
  ],
  controllers: [CharacterFoldersController],
  providers: [CharacterFoldersService],
  exports: [CharacterFoldersService],
})
export class CharacterFoldersModule {}
