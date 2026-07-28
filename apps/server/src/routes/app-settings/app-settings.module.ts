import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppSettingsEntity } from "./app-settings.entity";
import { AppSettingsService } from "./app-settings.service";

/** Generic key/value app settings store (no chat-summary prompt UI; that is a preset category). */
@Module({
  imports: [TypeOrmModule.forFeature([AppSettingsEntity])],
  providers: [AppSettingsService],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
