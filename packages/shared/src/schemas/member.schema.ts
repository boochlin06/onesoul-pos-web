import { z } from 'zod';
import { PointLogTypeEnum } from '../types/enums';

export const PointLogSchema = z.object({
  id: z.string(),
  memberId: z.string().min(1),
  type: z.enum(PointLogTypeEnum),
  delta: z.number().int(),
  balance: z.number().int().min(0),
  orderId: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  operator: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const MemberSchema = z.object({
  id: z.string(),
  phone: z.string().min(1),
  barcode: z.string().nullable().optional(),
  lineUserId: z.string().nullable().optional(),
  name: z.string().min(1),
  tier: z.string().default('GENERAL'),
  gender: z.string().nullable().optional(),
  birthday: z.string().nullable().optional(),
  registeredAt: z.string().optional(),
  points: z.number().int().min(0).default(0),
  version: z.number().int().default(0),
  note: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  totalSpent: z.number().int().default(0),
  orderCount: z.number().int().default(0),
  lastPurchaseAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  pointLogs: z.array(PointLogSchema).optional(),
});

export const CreateMemberSchema = z.object({
  phone: z.string().min(6, '手機號碼長度至少需 6 碼'),
  name: z.string().min(1, '姓名不可為空'),
  barcode: z.string().optional(),
  lineUserId: z.string().optional(),
  gender: z.string().optional(),
  birthday: z.string().optional(),
  note: z.string().optional(),
  initialPoints: z.number().int().min(0).default(0),
});

export const AdjustPointsPayloadSchema = z.object({
  delta: z.number().int().refine((n) => n !== 0, '異動點數不可為 0'),
  reason: z.string().min(4, '調整理由至少需 4 個字元'),
  operator: z.string().min(1, '操作者不可為空'),
});
