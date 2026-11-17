import type { TransactionManager } from '../../core/ports/TransactionManager';
import type { OneSoulD1Database } from '@onesoul/db';

export class D1TransactionManager implements TransactionManager {
  constructor(private readonly db: OneSoulD1Database) {}

  async runInTransaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx) => {
      return await work(tx);
    });
  }
}
