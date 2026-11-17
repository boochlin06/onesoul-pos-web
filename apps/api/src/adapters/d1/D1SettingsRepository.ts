import { eq, desc } from 'drizzle-orm';
import type { OneSoulD1Database } from '@onesoul/db';
import { integrationConfigs, emergencyNotices } from '@onesoul/db/schema';
import type {
  SettingsRepository,
  IntegrationConfigRecord,
  BrandSettings,
  EmergencyNoticeRecord,
} from '../../core/ports/SettingsRepository';

const BRAND_CONFIG_KEY = 'STORE_BRAND_INFO';

const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  brandName: 'OneSoul 玩具模型一番賞專賣店',
  brandSubtitle: '專業一番賞・盒玩盲盒・潮流雕像',
  logoText: 'OneSoul',
  supportPhone: '03-5588888',
  blindBoxPointsValue: 10,
  pointRateTwd: 20,
  smallPrizePointsValue: 1,
  logoHorizontal: null,
  logoSquare: null,
};

export class D1SettingsRepository implements SettingsRepository {
  constructor(private readonly db: OneSoulD1Database) {}

  private getExecutor(tx?: any): any {
    return tx ?? this.db;
  }

  async getIntegrationConfig(
    key: string,
    tx?: any
  ): Promise<IntegrationConfigRecord | null> {
    const executor = this.getExecutor(tx);
    const [row] = await executor
      .select()
      .from(integrationConfigs)
      .where(eq(integrationConfigs.key, key))
      .limit(1);

    if (!row) return null;
    const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    return {
      id: row.id,
      key: row.key,
      value: value ?? {},
      description: row.description,
      isEnabled: Boolean(row.isEnabled),
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }

  async saveIntegrationConfig(
    config: Omit<IntegrationConfigRecord, 'id'> & { id?: string },
    tx?: any
  ): Promise<void> {
    const executor = this.getExecutor(tx);
    const [existing] = await executor
      .select({ id: integrationConfigs.id })
      .from(integrationConfigs)
      .where(eq(integrationConfigs.key, config.key))
      .limit(1);

    const nowIso = new Date().toISOString();

    if (existing) {
      await executor
        .update(integrationConfigs)
        .set({
          value: config.value as any,
          description: config.description ?? null,
          isEnabled: config.isEnabled,
          updatedBy: config.updatedBy ?? null,
          updatedAt: nowIso,
        })
        .where(eq(integrationConfigs.key, config.key));
    } else {
      await executor.insert(integrationConfigs).values({
        id: config.id || crypto.randomUUID(),
        key: config.key,
        value: config.value as any,
        description: config.description ?? null,
        isEnabled: config.isEnabled,
        updatedBy: config.updatedBy ?? null,
        updatedAt: nowIso,
      });
    }
  }

  async listIntegrationConfigs(tx?: any): Promise<IntegrationConfigRecord[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor.select().from(integrationConfigs);
    return rows.map((row: any) => ({
      id: row.id,
      key: row.key,
      value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
      description: row.description,
      isEnabled: Boolean(row.isEnabled),
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    }));
  }

  async getBrandSettings(tx?: any): Promise<BrandSettings> {
    const config = await this.getIntegrationConfig(BRAND_CONFIG_KEY, tx);
    if (!config || !config.value) {
      return { ...DEFAULT_BRAND_SETTINGS };
    }
    return {
      ...DEFAULT_BRAND_SETTINGS,
      ...config.value,
    };
  }

  async saveBrandSettings(
    settings: BrandSettings,
    operatorId?: string,
    tx?: any
  ): Promise<void> {
    await this.saveIntegrationConfig(
      {
        key: BRAND_CONFIG_KEY,
        value: settings,
        description: '門市品牌識別與點數換算比率全域設定',
        isEnabled: true,
        updatedBy: operatorId ?? 'SYSTEM',
      },
      tx
    );
  }

  async listEmergencyNotices(
    activeOnly = false,
    tx?: any
  ): Promise<EmergencyNoticeRecord[]> {
    const executor = this.getExecutor(tx);
    const query = executor.select().from(emergencyNotices);

    const rows = activeOnly
      ? await query
          .where(eq(emergencyNotices.isActive, true))
          .orderBy(desc(emergencyNotices.publishedAt))
      : await query.orderBy(desc(emergencyNotices.publishedAt));

    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      level: row.level,
      targetStoreIds:
        typeof row.targetStoreIds === 'string'
          ? JSON.parse(row.targetStoreIds)
          : row.targetStoreIds ?? [],
      isActive: Boolean(row.isActive),
      version: row.version,
      publisherEmail: row.publisherEmail,
      publishedAt: row.publishedAt,
      expiresAt: row.expiresAt,
    }));
  }

  async publishEmergencyNotice(
    notice: Omit<EmergencyNoticeRecord, 'id' | 'version'>,
    tx?: any
  ): Promise<EmergencyNoticeRecord> {
    const executor = this.getExecutor(tx);
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const [latest] = await executor
      .select({ version: emergencyNotices.version })
      .from(emergencyNotices)
      .orderBy(desc(emergencyNotices.version))
      .limit(1);

    const nextVersion = (latest?.version ?? 0) + 1;

    await executor.insert(emergencyNotices).values({
      id,
      title: notice.title,
      content: notice.content,
      level: notice.level as any,
      targetStoreIds: notice.targetStoreIds,
      isActive: notice.isActive !== undefined ? notice.isActive : true,
      version: nextVersion,
      publisherEmail: notice.publisherEmail,
      publishedAt: notice.publishedAt || nowIso,
      expiresAt: notice.expiresAt ?? null,
    });

    return {
      id,
      title: notice.title,
      content: notice.content,
      level: notice.level,
      targetStoreIds: notice.targetStoreIds,
      isActive: notice.isActive !== undefined ? notice.isActive : true,
      version: nextVersion,
      publisherEmail: notice.publisherEmail,
      publishedAt: notice.publishedAt || nowIso,
      expiresAt: notice.expiresAt ?? null,
    };
  }

  async withdrawEmergencyNotice(id: string, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);
    await executor
      .update(emergencyNotices)
      .set({ isActive: false })
      .where(eq(emergencyNotices.id, id));
  }
}
