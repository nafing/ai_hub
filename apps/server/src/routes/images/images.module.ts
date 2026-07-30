import { Module } from "@nestjs/common";
import { CharactersModule } from "../characters/characters.module";
import { ChatsModule } from "../chats/chats.module";
import { PersonasModule } from "../personas/personas.module";
import { ImagesController } from "./images.controller";
import { ImagesService } from "./images.service";

@Module({
  imports: [CharactersModule, PersonasModule, ChatsModule],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
