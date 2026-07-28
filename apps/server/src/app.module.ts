import path from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoreModule } from "./lore/lore.module";
import { LlmModule } from "./llm/llm.module";
import {
  ConnectionsModule,
  PresetsModule,
  GeneratorsModule,
  RegexesModule,
  ToolsModule,
  AgentsModule,
  CharactersModule,
  LorebooksModule,
  PersonasModule,
  ChatsModule,
  TwatterModule,
  AppSettingsModule,
  ConversationModule,
} from "./routes";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: path.resolve(__dirname, "../../../.env"),
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: "better-sqlite3",
      database:
        process.env.SERVER_DATABASE_URL ??
        path.resolve(__dirname, "../../../data/ai_hub.sqlite"),
      entities: [__dirname + "/**/*.entity{.ts,.js}"],
      synchronize: true,
      prepareDatabase: (db) => db.pragma("foreign_keys = ON"),
    }),
    ConnectionsModule,
    PresetsModule,
    GeneratorsModule,
    RegexesModule,
    ToolsModule,
    AgentsModule,
    CharactersModule,
    LorebooksModule,
    PersonasModule,
    LoreModule,
    ChatsModule,
    TwatterModule,
    AppSettingsModule,
    ConversationModule,
    LlmModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
