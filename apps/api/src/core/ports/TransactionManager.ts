export interface TransactionManager {
  runInTransaction<T>(work: (tx: any) => Promise<T>): Promise<T>;
}
