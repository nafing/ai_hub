import { PartialType } from "@nestjs/mapped-types";
import { CreateLorebookDto } from "./create-lorebook.dto";

export class UpdateLorebookDto extends PartialType(CreateLorebookDto) {}
