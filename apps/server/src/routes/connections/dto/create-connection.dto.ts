import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsString,
  Min,
} from "class-validator";

export class CreateConnectionDto {
  @IsString()
  name!: string;

  @IsString()
  preferred_provider!: string;

  @IsString()
  api_key!: string;

  @IsString()
  model!: string;

  @IsNumber()
  @Min(1)
  max_parallel_jobs!: number;

  @IsNumber()
  @Min(1)
  max_completion_tokens!: number;

  @IsNumber()
  temperature!: number;

  @IsNumber()
  @Min(1)
  context_length!: number;

  @IsNumber()
  top_p!: number;

  @IsNumber()
  @Min(0)
  top_k!: number;

  @IsNumber()
  frequency_penalty!: number;

  @IsNumber()
  presence_penalty!: number;

  @IsString()
  assistant_prefill!: string;

  @IsString()
  thinking_tag!: string;

  @IsObject()
  custom_parameters!: Record<string, unknown>;

  @IsString()
  service_tier!: string;

  @IsString()
  reasoning_effort!: string;

  @IsString()
  verbosity!: string;

  @IsBoolean()
  prompt_caching!: boolean;

  @IsBoolean()
  is_default!: boolean;
}
