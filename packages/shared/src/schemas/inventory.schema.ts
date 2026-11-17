import { z } from 'zod';
import {
  ProductCategoryEnum,
  ProductConditionEnum,
  InventoryChangeTypeEnum,
} from '../types/enums';

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  code: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const ProductSchema = z.object({
  id: z.string().min(1, '貨號不可為空'),
  barcode: z.string().nullable().optional(),
  name: z.string().min(1, '品名不可為空'),
  categoryId: z.string().nullable().optional(),
  mainCategory: z.string().default('GK'),
  subCategory: z.string().nullable().optional(),
  category: z.enum(ProductCategoryEnum).default('GENERAL'),
  brand: z.string().nullable().optional(),
  series: z.string().nullable().optional(),
  condition: z.enum(ProductConditionEnum).default('NEW'),
  costPrice: z.number().int().min(0).default(0),
  allocationCost: z.number().int().nullable().optional(),
  sellingPrice: z.number().int().min(0).default(0),
  suggestedPoints: z.number().int().min(0).default(0),
  version: z.number().int().default(0),
  isSpecial: z.boolean().default(false),
  remark: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const StoreInventorySchema = z.object({
  id: z.string(),
  storeId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().min(0, '門市現貨不可小於 0'),
  safetyStock: z.number().int().min(0).default(0),
  version: z.number().int().default(0),
  updatedAt: z.string().optional(),
});

export const InventoryLogSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  productId: z.string(),
  changeType: z.enum(InventoryChangeTypeEnum),
  delta: z.number().int(),
  balance: z.number().int().min(0),
  orderId: z.string().nullable().optional(),
  stocktakeId: z.string().nullable().optional(),
  operator: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const AdjustStockPayloadSchema = z.object({
  storeId: z.string().min(1),
  productId: z.string().min(1),
  delta: z.number().int(),
  changeType: z.enum(InventoryChangeTypeEnum).default('MANUAL_ADJUST'),
  reason: z.string().min(2, '請填寫調整原因'),
  operator: z.string().min(1),
});
