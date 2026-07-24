import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConnectionEntity } from "./connection.entity";
import { ConnectionsController } from "./connections.controller";
import { ConnectionsService } from "./connections.service";
import { OpenRouterService } from "./openrouter.service";

@Module({
  imports: [TypeOrmModule.forFeature([ConnectionEntity])],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, OpenRouterService],
  exports: [ConnectionsService, OpenRouterService],
})
export class ConnectionsModule {}
