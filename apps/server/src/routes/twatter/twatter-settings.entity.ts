import { Column, Entity, PrimaryColumn } from "typeorm";
import type {
  PersistedTwatterRefreshSchedule,
  TwatterSettings,
} from "@ai-hub/shared";

@Entity("twatter_settings")
export class TwatterSettingsEntity {
  @PrimaryColumn("text", { default: "default" })
  id!: string;

  @Column("simple-json")
  data!: TwatterSettings;

  @Column("simple-json", { nullable: true })
  refresh_schedule!: PersistedTwatterRefreshSchedule | null;
}
