import { z } from 'zod';
import { LuckyBagStatusEnum } from '../types/enums';

export const LuckyBagPrizeSchema = z.object({
  id: z.string(),
  bagId: z.string(),
  prizeGrade: z.string().min(1),
  prizeName: z.string().min(1),
  productId: z.string().nullable().optional(),
  points: z.number().int().min(0).default(0),
  draws: z.number().int().min(1).default(1),
  drawnCount: z.number().int().min(0).default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const LuckyBagSchema = z.object({
  id: z.string().min(1),
  storeId: z.string().min(1),
  name: z.string().min(1),
  unitPrice: z.number().int().min(0).default(0),
  isPointsSet: z.boolean().default(false),
  status: z.enum(LuckyBagStatusEnum).default('ACTIVE'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  prizes: z.array(LuckyBagPrizeSchema).optional(),
});

export const PrizeAllocationItemSchema = z.object({
  grade: z.string().min(1),
  name: z.string().min(1),
  productId: z.string().nullable().optional(),
  draws: z.number().int().min(1),
  points: z.number().int().min(0).default(0),
  cost: z.number().int().min(0).default(0),
});

export const PrizeAllocationPlanSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  name: z.string().min(1),
  status: z.string().default('DRAFT'),
  totalDraws: z.number().int().min(1),
  price1: z.number().int().min(0).default(0),
  price3: z.number().int().min(0).default(0),
  price5: z.number().int().min(0).default(0),
  price10: z.number().int().min(0).default(0),
  isTenPlusOne: z.boolean().default(false),
  targetMargin: z.number().min(0).default(0),
  items: z.array(PrizeAllocationItemSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const PublishPlansPayloadSchema = z.object({
  storeId: z.string().min(1),
  planId: z.string().optional(),
  name: z.string().min(1),
  unitPrice: z.number().int().min(0),
  isPointsSet: z.boolean().default(false),
  setCount: z.number().int().min(1).max(50).default(1),
  items: z.array(PrizeAllocationItemSchema).min(1),
  operator: z.string().min(1),
});
