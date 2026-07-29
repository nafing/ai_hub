import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("character_folders")
export class CharacterFolderEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("text", { default: "" })
  name!: string;

  @Column("simple-json", { default: "[]" })
  character_ids!: string[];
}
