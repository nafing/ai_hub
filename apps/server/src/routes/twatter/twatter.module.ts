import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConnectionsModule } from "../connections/connections.module";
import { PresetsModule } from "../presets/presets.module";
import { CharactersModule } from "../characters/characters.module";
import { PersonasModule } from "../personas/personas.module";
import { ChatEntity } from "../chats/chat.entity";
import { TwatterAccountEntity } from "./twatter-account.entity";
import { TwatterDigestEntity } from "./twatter-digest.entity";
import { TwatterInteractionEntity } from "./twatter-interaction.entity";
import { TwatterPostEntity } from "./twatter-post.entity";
import { TwatterSettingsEntity } from "./twatter-settings.entity";
import { TwatterController } from "./twatter.controller";
import { TwatterRefreshService } from "./twatter-refresh.service";
import { TwatterSchedulerService } from "./twatter-scheduler.service";
import { TwatterService } from "./twatter.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TwatterAccountEntity,
      TwatterPostEntity,
      TwatterInteractionEntity,
      TwatterDigestEntity,
      TwatterSettingsEntity,
      ChatEntity,
    ]),
    PersonasModule,
    CharactersModule,
    ConnectionsModule,
    PresetsModule,
  ],
  controllers: [TwatterController],
  providers: [TwatterService, TwatterRefreshService, TwatterSchedulerService],
  exports: [TwatterService],
})
export class TwatterModule {}
