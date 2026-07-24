import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LorebooksModule } from "../lorebooks/lorebooks.module";
import { PersonaEntity } from "./persona.entity";
import { PersonasController } from "./personas.controller";
import { PersonasService } from "./personas.service";

@Module({
  imports: [TypeOrmModule.forFeature([PersonaEntity]), LorebooksModule],
  controllers: [PersonasController],
  providers: [PersonasService],
  exports: [PersonasService],
})
export class PersonasModule {}
