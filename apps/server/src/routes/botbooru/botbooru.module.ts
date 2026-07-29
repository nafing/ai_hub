import { Module } from "@nestjs/common";
import { AppSettingsModule } from "../app-settings/app-settings.module";
import { BotbooruController } from "./botbooru.controller";
import { BotbooruService } from "./botbooru.service";

@Module({
  imports: [AppSettingsModule],
  controllers: [BotbooruController],
  providers: [BotbooruService],
})
export class BotbooruModule {}
