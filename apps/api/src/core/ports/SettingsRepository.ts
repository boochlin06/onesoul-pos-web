export interface IntegrationConfigRecord {
  id: string;
  key: string;
  value: Record<string, any>;
  description?: string | null;
  isEnabled: boolean;
  updatedBy?: string | null;
  updatedAt?: string;
}

export interface BrandSettings {
  brandName: string;
  brandSubtitle?: string;
  logoText?: string;
  supportPhone?: string;
  blindBoxPointsValue: number; // 預設 10
  pointRateTwd: number; // 預設 20
  smallPrizePointsValue: number; // 預設 1
  logoHorizontal?: string | null;
  logoSquare?: string | null;
}

export interface EmergencyNoticeRecord {
  id: string;
  title: string;
  content: string;
  level: string;
  targetStoreIds: string[];
  isActive: boolean;
  version: number;
  publisherEmail: string;
  publishedAt?: string;
  expiresAt?: string | null;
}

export interface SettingsRepository {
  getIntegrationConfig(key: string, tx?: any): Promise<IntegrationConfigRecord | null>;
  saveIntegrationConfig(config: Omit<IntegrationConfigRecord, 'id'> & { id?: string }, tx?: any): Promise<void>;
  listIntegrationConfigs(tx?: any): Promise<IntegrationConfigRecord[]>;
  getBrandSettings(tx?: any): Promise<BrandSettings>;
  saveBrandSettings(settings: BrandSettings, operatorId?: string, tx?: any): Promise<void>;
  listEmergencyNotices(activeOnly?: boolean, tx?: any): Promise<EmergencyNoticeRecord[]>;
  publishEmergencyNotice(notice: Omit<EmergencyNoticeRecord, 'id' | 'version'>, tx?: any): Promise<EmergencyNoticeRecord>;
  withdrawEmergencyNotice(id: string, tx?: any): Promise<void>;
}
