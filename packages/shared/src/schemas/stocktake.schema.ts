import { z } from 'zod';
import { StocktakeStatusEnum } from '../types/enums';

export const StocktakeItemSchema = z.object({
  id: z.string().optional(),
  stocktakeId: z.string().optional(),
  productId: z.string().min(1),
  systemQty: z.number().int().min(0),
  actualQty: z.number().int().min(0),
  variance: z.number().int(),
  itemRemark: z.string().nullable().optional(),
});

export const StocktakeSchema = z.object({
  id: z.string(),
  storeId: z.string().min(1),
  status: z.enum(StocktakeStatusEnum),
  countedBy: z.string().min(1),
  postedBy: z.string().nullable().optional(),
  postedAt: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  items: z.array(StocktakeItemSchema).optional(),
});

export const CreateStocktakePayloadSchema = z.object({
  storeId: z.string().min(1),
  countedBy: z.string().min(1),
  note: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    actualQty: z.number().int().min(0),
    itemRemark: z.string().optional(),
  })).min(1, '盤點明細不可為空'),
});

export const PostStocktakePayloadSchema = z.object({
  postedBy: z.string().min(1),
  note: z.string().optional(),
});
