import { z } from 'zod';
import { OrderStatusEnum, OrderItemTypeEnum, DrawPickTypeEnum } from '../types/enums';

export const PaymentRecordSchema = z.object({
  method: z.string(),
  amount: z.number().int().min(0),
  ref: z.string().optional(),
});

export const DiscountRecordSchema = z.object({
  type: z.string(),
  amount: z.number().int().min(0),
  note: z.string().optional(),
});

export const CheckoutPaymentSchema = z.object({
  cash: z.number().int().min(0).default(0),
  creditCard: z.number().int().min(0).default(0),
  linePay: z.number().int().min(0).default(0),
  remittance: z.number().int().min(0).default(0),
  pointsUsed: z.number().int().min(0).default(0),
});

export const CheckoutLotteryItemSchema = z.object({
  id: z.string().min(1, '福袋代碼不可為空'),
  prize: z.string().min(1, '獎位等級不可為空'),
  draws: z.number().int().min(1, '抽數至少為 1'),
  type: z.enum(['帶走', '點數']).default('帶走'),
  unitPrice: z.number().int().min(0).default(0),
  amount: z.number().int().min(0).default(0),
  pointsCost: z.number().int().min(0).optional(),
  totalPoints: z.number().int().min(0).optional(),
  remark: z.string().optional(),
});

export const CheckoutMerchandiseItemSchema = z.object({
  id: z.string().min(1, '商品貨號不可為空'),
  name: z.string().min(1, '品名不可為空'),
  quantity: z.number().int().min(1, '數量至少為 1'),
  paymentType: z.enum(['現金', '點數', '贈送', 'POINTS']).default('現金'),
  unitAmount: z.number().int().min(0).default(0),
  actualAmount: z.number().int().min(0).default(0),
  totalPoints: z.number().int().min(0).default(0),
});

export const CheckoutPayloadSchema = z.object({
  branch: z.string().default('chupei'),
  storeId: z.string().min(1, '門市 ID 不可為空'),
  customer: z.object({
    phone: z.string().optional().default('WALKIN'),
    name: z.string().optional(),
  }),
  lotteries: z.array(CheckoutLotteryItemSchema).default([]),
  merchandises: z.array(CheckoutMerchandiseItemSchema).default([]),
  payment: CheckoutPaymentSchema,
  orderNote: z.string().optional(),
  checkoutUID: z.string().min(1, 'checkoutUID 唯一冪等鍵不可為空'),
  cashierEmail: z.string().email('收銀員帳號格式不正確'),
});

export const CheckoutResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  checkoutUID: z.string(),
  orderId: z.string().optional(),
  newPoints: z.number().int().default(0),
  pointsEarned: z.number().int().default(0),
  pointsDeducted: z.number().int().default(0),
  netPointsDelta: z.number().int().default(0),
  traceId: z.string().optional(),
});

export const OrderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  itemType: z.enum(OrderItemTypeEnum),
  bagId: z.string().nullable().optional(),
  prizeGrade: z.string().nullable().optional(),
  prizeName: z.string().nullable().optional(),
  pickType: z.enum(DrawPickTypeEnum).nullable().optional(),
  draws: z.number().int().nullable().optional(),
  productId: z.string().nullable().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().int().min(0),
  amount: z.number().int().min(0),
  pointsImpact: z.number().int().default(0),
  remark: z.string().nullable().optional(),
});

export const OrderSchema = z.object({
  id: z.string(),
  checkoutUID: z.string(),
  storeId: z.string(),
  sessionId: z.string(),
  memberId: z.string().nullable().optional(),
  status: z.enum(OrderStatusEnum),
  totalDue: z.number().int(),
  receivedAmount: z.number().int(),
  payments: z.array(PaymentRecordSchema).nullable().optional(),
  discounts: z.array(DiscountRecordSchema).nullable().optional(),
  cash: z.number().int(),
  creditCard: z.number().int(),
  linePay: z.number().int(),
  remittance: z.number().int(),
  pointsUsed: z.number().int(),
  netPointsDelta: z.number().int(),
  cashierEmail: z.string(),
  orderNote: z.string().nullable().optional(),
  voidReason: z.string().nullable().optional(),
  voidedAt: z.string().nullable().optional(),
  voidedBy: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(OrderItemSchema).optional(),
});

export const OrderVoidPayloadSchema = z.object({
  voidReason: z.string().min(2, '請填寫至少 2 字之作廢原因'),
  voidedBy: z.string().min(1, '請提供作廢操作者'),
});
