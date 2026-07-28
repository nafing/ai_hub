import { IsBoolean, IsString } from "class-validator";

export class CreatePersonaDto {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsString()
  personality!: string;

  @IsString()
  about_me!: string;

  @IsString()
  notes!: string;

  @IsBoolean()
  is_default!: boolean;
}
