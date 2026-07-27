import { Module, forwardRef } from "@nestjs/common";
import { ConnectionsModule } from "../routes/connections/connections.module";
import { LorebooksModule } from "../routes/lorebooks/lorebooks.module";
import { ChatMemoryService } from "./chat-memory.service";
import { EmbeddingsService } from "./embeddings.service";
import { LancedbService } from "./lancedb.service";
import { LoreIndexService } from "./lore-index.service";
import { LoreRetrievalService } from "./lore-retrieval.service";

@Module({
  imports: [
    ConnectionsModule,
    forwardRef(() => LorebooksModule),
  ],
  providers: [
    LancedbService,
    EmbeddingsService,
    LoreIndexService,
    LoreRetrievalService,
    ChatMemoryService,
  ],
  exports: [
    LancedbService,
    EmbeddingsService,
    LoreIndexService,
    LoreRetrievalService,
    ChatMemoryService,
  ],
})
export class LancedbModule {}
