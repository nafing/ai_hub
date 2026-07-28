import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppSettingsEntity } from "./app-settings.entity";

@Injectable()
export class AppSettingsService {
  constructor(
    @InjectRepository(AppSettingsEntity)
    private readonly settings: Repository<AppSettingsEntity>,
  ) {}

  async get(key: string): Promise<unknown | null> {
    const row = await this.settings.findOneBy({ key });
    return row ? row.value : null;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.settings.save({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
  }
}
