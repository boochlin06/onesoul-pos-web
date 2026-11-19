import type { TransactionManager } from '../../core/ports/TransactionManager';
import type { OneSoulD1Database } from '@onesoul/db';
import {
  InsufficientStockError,
  InsufficientPointsError,
  OverdrawError,
} from '@onesoul/shared';

export interface BatchCollector {
  add(stmt: any): void;
  execute(): Promise<any[]>;
}

export class D1TransactionManager implements TransactionManager {
  constructor(private readonly db: OneSoulD1Database) {}

  async runInTransaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
    const statements: any[] = [];

    const proxy = this.createBatchProxy(this.db, statements);
    const result = await work(proxy);

    if (statements.length > 0) {
      try {
        await this.db.batch(statements as any);
      } catch (error: any) {
        this.translateConstraintError(error);
      }
    }

    return result;
  }

  private translateConstraintError(error: any): never {
    const msg = error?.message || String(error);
    if (
      msg.includes('store_inventories_quantity_check') ||
      msg.includes('CHECK constraint failed: store_inventories') ||
      (msg.includes('CHECK constraint failed') && msg.includes('quantity'))
    ) {
      throw new InsufficientStockError('門市現貨不足，資料庫 CHECK 約束觸發回滾');
    }
    if (
      msg.includes('members_points_check') ||
      (msg.includes('CHECK constraint failed') && msg.includes('points'))
    ) {
      throw new InsufficientPointsError('會員點數不足，資料庫 CHECK 約束觸發回滾');
    }
    if (
      msg.includes('lucky_bag_prizes_drawn_count_check') ||
      (msg.includes('CHECK constraint failed') && msg.includes('drawn_count'))
    ) {
      throw new OverdrawError('獎項抽數已達上限，資料庫 CHECK 約束觸發回滾');
    }
    throw error;
  }

  private createBatchProxy(db: any, statements: any[]): any {
    const insertedKeys = new Set<string>();

    const wrapBuilder = (builder: any): any => {
      return new Proxy(builder, {
        get(bTarget, bProp, bReceiver) {
          if (bProp === 'then') {
            return (onFulfilled?: any, onRejected?: any) => {
              statements.push(bTarget);
              return Promise.resolve({ success: true, meta: { changes: 1 } }).then(
                onFulfilled,
                onRejected
              );
            };
          }
          const method = Reflect.get(bTarget, bProp, bReceiver);
          if (typeof method === 'function') {
            return (...args: any[]) => {
              const next = method.apply(bTarget, args);
              return wrapBuilder(next);
            };
          }
          return method;
        },
      });
    };

    const handler: ProxyHandler<any> = {
      get: (target, prop, receiver) => {
        if (prop === '_insertedKeys') {
          return insertedKeys;
        }
        if (prop === 'insert' || prop === 'update' || prop === 'delete') {
          return (...args: any[]) => {
            const query = target[prop](...args);
            return wrapBuilder(query);
          };
        }
        if (prop === 'batch') {
          return (stmts: any[]) => {
            statements.push(...stmts);
            return Promise.resolve(stmts.map(() => ({ success: true })));
          };
        }
        const val = Reflect.get(target, prop, receiver);
        if (typeof val === 'function') {
          return val.bind(target);
        }
        return val;
      },
    };

    return new Proxy(db, handler);
  }
}
