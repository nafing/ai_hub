import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("twatter_digests")
export class TwatterDigestEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("simple-json")
  account_ids!: string[];

  @Column("text")
  content!: string;

  @Column("text")
  created_at!: string;
}
