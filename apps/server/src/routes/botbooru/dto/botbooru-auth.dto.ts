import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class BotbooruLoginDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class BotbooruPreferencesDto {
  @IsOptional()
  @IsBoolean()
  show_nsfw?: boolean;

  @IsOptional()
  @IsBoolean()
  show_nsfl?: boolean;

  @IsOptional()
  @IsBoolean()
  show_nsfl_active?: boolean;
}
