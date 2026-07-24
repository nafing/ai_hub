import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LorebooksModule } from "../lorebooks/lorebooks.module";
import { CharacterEntity } from "./character.entity";
import { CharactersController } from "./characters.controller";
import { CharactersService } from "./characters.service";

@Module({
  imports: [TypeOrmModule.forFeature([CharacterEntity]), LorebooksModule],
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService],
})
export class CharactersModule {}
