import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from "@nestjs/common";
import { BotbooruService } from "./botbooru.service";
import {
  BotbooruLoginDto,
  BotbooruPreferencesDto,
} from "./dto/botbooru-auth.dto";

@Controller("botbooru")
export class BotbooruController {
  constructor(private readonly botbooruService: BotbooruService) {}

  @Get("auth/me")
  getSession() {
    return this.botbooruService.getSession();
  }

  @Post("auth/login")
  login(@Body() body: BotbooruLoginDto) {
    return this.botbooruService.login(body.username, body.password);
  }

  @Post("auth/logout")
  logout() {
    return this.botbooruService.logout();
  }

  @Patch("auth/preferences")
  updatePreferences(@Body() body: BotbooruPreferencesDto) {
    return this.botbooruService.updatePreferences({
      show_nsfw: body.show_nsfw,
      show_nsfl: body.show_nsfl,
      show_nsfl_active: body.show_nsfl_active,
    });
  }

  @Get("tags")
  listTags(@Query("q") q?: string, @Query("limit") limit?: string) {
    return this.botbooruService.listTags({
      q,
      limit: limit != null && limit !== "" ? Number(limit) : undefined,
    });
  }

  @Get("tags/related")
  listRelatedTags(
    @Query("q") q = "",
    @Query("limit") limit?: string,
    @Query("sfw_only") sfwOnly?: string,
    @Query("hide_ai") hideAi?: string,
  ) {
    return this.botbooruService.listRelatedTags({
      q,
      limit: limit != null && limit !== "" ? Number(limit) : undefined,
      sfwOnly: sfwOnly !== "false" && sfwOnly !== "0",
      hideAi: hideAi === "true" || hideAi === "1",
    });
  }

  @Get("posts")
  listPosts(
    @Query("sort") sort?: string,
    @Query("q") q?: string,
    @Query("qtext") qtext?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("sfw_only") sfwOnly?: string,
    @Query("hide_ai") hideAi?: string,
  ) {
    return this.botbooruService.listPosts({
      sort,
      q,
      qtext,
      limit: limit != null && limit !== "" ? Number(limit) : undefined,
      offset: offset != null && offset !== "" ? Number(offset) : undefined,
      sfwOnly: sfwOnly !== "false" && sfwOnly !== "0",
      hideAi: hideAi === "true" || hideAi === "1",
    });
  }

  @Get("posts/:postId")
  getPost(@Param("postId", ParseIntPipe) postId: number) {
    return this.botbooruService.getPost(postId);
  }

  @Get("posts/:postId/png")
  @Header("Cache-Control", "private, no-store")
  async downloadPng(
    @Param("postId", ParseIntPipe) postId: number,
  ): Promise<StreamableFile> {
    const { buffer, fileName } = await this.botbooruService.downloadPng(postId);
    return new StreamableFile(buffer, {
      type: "image/png",
      disposition: `attachment; filename="${fileName}"`,
    });
  }
}
