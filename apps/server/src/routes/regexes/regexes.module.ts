import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RegexScriptEntity } from "./regex-script.entity";
import { RegexesController } from "./regexes.controller";
import { RegexesService } from "./regexes.service";

@Module({
  imports: [TypeOrmModule.forFeature([RegexScriptEntity])],
  controllers: [RegexesController],
  providers: [RegexesService],
  exports: [RegexesService],
})
export class RegexesModule {}
