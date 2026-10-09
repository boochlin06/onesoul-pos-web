import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma, initPrisma } from '../../plugins/prisma';
import { PointLogType, LuckyBagStatus, OrderStatus } from '@prisma/client';
import { loadSheetData } from './parser';
import { normalizePhone, parseNumber, parseSheetDate, normalizeStoreId } from './cleaner';
import {
  RawMemberRow,
  RawProductRow,
  RawLuckyBagRow,
  RawSalesRecordRow,
  RawSessionRow,
  MigrationAuditReport,
} from './types';

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export class SheetMigrator {
  private dataDir: string;
  private isDryRun: boolean;
  private report: MigrationAuditReport;

  constructor(options: { dataDir?: string; dryRun?: boolean } = {}) {
    this.dataDir = options.dataDir || path.resolve(process.cwd(), 'data/sheets');
    this.isDryRun = options.dryRun ?? true;
    this.report = {
      summary: {
        totalExtracted: 0,
        totalImported: 0,
        totalConflicts: 0,
        dryRun: this.isDryRun,
        executedAt: new Date().toISOString(),
      },
      details: {
        members: { extracted: 0, imported: 0, conflicts: 0 },
        products: { extracted: 0, imported: 0 },
        inventories: { importedChupei: 0, importedJinshan: 0 },
        luckyBags: { importedBags: 0, importedPrizes: 0 },
        sessions: { imported: 0 },
        orders: { imported: 0, itemsImported: 0 },
      },
      conflicts: [],
    };
  }

  public async run(): Promise<MigrationAuditReport> {
    const startTime = performance.now();
    await initPrisma();
    console.log(`\n========================================================`);
    console.log(`🚀 OneSoul POS Google Sheets 高性能批次 ETL 遷移引擎啟動`);
    console.log(`模式: ${this.isDryRun ? '🔍 預演檢查 (DRY-RUN，不寫入資料庫)' : '⚡ 正式執行 (EXECUTE，批次寫入資料庫)'}`);
    console.log(`來源目錄: ${this.dataDir}`);
    console.log(`========================================================\n`);

    // 1. 初始化門市主檔
    await this.migrateStores();

    // 2. 批次遷移會員主檔與點數
    await this.migrateMembers();

    // 3. 批次遷移商品主檔與門市庫存
    await this.migrateProductsAndInventory();

    // 4. 批次遷移一番賞配置庫與獎項
    await this.migrateLuckyBags();

    // 5. 批次遷移歷史開關帳班次
    await this.migrateSessions();

    // 6. 預載快取 + 向量化批次遷移歷史銷售紀錄
    await this.migrateSalesHistory();

    // 計算總結
    this.report.summary.totalConflicts = this.report.conflicts.length;
    this.report.summary.totalImported =
      this.report.details.members.imported +
      this.report.details.products.imported +
      this.report.details.luckyBags.importedBags +
      this.report.details.sessions.imported +
      this.report.details.orders.imported;

    // 輸出審計報告
    const reportPath = path.resolve(this.dataDir, 'migration_audit_report.json');
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2), 'utf-8');

    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`\n========================================================`);
    console.log(`🏁 遷移完成！總耗時: ⚡ ${duration} 秒`);
    console.log(`審計報告已輸出至: ${reportPath}`);
    console.log(`總提取資料: ${this.report.summary.totalExtracted} 筆`);
    console.log(`成功匯入: ${this.report.summary.totalImported} 筆`);
    console.log(`衝突/跳過: ${this.report.summary.totalConflicts} 筆`);
    console.log(`========================================================\n`);

    return this.report;
  }

  // ── 1. 門市主檔 ───────────────────────────────────────────
  private async migrateStores() {
    const stores = [
      { id: 'chupei', name: '竹北店', code: 'CHUPEI', openTime: '14:00', standardHours: 8, lateGraceMinutes: 15 },
      { id: 'jinshan', name: '金山店', code: 'JINSHAN', openTime: '16:00', standardHours: 6, lateGraceMinutes: 15 },
    ];

    if (!this.isDryRun) {
      for (const s of stores) {
        const exist = await prisma.store.findUnique({ where: { id: s.id } });
        if (!exist) {
          await prisma.store.create({ data: s });
        }
      }
    }
  }

  // ── 2. 會員主檔 (Bulk Batch Insert) ────────────────────────
  private async migrateMembers() {
    const rawMembers = this.loadData<RawMemberRow>('members');
    this.report.details.members.extracted = rawMembers.length;
    this.report.summary.totalExtracted += rawMembers.length;

    const seenPhones = new Map<string, RawMemberRow>();

    for (const raw of rawMembers) {
      const { phone, isValid, note } = normalizePhone(raw.phone);
      if (!isValid || !phone) {
        this.report.conflicts.push({
          type: 'MEMBER_PHONE_DUPLICATE',
          identifier: raw.phone || 'UNKNOWN',
          description: `無效電話格式: ${note}`,
          raw,
          resolution: '跳過未入庫',
        });
        continue;
      }

      if (seenPhones.has(phone)) {
        this.report.conflicts.push({
          type: 'MEMBER_PHONE_DUPLICATE',
          identifier: phone,
          description: `重複電話號碼，以最新紀錄覆蓋`,
          raw,
          resolution: '以最新版本為準',
        });
      }
      seenPhones.set(phone, raw);
    }

    console.log(`👥 會員主檔: 提取 ${rawMembers.length} 筆，標準化後有效 ${seenPhones.size} 筆`);

    if (!this.isDryRun && seenPhones.size > 0) {
      const memberList: any[] = [];
      const pointLogList: any[] = [];

      for (const [phone, raw] of seenPhones) {
        const memberId = crypto.randomUUID();
        const points = parseNumber(raw.points, 0);
        const registeredAt = parseSheetDate(raw.timestamp);

        memberList.push({
          id: memberId,
          phone,
          name: raw.name || phone,
          points,
          birthday: raw.birthday ? raw.birthday.toString() : null,
          gender: raw.gender ? raw.gender.toString() : null,
          registeredAt,
        });

        if (points > 0) {
          pointLogList.push({
            memberId,
            type: PointLogType.MANUAL,
            delta: points,
            balance: points,
            reason: 'Google Sheets 舊系統點數期初結轉',
          });
        }
      }

      // 分塊批次寫入 (每批 500 筆)
      for (const chunk of chunkArray(memberList, 500)) {
        await prisma.member.createMany({ data: chunk });
      }
      if (pointLogList.length > 0) {
        for (const chunk of chunkArray(pointLogList, 1000)) {
          await prisma.pointLog.createMany({ data: chunk });
        }
      }
    }

    this.report.details.members.imported = seenPhones.size;
  }

  // ── 3. 商品主檔與分店庫存 (Bulk Batch Insert) ───────────────
  private async migrateProductsAndInventory() {
    const rawItems = this.loadData<RawProductRow>('items');
    this.report.details.products.extracted = rawItems.length;
    this.report.summary.totalExtracted += rawItems.length;

    const productMap = new Map<string, { product: any; chupeiQty: number; jinshanQty: number }>();

    for (const it of rawItems) {
      if (!it.id && !it.name) continue;
      const id = (it.id || it.name).toString().trim();
      const branch = normalizeStoreId(it.branch);
      const qty = parseNumber(it.quantity, 0);
      const points = parseNumber(it.points, 0);
      const cost = parseNumber(it.cost, 0);
      const price = parseNumber(it.price, 0);

      if (!productMap.has(id)) {
        productMap.set(id, {
          product: {
            id,
            name: it.name || id,
            category: it.category || 'GENERAL',
            costPrice: cost,
            sellingPrice: price,
            suggestedPoints: points,
          },
          chupeiQty: 0,
          jinshanQty: 0,
        });
      }

      const entry = productMap.get(id)!;
      if (branch === 'jinshan') {
        entry.jinshanQty += qty;
      } else {
        entry.chupeiQty += qty;
      }
    }

    console.log(`📦 商品庫存: 提取 ${rawItems.length} 筆，聚合為 ${productMap.size} 個獨立商品主檔`);

    if (!this.isDryRun && productMap.size > 0) {
      const productList: any[] = [];
      const inventoryList: any[] = [];

      for (const [id, entry] of productMap) {
        productList.push(entry.product);

        inventoryList.push({
          storeId: 'chupei',
          productId: id,
          quantity: entry.chupeiQty,
          safetyStock: 1,
        });
        this.report.details.inventories.importedChupei++;

        inventoryList.push({
          storeId: 'jinshan',
          productId: id,
          quantity: entry.jinshanQty,
          safetyStock: 1,
        });
        this.report.details.inventories.importedJinshan++;
      }

      for (const chunk of chunkArray(productList, 500)) {
        await prisma.product.createMany({ data: chunk });
      }
      for (const chunk of chunkArray(inventoryList, 500)) {
        await prisma.storeInventory.createMany({ data: chunk });
      }
    }

    this.report.details.products.imported = productMap.size;
  }

  // ── 4. 一番賞配置庫 ───────────────────────────────────────
  private async migrateLuckyBags() {
    const rawBags = this.loadData<RawLuckyBagRow>('luckybags');
    this.report.summary.totalExtracted += rawBags.length;

    console.log(`🎁 一番賞套組: 提取 ${rawBags.length} 個套組`);

    if (!this.isDryRun) {
      for (const b of rawBags) {
        const bagId = b.bagId.toString();
        const storeId = normalizeStoreId(b.store);

        await prisma.luckyBag.create({
          data: {
            id: bagId,
            storeId,
            name: b.name,
            unitPrice: parseNumber(b.price, 350),
            isPointsSet: !!b.isPointsSet,
            status: LuckyBagStatus.ACTIVE,
          },
        });
        this.report.details.luckyBags.importedBags++;

        if (Array.isArray(b.prizes) && b.prizes.length > 0) {
          const prizeList = b.prizes.map((p) => ({
            bagId,
            prizeGrade: p.prizeGrade,
            prizeName: p.prizeName,
            productId: p.productId || null,
            points: parseNumber(p.points, 0),
            draws: parseNumber(p.draws, 1),
            drawnCount: parseNumber(p.drawnCount, 0),
          }));

          await prisma.luckyBagPrize.createMany({ data: prizeList });
          this.report.details.luckyBags.importedPrizes += prizeList.length;
        }
      }
    }
  }

  // ── 5. 歷史開關帳班次 ─────────────────────────────────────
  private async migrateSessions() {
    const rawSessions = this.loadData<RawSessionRow>('sessions');
    this.report.summary.totalExtracted += rawSessions.length;

    console.log(`💼 班次開關帳: 提取 ${rawSessions.length} 筆歷史班次`);

    if (!this.isDryRun && rawSessions.length > 0) {
      for (const s of rawSessions) {
        const storeId = normalizeStoreId(s.store);
        await prisma.cashRegisterSession.create({
          data: {
            storeId,
            openedBy: s.openedBy || 'system',
            closedBy: s.closedBy || null,
            openingCash: parseNumber(s.openingCash, 0),
            actualCash: s.actualCash !== undefined ? parseNumber(s.actualCash) : null,
            status: s.closedAt ? 'CLOSED' : 'OPEN',
            openedAt: parseSheetDate(s.openedAt),
            closedAt: s.closedAt ? parseSheetDate(s.closedAt) : null,
            note: s.note || 'Google Sheets 歷史班次遷移',
          },
        });
        this.report.details.sessions.imported++;
      }
    }
  }

  // ── 6. 全量歷史銷售明細聚合遷移 (預載快取 + 向量化分塊批次寫入) ──
  private async migrateSalesHistory() {
    const rawSales = this.loadData<RawSalesRecordRow>('sales_history');
    this.report.summary.totalExtracted += rawSales.length;

    // 依 orderKey 聚合明細
    const orderMap = new Map<string, { meta: any; items: any[] }>();

    for (const r of rawSales) {
      const { phone } = normalizePhone(r.phone);
      const storeId = normalizeStoreId(r.store);
      const orderKey = r.orderId || `${phone || 'WALKIN'}_${r.createdAt || Date.now()}`;

      if (!orderMap.has(orderKey)) {
        orderMap.set(orderKey, {
          meta: {
            checkoutUID: orderKey,
            storeId,
            phone,
            createdAt: parseSheetDate(r.createdAt),
            totalDue: parseNumber(r.receivedAmount, 0),
            cash: parseNumber(r.cash, 0),
            creditCard: parseNumber(r.creditCard, 0),
            remittance: parseNumber(r.remittance, 0),
            pointsDelta: parseNumber(r.pointsDelta, 0),
            cashier: r.cashier || 'system',
            note: r.note || '',
          },
          items: [],
        });
      }

      const ord = orderMap.get(orderKey)!;
      ord.items.push({
        itemType: r.itemType || 'LOTTERY',
        productId: r.itemCode || null,
        prizeGrade: r.prizeGrade || '',
        prizeName: r.itemName || '',
        pickType: r.pickMethod === '點數' ? 'POINTS' : 'TAKE_AWAY',
        draws: 1,
        unitPrice: parseNumber(r.unitPrice, 0),
        amount: parseNumber(r.unitPrice, 0),
      });
    }

    console.log(`🛒 歷史銷售紀錄: 提取 ${rawSales.length} 筆明細，聚合為 ${orderMap.size} 筆訂單`);

    if (!this.isDryRun && orderMap.size > 0) {
      // ⚡ 效能核心優化 1：一次性預載所有會員電話對映 (Pre-fetch O(1) Lookup)
      // 將原本每筆訂單一次 DB 查詢，縮減為全量僅 1 次 DB 查詢！
      const allMembers = await prisma.member.findMany({ select: { id: true, phone: true } });
      const phoneToMemberId = new Map<string, string>(allMembers.map((m: any) => [m.phone, m.id]));

      // ⚡ 效能核心優化 2：預備兩門市歷史 Sessions，避免重複查詢
      const storeSessionMap = new Map<string, string>();
      for (const storeId of ['chupei', 'jinshan']) {
        let session = await prisma.cashRegisterSession.findFirst({ where: { storeId } });
        if (!session) {
          session = await prisma.cashRegisterSession.create({
            data: {
              storeId,
              openedBy: 'system',
              openingCash: 0,
              status: 'CLOSED',
              note: 'Google Sheets 歷史訂單歸檔班次',
            },
          });
        }
        storeSessionMap.set(storeId, session.id);
      }

      // ⚡ 效能核心優化 3：預生成 UUID 並收集批次清單
      const orderBatch: any[] = [];
      const itemBatch: any[] = [];

      for (const [key, ord] of orderMap) {
        const orderId = crypto.randomUUID();
        const memberId = ord.meta.phone ? phoneToMemberId.get(ord.meta.phone) || null : null;
        const sessionId = storeSessionMap.get(ord.meta.storeId) || 'sess-chupei-history';

        orderBatch.push({
          id: orderId,
          checkoutUID: ord.meta.checkoutUID,
          storeId: ord.meta.storeId,
          sessionId,
          memberId,
          totalDue: ord.meta.totalDue,
          receivedAmount: ord.meta.totalDue,
          cash: ord.meta.cash,
          creditCard: ord.meta.creditCard,
          remittance: ord.meta.remittance,
          netPointsDelta: ord.meta.pointsDelta,
          status: OrderStatus.COMPLETED,
          createdAt: ord.meta.createdAt,
          cashierEmail: ord.meta.cashier || 'system',
          orderNote: ord.meta.note,
        });

        for (const it of ord.items) {
          itemBatch.push({
            orderId,
            ...it,
          });
        }
      }

      // ⚡ 效能核心優化 4：分塊批次寫入 (Chunked createMany)
      // 500 筆訂單/批，1000 筆商品/批，大幅降低連線與 WAL 開銷
      for (const chunk of chunkArray(orderBatch, 500)) {
        await prisma.order.createMany({ data: chunk });
        this.report.details.orders.imported += chunk.length;
      }

      for (const chunk of chunkArray(itemBatch, 1000)) {
        await prisma.orderItem.createMany({ data: chunk });
        this.report.details.orders.itemsImported += chunk.length;
      }
    }
  }

  // ── 通用載入輔助函式 ─────────────────────────────────────
  private loadData<T>(baseName: string): T[] {
    const csvPath = path.resolve(this.dataDir, `${baseName}.csv`);
    const jsonPath = path.resolve(this.dataDir, `${baseName}.json`);

    if (fs.existsSync(jsonPath)) {
      return loadSheetData<T>(jsonPath);
    }
    if (fs.existsSync(csvPath)) {
      return loadSheetData<T>(csvPath);
    }
    return [];
  }
}
