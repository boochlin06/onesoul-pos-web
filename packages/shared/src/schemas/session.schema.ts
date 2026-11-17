import { z } from 'zod';
import { SessionStatusEnum } from '../types/enums';

export const CashRegisterSessionSchema = z.object({
  id: z.string(),
  storeId: z.string().min(1),
  openedAt: z.string(),
  closedAt: z.string().nullable().optional(),
  openedBy: z.string().min(1),
  closedBy: z.string().nullable().optional(),
  openingCash: z.number().int().min(0).default(0),
  expectedCash: z.number().int().nullable().optional(),
  actualCash: z.number().int().nullable().optional(),
  discrepancy: z.number().int().nullable().optional(),
  totalRevenue: z.number().int().default(0),
  cashRevenue: z.number().int().default(0),
  cardRevenue: z.number().int().default(0),
  remitRevenue: z.number().int().default(0),
  pointsIssued: z.number().int().default(0),
  pointsRedeemed: z.number().int().default(0),
  txCount: z.number().int().default(0),
  voidCount: z.number().int().default(0),
  voidAmount: z.number().int().default(0),
  note: z.string().nullable().optional(),
  status: z.enum(SessionStatusEnum).default('OPEN'),
});

export const OpenSessionPayloadSchema = z.object({
  storeId: z.string().min(1, '門市 ID 不可為空'),
  openingCash: z.number().int().min(0).default(8000),
  openedBy: z.string().min(1, '開班人員帳號不可為空'),
  note: z.string().optional(),
});

export const CloseSessionPayloadSchema = z.object({
  actualCash: z.number().int().min(0, '實盤現金不可為負數'),
  closedBy: z.string().min(1, '關帳人員帳號不可為空'),
  note: z.string().optional(),
});

export const ZReportSchema = z.object({
  sessionId: z.string(),
  storeId: z.string(),
  openedAt: z.string(),
  closedAt: z.string(),
  openedBy: z.string(),
  closedBy: z.string(),
  openingCash: z.number().int(),
  expectedCash: z.number().int(),
  actualCash: z.number().int(),
  discrepancy: z.number().int(),
  totalRevenue: z.number().int(),
  cashRevenue: z.number().int(),
  cardRevenue: z.number().int(),
  remitRevenue: z.number().int(),
  pointsIssued: z.number().int(),
  pointsRedeemed: z.number().int(),
  txCount: z.number().int(),
  voidCount: z.number().int(),
  voidAmount: z.number().int(),
  prizesDispensed: z.record(z.number().int()).optional(),
  note: z.string().nullable().optional(),
});
