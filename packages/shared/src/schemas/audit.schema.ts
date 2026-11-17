import { z } from 'zod';

export const AuditLogSchema = z.object({
  id: z.string(),
  operatorId: z.string().min(1),
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  beforeState: z.record(z.unknown()).nullable().optional(),
  afterState: z.record(z.unknown()).nullable().optional(),
  delta: z.number().nullable().optional(),
  reason: z.string().min(1),
  ipAddress: z.string().nullable().optional(),
  prevHash: z.string().nullable().optional(),
  currentHash: z.string().min(1),
  createdAt: z.string().optional(),
});

export const CreateAuditLogPayloadSchema = z.object({
  operatorId: z.string().min(1),
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  beforeState: z.record(z.unknown()).optional(),
  afterState: z.record(z.unknown()).optional(),
  delta: z.number().optional(),
  reason: z.string().min(1),
  ipAddress: z.string().optional(),
});

export const VerifyAuditChainResponseSchema = z.object({
  valid: z.boolean(),
  totalCount: z.number().int().min(0),
  brokenAt: z.string().optional(),
  message: z.string(),
});
