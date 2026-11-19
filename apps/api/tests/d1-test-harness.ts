import { createRequire } from 'node:module';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { drizzle } from 'drizzle-orm/d1';
import type {
  D1Database,
  D1ExecResult,
} from '@cloudflare/workers-types';

import * as schema from '@onesoul/db/schema';
import * as relations from '@onesoul/db/relations';
import type { OneSoulD1Database } from '@onesoul/db';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

export interface TestD1Instance {
  d1: D1Database;
  rawDb: any;
  db: OneSoulD1Database;
  seedCommonData: () => void;
}

const sanitizeParam = (v: any): any => {
  if (typeof v === 'boolean') {
    return v ? 1 : 0;
  }
  return v;
};

/**
 * 建立具備完整 SQLite 約束與 D1 介面相容之測試用記憶體資料庫
 */
export function createTestD1Database(options?: { autoMigrate?: boolean }): TestD1Instance {
  const rawDb = new DatabaseSync(':memory:');

  const d1 = {
    async exec(query: string): Promise<D1ExecResult> {
      rawDb.exec(query);
      return { count: 1, duration: 0 };
    },
    prepare(query: string) {
      let boundParams: any[] = [];
      const stmtObj = {
        bind(...values: any[]) {
          boundParams = values.map(sanitizeParam);
          return stmtObj;
        },
        async all() {
          const stmt = rawDb.prepare(query);
          const results = stmt.all(...boundParams);
          return { success: true, meta: {}, results };
        },
        async run() {
          const stmt = rawDb.prepare(query);
          const info = stmt.run(...boundParams);
          return { success: true, meta: info };
        },
        async first(colName?: string) {
          const stmt = rawDb.prepare(query);
          const row = stmt.get(...boundParams) as any;
          if (!row) return null;
          return colName ? row[colName] : row;
        },

        async raw() {
          const stmt = rawDb.prepare(query);
          const rows = stmt.all(...boundParams) as any[];
          return rows.map((r) => Object.values(r));
        },
      };
      return stmtObj;
    },
    async batch(statements: any[]) {
      rawDb.exec('BEGIN TRANSACTION;');
      try {
        const results: any[] = [];
        for (const s of statements) {
          results.push(await s.run());
        }
        rawDb.exec('COMMIT;');
        return results;
      } catch (err) {
        rawDb.exec('ROLLBACK;');
        throw err;
      }
    },
    async dump(): Promise<ArrayBuffer> {
      throw new Error('Not implemented in memory test harness');
    },
  } as unknown as D1Database;


  const db = drizzle(d1, {
    schema: { ...schema, ...relations },
  }) as OneSoulD1Database;

  const applyMigrations = () => {
    const migrationDir = path.resolve(
      __dirname,
      '../../../packages/db/drizzle/migrations'
    );
    const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
      const statements = sql.split('--> statement-breakpoint');
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (trimmed) {
          rawDb.exec(trimmed);
        }
      }
    }
  };

  if (options?.autoMigrate !== false) {
    applyMigrations();
  }

  const seedCommonData = () => {
    rawDb.exec(`
      INSERT OR IGNORE INTO stores (id, name, code, type, is_active)
      VALUES
        ('chupei', '竹北旗艦店', 'CP01', 'RETAIL', 1),
        ('jinshan', '金山概念店', 'JS01', 'RETAIL', 1),
        ('warehouse-main', '中央總倉', 'WH01', 'WAREHOUSE', 1);

      INSERT OR IGNORE INTO products (id, name, selling_price, cost_price, suggested_points, is_special)
      VALUES
        ('P-001', '海賊王 GK 潮流雕像', 3500, 2000, 175, 0),
        ('P-002', '火影忍者 鳴人 GK', 4200, 2500, 210, 0),
        ('0p', '純折點虛擬商品0P', 0, 0, 0, 1),
        ('1p', '保底折點虛擬商品1P', 0, 0, 1, 1),
        ('88888', '加點特殊代碼', 0, 0, 0, 1),
        ('99999', '扣點特殊代碼', 0, 0, 0, 1);


      INSERT OR IGNORE INTO cash_register_sessions (id, store_id, opened_by, opening_cash, status)
      VALUES
        ('sess-001', 'chupei', 'cashier@onesoul.com', 8000, 'OPEN');

      INSERT OR IGNORE INTO lucky_bags (id, store_id, name, unit_price, is_points_set, status)
      VALUES
        ('LB-01', 'chupei', '海賊頂上對決一番賞', 350, 0, 'ACTIVE');
    `);
  };

  return {
    d1,
    rawDb,
    db,
    seedCommonData,
  };
}
