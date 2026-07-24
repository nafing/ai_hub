import { PartialType } from "@nestjs/mapped-types";
import { CreateRegexScriptDto } from "./create-regex-script.dto";

export class UpdateRegexScriptDto extends PartialType(CreateRegexScriptDto) {}
