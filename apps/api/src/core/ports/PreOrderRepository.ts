import type { PreOrder } from '../entities/PreOrder';
import type { PreOrderStatus } from '@onesoul/shared';

export interface PreOrderRepository {
  findById(id: string, tx?: any): Promise<PreOrder | null>;
  create(preOrder: PreOrder, tx?: any): Promise<void>;
  save(preOrder: PreOrder, tx?: any): Promise<void>;
  list(status?: PreOrderStatus, tx?: any): Promise<PreOrder[]>;
}
