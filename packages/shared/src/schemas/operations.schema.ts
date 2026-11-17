import { z } from 'zod';
import {
  RoleEnum,
  AttendanceStatusEnum,
  OutboxTaskTypeEnum,
  OutboxStatusEnum,
  NoticeLevelEnum,
} from '../types/enums';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(RoleEnum).default('CASHIER'),
  assignedStoreId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
});

export const ScheduleSchema = z.object({
  id: z.string(),
  storeId: z.string().min(1),
  date: z.string(), // YYYY-MM-DD
  staffName: z.string().min(1),
  isClosed: z.boolean().default(false),
});

export const ShiftScheduleSchema = z.object({
  id: z.string(),
  storeId: z.string().min(1),
  date: z.string(),
  staffName: z.string().min(1),
  staffEmail: z.string().email().nullable().optional(),
  shiftType: z.string().default('FULL'),
  isClosed: z.boolean().default(false),
  note: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const AttendanceSchema = z.object({
  id: z.string(),
  storeId: z.string().min(1),
  userEmail: z.string().email(),
  clockInAt: z.string(),
  clockOutAt: z.string().nullable().optional(),
  status: z.string().default('NORMAL'),
});

export const AttendanceRecordSchema = z.object({
  id: z.string(),
  storeId: z.string().min(1),
  userEmail: z.string().email(),
  userName: z.string().nullable().optional(),
  clockInAt: z.string(),
  clockOutAt: z.string().nullable().optional(),
  status: z.enum(AttendanceStatusEnum).default('NORMAL'),
  lateMinutes: z.number().int().min(0).default(0),
  ipAddress: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const IntegrationConfigSchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  value: z.record(z.unknown()),
  description: z.string().nullable().optional(),
  isEnabled: z.boolean().default(true),
  updatedBy: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
});

export const OutboxTaskSchema = z.object({
  id: z.string(),
  taskType: z.enum(OutboxTaskTypeEnum),
  payload: z.record(z.unknown()),
  status: z.enum(OutboxStatusEnum).default('PENDING'),
  retryCount: z.number().int().default(0),
  maxRetries: z.number().int().default(5),
  lastError: z.string().nullable().optional(),
  nextRetryAt: z.string(),
  createdAt: z.string().optional(),
  processedAt: z.string().nullable().optional(),
});

export const EmergencyNoticeSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  content: z.string().min(1),
  level: z.enum(NoticeLevelEnum).default('INFO'),
  targetStoreIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  version: z.number().int().default(1),
  publisherEmail: z.string().email(),
  publishedAt: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
});

export const VoidSetLogSchema = z.object({
  id: z.string(),
  storeId: z.string().min(1),
  bagId: z.string().min(1),
  bagName: z.string().min(1),
  unitPrice: z.number().int(),
  totalDraws: z.number().int(),
  drawnCount: z.number().int(),
  realizedIncome: z.number().int().default(0),
  totalCost: z.number().int().default(0),
  residualValue: z.number().int().default(0),
  netProfitLoss: z.number().int().default(0),
  restoredItems: z.record(z.unknown()).nullable().optional(),
  isPointsSet: z.boolean().default(false),
  details: z.string(),
  operator: z.string().min(1),
  createdAt: z.string().optional(),
});
