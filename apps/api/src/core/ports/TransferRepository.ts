import type { TransferOrder, TransferOrderItem } from '../entities/TransferOrder';
import type { TransferStatus } from '@onesoul/shared';

export interface TransferRepository {
  findById(id: string, tx?: any): Promise<TransferOrder | null>;
  findByTransferNo(transferNo: string, tx?: any): Promise<TransferOrder | null>;
  createTransfer(order: TransferOrder, items: TransferOrderItem[], tx?: any): Promise<void>;
  updateStatus(id: string, status: TransferStatus, operator: string, tx?: any): Promise<void>;
  save(order: TransferOrder, tx?: any): Promise<void>;
  findItemsByTransferId(transferId: string, tx?: any): Promise<TransferOrderItem[]>;
  listByStore(storeId: string, tx?: any): Promise<TransferOrder[]>;
}
