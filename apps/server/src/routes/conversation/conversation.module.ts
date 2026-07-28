import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CharactersModule } from "../characters/characters.module";
import { ChatEntity } from "../chats/chat.entity";
import { ChatsModule } from "../chats/chats.module";
import { ConversationAutonomousService } from "./conversation-autonomous.service";
import { ConversationController } from "./conversation.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatEntity]),
    CharactersModule,
    forwardRef(() => ChatsModule),
  ],
  controllers: [ConversationController],
  providers: [ConversationAutonomousService],
  exports: [ConversationAutonomousService],
})
export class ConversationModule {}
