import { Column, Entity, PrimaryColumn } from "typeorm";
import type { CharacterCardData } from "@ai-hub/shared";

@Entity("characters")
export class CharacterEntity {
  @PrimaryColumn("text")
  id!: string;

  /** Hub-only relative path on disk (e.g. characters/{id}.png), or null. */
  @Column("text", { nullable: true })
  avatar!: string | null;

  /** Denormalized from data.name for sorting / list queries. */
  @Column("text", { default: "" })
  name!: string;

  @Column("simple-json", { default: "{}" })
  data!: CharacterCardData;
}
