import { z } from 'zod';
import { StoreTypeEnum } from '../types/enums';

export const StoreSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(StoreTypeEnum).default('RETAIL'),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  openTime: z.string().nullable().optional(),
  standardHours: z.number().int().default(8),
  lateGraceMinutes: z.number().int().default(15),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const CreateStoreSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(StoreTypeEnum).default('RETAIL'),
  address: z.string().optional(),
  phone: z.string().optional(),
  openTime: z.string().optional(),
  standardHours: z.number().int().default(8),
  lateGraceMinutes: z.number().int().default(15),
});

export const UpdateStoreSchema = CreateStoreSchema.partial();
