import { z } from 'zod';
import { TransferStatusEnum } from '../types/enums';

export const TransferOrderItemSchema = z.object({
  id: z.string().optional(),
  transferId: z.string().optional(),
  productId: z.string().min(1, '商品 ID 不可為空'),
  requestedQty: z.number().int().min(1, '申請數量至少為 1'),
  shippedQty: z.number().int().min(0).default(0),
  receivedQty: z.number().int().min(0).default(0),
  remark: z.string().nullable().optional(),
});

export const TransferOrderSchema = z.object({
  id: z.string(),
  transferNo: z.string(),
  sourceStoreId: z.string(),
  targetStoreId: z.string(),
  status: z.enum(TransferStatusEnum),
  dispatchedAt: z.string().nullable().optional(),
  receivedAt: z.string().nullable().optional(),
  dispatchedBy: z.string().nullable().optional(),
  receivedBy: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  items: z.array(TransferOrderItemSchema).optional(),
});

export const CreateTransferPayloadSchema = z.object({
  sourceStoreId: z.string().min(1),
  targetStoreId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    requestedQty: z.number().int().min(1),
    remark: z.string().optional(),
  })).min(1, '至少需包含一項調撥品項'),
  dispatchedBy: z.string().min(1),
  note: z.string().optional(),
});

export const UpdateTransferStatusPayloadSchema = z.object({
  status: z.enum(TransferStatusEnum),
  operator: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(0),
  })).optional(),
  note: z.string().optional(),
});
