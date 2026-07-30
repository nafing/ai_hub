import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AgentsModule } from "../agents/agents.module";
import { CharactersModule } from "../characters/characters.module";
import { ConnectionsModule } from "../connections/connections.module";
import { ConversationModule } from "../conversation/conversation.module";
import { LorebooksModule } from "../lorebooks/lorebooks.module";
import { PersonasModule } from "../personas/personas.module";
import { PresetsModule } from "../presets/presets.module";
import { RegexesModule } from "../regexes/regexes.module";
import { TwatterModule } from "../twatter/twatter.module";
import { ChatEntity } from "./chat.entity";
import { ChatSummaryService } from "./chat-summary.service";
import { ChatsController } from "./chats.controller";
import { ChatsService } from "./chats.service";
import { ConversationSummaryService } from "./conversation-summary.service";

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
    TwatterModule,
    forwardRef(() => ConversationModule),
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatSummaryService, ConversationSummaryService],
  exports: [ChatsService],
})
export class ChatsModule {}
