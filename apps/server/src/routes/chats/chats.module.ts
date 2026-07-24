import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AgentsModule } from "../agents/agents.module";
import { CharactersModule } from "../characters/characters.module";
import { ConnectionsModule } from "../connections/connections.module";
import { LorebooksModule } from "../lorebooks/lorebooks.module";
import { PersonasModule } from "../personas/personas.module";
import { PresetsModule } from "../presets/presets.module";
import { RegexesModule } from "../regexes/regexes.module";
import { ChatEntity } from "./chat.entity";
import { ChatsController } from "./chats.controller";
import { ChatsService } from "./chats.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatEntity]),
    ConnectionsModule,
    PresetsModule,
    CharactersModule,
    PersonasModule,
    LorebooksModule,
    AgentsModule,
    RegexesModule,
  ],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
