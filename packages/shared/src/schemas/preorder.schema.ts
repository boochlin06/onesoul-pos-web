import { z } from 'zod';
import { PreOrderStatusEnum, PurchaseOrderStatusEnum } from '../types/enums';

export const PreOrderSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  version: z.string().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  deposit: z.number().int().min(0).default(0),
  finalPayment: z.number().int().min(0).default(0),
  shippingFee: z.number().int().min(0).default(0),
  totalCost: z.number().int().min(0).default(0),
  supplier: z.string().nullable().optional(),
  targetStoreId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  status: z.enum(PreOrderStatusEnum).default('PENDING'),
  arrivedAt: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const CreatePreOrderPayloadSchema = z.object({
  name: z.string().min(1, '預購品名不可為空'),
  version: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  deposit: z.number().int().min(0).default(0),
  supplier: z.string().optional(),
  targetStoreId: z.string().optional(),
  note: z.string().optional(),
});

export const ReceivePreOrderPayloadSchema = z.object({
  productId: z.string().min(1, '貨號不可為空'),
  finalPayment: z.number().int().min(0).default(0),
  shippingFee: z.number().int().min(0).default(0),
  sellingPrice: z.number().int().min(0),
  targetStoreId: z.string().min(1, '入庫門市不可為空'),
  operator: z.string().min(1),
  note: z.string().optional(),
});

export const PurchaseOrderSchema = z.object({
  id: z.string(),
  orderNo: z.string().min(1),
  title: z.string().min(1),
  supplier: z.string().nullable().optional(),
  status: z.enum(PurchaseOrderStatusEnum).default('DRAFT'),
  unitPrice: z.number().int().min(0).default(0),
  qtyChupei: z.number().int().min(0).default(0),
  qtyJinshan: z.number().int().min(0).default(0),
  totalQty: z.number().int().min(0).default(0),
  totalAmount: z.number().int().min(0).default(0),
  note: z.string().nullable().optional(),
  rawQuote: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
