import type { TransactionManager } from '../../core/ports/TransactionManager';

export interface TransactionalMemoryRepo {
  beginTx(): void;
  commitTx(): void;
  rollbackTx(): void;
}

export class InMemoryTransactionManager implements TransactionManager {
  private registeredRepos: TransactionalMemoryRepo[] = [];

  register(repo: TransactionalMemoryRepo): void {
    this.registeredRepos.push(repo);
  }

  async runInTransaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
    // 1. Snapshot all registered repositories
    for (const repo of this.registeredRepos) {
      repo.beginTx();
    }

    try {
      const result = await work({});
      // 2. Commit transaction
      for (const repo of this.registeredRepos) {
        repo.commitTx();
      }
      return result;
    } catch (error) {
      // 3. Rollback all repositories to snapshot
      for (const repo of this.registeredRepos) {
        repo.rollbackTx();
      }
      throw error;
    }
  }
}
