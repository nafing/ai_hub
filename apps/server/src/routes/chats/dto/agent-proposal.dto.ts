import { IsOptional, IsString } from "class-validator";

export class AgentProposalActionDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  proposalId!: string;
}
