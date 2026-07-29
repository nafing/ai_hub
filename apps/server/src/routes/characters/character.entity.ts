import { Column, Entity, PrimaryColumn } from "typeorm";
import type { CharacterCardData, CharacterVersion } from "@ai-hub/shared";

@Entity("characters")
export class CharacterEntity {
  @PrimaryColumn("text")
  id!: string;

  /** Hub-only relative path on disk (e.g. characters/{id}.png), or null. */
  @Column("text", { nullable: true })
  avatar!: string | null;

  /**
   * Extra gallery images (imports / generations) for chat backgrounds.
   * Files live under uploads/characters/{id}/gallery/.
   */
  @Column("simple-json", { default: "[]" })
  gallery!: unknown[];

  /** Denormalized from active version data.name for sorting / list queries. */
  @Column("text", { default: "" })
  name!: string;

  /** Active card snapshot (mirrors active version). */
  @Column("simple-json", { default: "{}" })
  data!: CharacterCardData;

  @Column("text", { default: "" })
  active_version_id!: string;

  @Column("simple-json", { default: "[]" })
  versions!: CharacterVersion[];
}
