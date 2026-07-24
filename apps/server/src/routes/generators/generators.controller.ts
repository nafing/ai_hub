import { Body, Controller, Post } from "@nestjs/common";
import type { PresetMarkerContent } from "@ai-hub/shared";
import { RunGeneratorDto } from "./dto/run-generator.dto";
import { GeneratorsService } from "./generators.service";

@Controller("generators")
export class GeneratorsController {
  constructor(private readonly generatorsService: GeneratorsService) {}

  /** Run a generator preset (character / persona / lorebook). */
  @Post("run")
  run(@Body() body: RunGeneratorDto) {
    return this.generatorsService.run({
      category: body.category,
      connectionId: body.connectionId,
      presetId: body.presetId,
      variables: body.variables,
      markers: body.markers as PresetMarkerContent | undefined,
      userMessage: body.userMessage,
    });
  }
}
