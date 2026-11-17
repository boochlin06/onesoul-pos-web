import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

describe('Empirical D1 SQLite Schema Constraints Challenge', () => {
  let db: any;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    const migrationPath = path.resolve(__dirname, '../drizzle/migrations/0000_smart_ink.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const statements = sql.split('--> statement-breakpoint');
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) {
        db.exec(trimmed);
      }
    }

    // Seed common foreign key references
    db.exec(`INSERT INTO stores (id, name, code, type, is_active) VALUES ('chupei', '竹北旗艦店', 'CP01', 'RETAIL', 1);`);
    db.exec(`INSERT INTO products (id, name, selling_price, cost_price) VALUES ('P-001', '海賊王 GK 雕像', 3500, 2000);`);
    db.exec(`INSERT INTO products (id, name, selling_price, cost_price) VALUES ('P-002', '火影忍者 鳴人 GK', 4200, 2500);`);
    db.exec(`INSERT INTO cash_register_sessions (id, store_id, opened_by, opening_cash, status) VALUES ('sess-001', 'chupei', 'cashier@onesoul.com', 8000, 'OPEN');`);
    db.exec(`INSERT INTO lucky_bags (id, store_id, name, unit_price, status) VALUES ('LB-01', 'chupei', '海賊頂上對決一番賞', 350, 'ACTIVE');`);
  });

  describe('1. store_inventories: CHECK (quantity >= 0)', () => {
    it('should REJECT insert with negative quantity (-1)', () => {
      expect(() => {
        db.exec(`
          INSERT INTO store_inventories (id, store_id, product_id, quantity)
          VALUES ('inv-neg-1', 'chupei', 'P-001', -1);
        `);
      }).toThrow(/CHECK constraint failed: store_inventories_quantity_check/);
    });

    it('should REJECT insert with large negative quantity (-100)', () => {
      expect(() => {
        db.exec(`
          INSERT INTO store_inventories (id, store_id, product_id, quantity)
          VALUES ('inv-neg-100', 'chupei', 'P-001', -100);
        `);
      }).toThrow(/CHECK constraint failed: store_inventories_quantity_check/);
    });

    it('should ACCEPT insert with zero quantity (boundary condition: quantity = 0)', () => {
      expect(() => {
        db.exec(`
          INSERT INTO store_inventories (id, store_id, product_id, quantity)
          VALUES ('inv-zero', 'chupei', 'P-001', 0);
        `);
      }).not.toThrow();

      const stmt = db.prepare(`SELECT quantity FROM store_inventories WHERE id = 'inv-zero';`);
      const row = stmt.get() as { quantity: number };
      expect(row.quantity).toBe(0);
    });

    it('should REJECT update that results in negative quantity (-5)', () => {
      db.exec(`
        INSERT INTO store_inventories (id, store_id, product_id, quantity)
        VALUES ('inv-update-test', 'chupei', 'P-001', 10);
      `);

      expect(() => {
        db.exec(`
          UPDATE store_inventories SET quantity = -5 WHERE id = 'inv-update-test';
        `);
      }).toThrow(/CHECK constraint failed: store_inventories_quantity_check/);

      // Verify original quantity is intact
      const stmt = db.prepare(`SELECT quantity FROM store_inventories WHERE id = 'inv-update-test';`);
      const row = stmt.get() as { quantity: number };
      expect(row.quantity).toBe(10);
    });
  });

  describe('2. lucky_bag_prizes: CHECK (drawn_count <= draws)', () => {
    it('should REJECT insert with drawn_count > draws (81 > 80)', () => {
      expect(() => {
        db.exec(`
          INSERT INTO lucky_bag_prizes (id, bag_id, prize_grade, prize_name, draws, drawn_count)
          VALUES ('p-overdraw-1', 'LB-01', 'A', '魯夫A賞', 80, 81);
        `);
      }).toThrow(/CHECK constraint failed: lucky_bag_prizes_drawn_count_check/);
    });

    it('should REJECT insert with drawn_count > draws on small sample (2 > 1)', () => {
      expect(() => {
        db.exec(`
          INSERT INTO lucky_bag_prizes (id, bag_id, prize_grade, prize_name, draws, drawn_count)
          VALUES ('p-overdraw-2', 'LB-01', 'LAST', '最後賞', 1, 2);
        `);
      }).toThrow(/CHECK constraint failed: lucky_bag_prizes_drawn_count_check/);
    });

    it('should ACCEPT boundary condition when drawn_count === draws (80 === 80)', () => {
      expect(() => {
        db.exec(`
          INSERT INTO lucky_bag_prizes (id, bag_id, prize_grade, prize_name, draws, drawn_count)
          VALUES ('p-boundary', 'LB-01', 'A', '魯夫A賞', 80, 80);
        `);
      }).not.toThrow();

      const stmt = db.prepare(`SELECT drawn_count, draws FROM lucky_bag_prizes WHERE id = 'p-boundary';`);
      const row = stmt.get() as { drawn_count: number; draws: number };
      expect(row.drawn_count).toBe(80);
      expect(row.draws).toBe(80);
    });

    it('should REJECT update that increments drawn_count beyond total draws (from 80 to 81)', () => {
      db.exec(`
        INSERT INTO lucky_bag_prizes (id, bag_id, prize_grade, prize_name, draws, drawn_count)
        VALUES ('p-update-test', 'LB-01', 'B', '索隆B賞', 80, 79);
      `);

      // Update to exactly equal draws is allowed
      expect(() => {
        db.exec(`UPDATE lucky_bag_prizes SET drawn_count = 80 WHERE id = 'p-update-test';`);
      }).not.toThrow();

      // Update beyond draws is blocked
      expect(() => {
        db.exec(`UPDATE lucky_bag_prizes SET drawn_count = 81 WHERE id = 'p-update-test';`);
      }).toThrow(/CHECK constraint failed: lucky_bag_prizes_drawn_count_check/);

      const stmt = db.prepare(`SELECT drawn_count FROM lucky_bag_prizes WHERE id = 'p-update-test';`);
      const row = stmt.get() as { drawn_count: number };
      expect(row.drawn_count).toBe(80);
    });
  });

  describe('3. orders: UNIQUE (checkout_uid)', () => {
    it('should ACCEPT unique checkout_uid', () => {
      expect(() => {
        db.exec(`
          INSERT INTO orders (id, checkout_uid, store_id, session_id, cashier_email, total_due, received_amount)
          VALUES ('ord-001', 'UID-UNIQUE-20261108-001', 'chupei', 'sess-001', 'cashier@onesoul.com', 350, 350);
        `);
      }).not.toThrow();
    });

    it('should REJECT duplicate checkout_uid on INSERT', () => {
      db.exec(`
        INSERT INTO orders (id, checkout_uid, store_id, session_id, cashier_email, total_due, received_amount)
        VALUES ('ord-001', 'UID-DUPLICATE-001', 'chupei', 'sess-001', 'cashier@onesoul.com', 350, 350);
      `);

      expect(() => {
        db.exec(`
          INSERT INTO orders (id, checkout_uid, store_id, session_id, cashier_email, total_due, received_amount)
          VALUES ('ord-002', 'UID-DUPLICATE-001', 'chupei', 'sess-001', 'cashier@onesoul.com', 700, 700);
        `);
      }).toThrow(/UNIQUE constraint failed: orders\.checkout_uid/);
    });

    it('should REJECT updating checkout_uid to an existing checkout_uid', () => {
      db.exec(`
        INSERT INTO orders (id, checkout_uid, store_id, session_id, cashier_email, total_due, received_amount)
        VALUES ('ord-001', 'UID-FIRST', 'chupei', 'sess-001', 'cashier@onesoul.com', 350, 350);
      `);
      db.exec(`
        INSERT INTO orders (id, checkout_uid, store_id, session_id, cashier_email, total_due, received_amount)
        VALUES ('ord-002', 'UID-SECOND', 'chupei', 'sess-001', 'cashier@onesoul.com', 500, 500);
      `);

      expect(() => {
        db.exec(`
          UPDATE orders SET checkout_uid = 'UID-FIRST' WHERE id = 'ord-002';
        `);
      }).toThrow(/UNIQUE constraint failed: orders\.checkout_uid/);
    });
  });
});
