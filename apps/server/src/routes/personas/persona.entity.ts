import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("personas")
export class PersonaEntity {
  @PrimaryColumn("text")
  id!: string;

  /** Relative path under uploads, e.g. `personas/{id}.png`, or null. */
  @Column("text", { nullable: true })
  avatar!: string | null;

  @Column("text", { default: "" })
  name!: string;

  @Column("text", { default: "" })
  description!: string;

  @Column("text", { default: "" })
  appearance!: string;

  @Column("text", { default: "" })
  personality!: string;

  @Column("text", { default: "" })
  about_me!: string;

  @Column("text", { default: "" })
  notes!: string;

  @Column("boolean", { default: false })
  is_default!: boolean;
}
