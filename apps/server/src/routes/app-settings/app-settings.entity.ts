import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("app_settings")
export class AppSettingsEntity {
  @PrimaryColumn("text")
  key!: string;

  @Column("simple-json")
  value!: unknown;

  @Column("text")
  updated_at!: string;
}
