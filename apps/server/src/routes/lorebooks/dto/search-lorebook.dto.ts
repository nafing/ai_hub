import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ArrayUnique,
} from "class-validator";

export class SearchLorebookDto {
  @IsString()
  @MinLength(1)
  query!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  lorebook_ids?: string[];
}
