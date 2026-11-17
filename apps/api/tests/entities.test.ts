import { describe, it, expect } from 'vitest';
import {
  PhoneNumber,
  Order,
  LuckyBag,
  LuckyBagPrize,
  StoreInventory,
  Member,
  CashRegisterSession,
  TransferOrder,
  Stocktake,
  StocktakeItem,
  PreOrder,
} from '../src';
import {
  InvariantViolationError,
  InsufficientPointsError,
  InsufficientStockError,
  OverdrawError,
} from '@onesoul/shared';

describe('Domain Entities & Value Objects', () => {
  describe('PhoneNumber Value Object', () => {
    it('correctly identifies walk-in whitelist numbers', () => {
      const walkInList = [
        '111111',
        '222222',
        '333333',
        '88888',
        '99999',
        '000000',
        '888888',
        '999999',
        'WALKIN',
      ];
      for (const code of walkInList) {
        const phone = new PhoneNumber(code);
        expect(phone.isWalkIn).toBe(true);
        expect(phone.canonical).toBe('WALKIN');
      }
    });

    it('identifies walk-in keywords by regex', () => {
      const keywords = ['散客先生', 'WALKIN_01', '門市現場客', '\u975e\u6703\u54e1', '\u81e8\u6642\u5ba2\u6236', '\u8a2a\u5ba2A'];
      for (const kw of keywords) {
        const phone = new PhoneNumber(kw);
        expect(phone.isWalkIn).toBe(true);
      }
    });

    it('normalizes Taiwan mobile phone numbers with leading 0 parity', () => {
      const phoneWithZero = new PhoneNumber('0912345678');
      const phoneWithoutZero = new PhoneNumber('912345678');

      expect(phoneWithZero.isWalkIn).toBe(false);
      expect(phoneWithoutZero.isWalkIn).toBe(false);
      expect(phoneWithZero.canonical).toBe('0912345678');
      expect(phoneWithoutZero.canonical).toBe('0912345678');
      expect(phoneWithZero.equals(phoneWithoutZero)).toBe(true);
      expect(phoneWithoutZero.equals('0912345678')).toBe(true);
    });

    it('handles empty or null raw inputs as WalkIn', () => {
      expect(new PhoneNumber(null).isWalkIn).toBe(true);
      expect(new PhoneNumber('').isWalkIn).toBe(true);
      expect(new PhoneNumber(undefined).isWalkIn).toBe(true);
    });
  });

  describe('Order & OrderItem', () => {
    it('validates total paid matches totalDue', () => {
      expect(() => {
        new Order({
          id: 'ord-1',
          checkoutUID: 'uid-1',
          storeId: 'chupei',
          sessionId: 'sess-1',
          memberPhone: '0912345678',
          totalDue: 1000,
          payment: {
            cash: 500,
            creditCard: 400,
            linePay: 0,
            remittance: 0,
            pointsUsed: 0,
          },
          netPointsDelta: 0,
          items: [],
          cashierEmail: 'cashier@onesoul.tw',
        });
      }).toThrow(InvariantViolationError);
    });

    it('allows soft voiding and prevents multiple voids', () => {
      const order = new Order({
        id: 'ord-1',
        checkoutUID: 'uid-1',
        storeId: 'chupei',
        sessionId: 'sess-1',
        memberPhone: '0912345678',
        totalDue: 500,
        payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
        netPointsDelta: 0,
        items: [],
        cashierEmail: 'cashier@onesoul.tw',
      });

      expect(order.canVoid()).toBe(true);
      order.void('顧客點錯商品', 'manager@onesoul.tw');
      expect(order.status).toBe('CANCELLED');
      expect(order.voidReason).toBe('顧客點錯商品');
      expect(order.voidedBy).toBe('manager@onesoul.tw');
      expect(order.canVoid()).toBe(false);

      expect(() => order.void('再次作廢', 'manager@onesoul.tw')).toThrow(
        InvariantViolationError
      );
    });
  });

  describe('LuckyBag & LuckyBagPrize', () => {
    it('calculates points set cost correctly', () => {
      const regularBag = new LuckyBag({
        id: 'lb-1',
        storeId: 'chupei',
        name: '海賊王 GK 大賞',
        unitPrice: 350,
        isPointsSet: false,
      });
      expect(regularBag.calculatePointsCost(5)).toBe(0);

      const pointsBag = new LuckyBag({
        id: 'lb-2',
        storeId: 'chupei',
        name: '純點數限定套',
        unitPrice: 350,
        isPointsSet: true,
      });
      // floor(350 / 20) * 5 = 17 * 5 = 85
      expect(pointsBag.calculatePointsCost(5)).toBe(85);
    });

    it('enforces prize draw limits and increments/decrements drawnCount', () => {
      const prize = new LuckyBagPrize({
        id: 'prz-1',
        bagId: 'lb-1',
        prizeGrade: 'A',
        prizeName: '魯夫 ギア5',
        productId: 'GK-LUFFY',
        draws: 2,
        drawnCount: 0,
      });

      expect(prize.remainingDraws).toBe(2);
      expect(prize.isGrandPrize()).toBe(true);

      prize.incrementDrawnCount(1);
      expect(prize.drawnCount).toBe(1);
      expect(prize.remainingDraws).toBe(1);

      expect(() => prize.incrementDrawnCount(2)).toThrow(OverdrawError);

      prize.decrementDrawnCount(1);
      expect(prize.drawnCount).toBe(0);
      expect(prize.remainingDraws).toBe(2);
    });
  });

  describe('Product & StoreInventory', () => {
    it('enforces non-negative store inventory constraint', () => {
      const inv = new StoreInventory({
        id: 'inv-1',
        storeId: 'chupei',
        productId: 'GK-4100',
        quantity: 5,
      });

      inv.deduct(3);
      expect(inv.quantity).toBe(2);

      expect(() => inv.deduct(3)).toThrow(InsufficientStockError);
      expect(inv.quantity).toBe(2);

      inv.add(5);
      expect(inv.quantity).toBe(7);
    });
  });

  describe('Member & PointLog', () => {
    it('manages points and protects against negative balance', () => {
      const member = new Member({
        id: 'mem-1',
        phone: '0912345678',
        name: '王小明',
        points: 50,
      });

      member.adjustPoints(30);
      expect(member.points).toBe(80);

      member.adjustPoints(-50);
      expect(member.points).toBe(30);

      expect(() => member.adjustPoints(-40)).toThrow(InsufficientPointsError);
      expect(member.points).toBe(30);

      member.recordPurchase(1500);
      expect(member.totalSpent).toBe(1500);
      expect(member.orderCount).toBe(1);
    });
  });

  describe('CashRegisterSession & ZReport', () => {
    it('calculates expected cash, discrepancy, and freezes Z-Report', () => {
      const session = new CashRegisterSession({
        id: 'sess-1',
        storeId: 'chupei',
        openedBy: 'cashier@onesoul.tw',
        openingCash: 8000,
        status: 'OPEN',
      });

      const orders = [
        {
          status: 'COMPLETED',
          totalDue: 1200,
          payment: { cash: 1200, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
          netPointsDelta: 10,
        },
        {
          status: 'COMPLETED',
          totalDue: 800,
          payment: { cash: 300, creditCard: 500, linePay: 0, remittance: 0, pointsUsed: 0 },
          netPointsDelta: -5,
        },
        {
          status: 'CANCELLED',
          totalDue: 500,
          payment: { cash: 500, creditCard: 0, linePay: 0, remittance: 0, pointsUsed: 0 },
          netPointsDelta: 0,
        },
      ];

      // Expected cash = 8000 (opening) + 1200 + 300 = 9500
      // Actual cash = 9480 => discrepancy = -20 (shortage)
      const zReport = session.close({
        closedBy: 'manager@onesoul.tw',
        actualCash: 9480,
        orders,
      });

      expect(zReport.expectedCash).toBe(9500);
      expect(zReport.actualCash).toBe(9480);
      expect(zReport.discrepancy).toBe(-20);
      expect(zReport.cashRevenue).toBe(1500);
      expect(zReport.cardRevenue).toBe(500);
      expect(zReport.totalRevenue).toBe(2000);
      expect(zReport.txCount).toBe(2);
      expect(zReport.voidCount).toBe(1);
      expect(zReport.voidAmount).toBe(500);
      expect(session.status).toBe('CLOSED');
    });
  });

  describe('TransferOrder & Stocktake', () => {
    it('manages transfer order lifecycle state machine', () => {
      const transfer = new TransferOrder({
        id: 'tr-1',
        transferNo: 'TR-100001',
        sourceStoreId: 'warehouse-main',
        targetStoreId: 'chupei',
        status: 'DRAFT',
      });

      transfer.dispatch('logistics@onesoul.tw');
      expect(transfer.status).toBe('DISPATCHED');
      expect(transfer.dispatchedBy).toBe('logistics@onesoul.tw');

      transfer.receive('chupei_staff@onesoul.tw');
      expect(transfer.status).toBe('RECEIVED');
      expect(transfer.receivedBy).toBe('chupei_staff@onesoul.tw');

      // Cannot cancel completed transfer
      expect(() => transfer.cancel('staff')).toThrow(InvariantViolationError);
    });

    it('calculates stocktake variance and transitions to posted', () => {
      const stocktake = new Stocktake({
        id: 'stk-1',
        storeId: 'chupei',
        countedBy: 'auditor@onesoul.tw',
        status: 'DRAFT',
      });

      const item = new StocktakeItem({
        id: 'it-1',
        stocktakeId: 'stk-1',
        productId: 'GK-4100',
        systemQty: 10,
        actualQty: 8,
      });
      expect(item.variance).toBe(-2);

      stocktake.post('manager@onesoul.tw');
      expect(stocktake.status).toBe('POSTED');
      expect(stocktake.postedBy).toBe('manager@onesoul.tw');
    });
  });

  describe('PreOrder', () => {
    it('calculates unit cost upon receiving and completes preorder', () => {
      const po = new PreOrder({
        id: 'po-1',
        name: 'GK 索隆 閻魔',
        quantity: 10,
        deposit: 5000,
        status: 'PENDING',
      });

      // Total cost = 5000 (deposit) + 12000 (final) + 1000 (shipping) = 18000
      // Unit cost = ceil(18000 / 10) = 1800
      const { unitCost, totalCost } = po.receive({
        productId: '4101',
        finalPayment: 12000,
        shippingFee: 1000,
      });

      expect(totalCost).toBe(18000);
      expect(unitCost).toBe(1800);
      expect(po.status).toBe('COMPLETED');
      expect(po.productId).toBe('4101');
    });
  });
});
