import { Module } from "@nestjs/common";
import { LoreRetrievalService } from "./lore-retrieval.service";

@Module({
  providers: [LoreRetrievalService],
  exports: [LoreRetrievalService],
})
export class LoreModule {}
