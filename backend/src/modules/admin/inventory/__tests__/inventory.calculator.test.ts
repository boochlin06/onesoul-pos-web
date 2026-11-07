import { describe, it, expect } from 'vitest';
import {
  resolveCanonicalIP,
  IP_TO_RAW_CATEGORY_MAP,
  calculateSuggestedPoints,
  calculateStoreBalance,
  calculateTurnoverDays,
  calculateHotSellerAdvice,
  calculateSlowMovingAdvice,
  scoreProductForSuggest,
  isExcludedProduct,
  DEFAULT_INVENTORY_CATEGORIES,
} from '../inventory.calculator.js';

describe('InventoryCalculator Pure Functions', () => {
  describe('resolveCanonicalIP', () => {
    it('should correctly classify major anime and IP series', () => {
      expect(resolveCanonicalIP({ name: '海賊王 魯夫 4檔' })).toBe('海賊王');
      expect(resolveCanonicalIP({ name: 'ONE PIECE 索隆 三刀流' })).toBe('海賊王');
      expect(resolveCanonicalIP({ name: '火影忍者 卡卡西 雷切' })).toBe('火影忍者');
      expect(resolveCanonicalIP({ name: 'NARUTO 宇智波佐助' })).toBe('火影忍者');
      expect(resolveCanonicalIP({ name: '寶可夢 耿鬼 夜光' })).toBe('寶可夢');
      expect(resolveCanonicalIP({ name: 'POKEMON 皮卡丘' })).toBe('寶可夢');
      expect(resolveCanonicalIP({ name: '七龍珠 孫悟空 超級賽亞人' })).toBe('七龍珠');
      expect(resolveCanonicalIP({ name: '咒術迴戰 五條悟 領域展開' })).toBe('咒術迴戰');
      expect(resolveCanonicalIP({ name: '獵人 奇犽 落雷' })).toBe('獵人');
      expect(resolveCanonicalIP({ name: '鬼滅之刃 禰豆子' })).toBe('鬼滅之刃');
      expect(resolveCanonicalIP({ name: '灌籃高手 櫻木花道 扣籃' })).toBe('灌籃高手');
      expect(resolveCanonicalIP({ name: '吉卜力 龍貓 搖擺' })).toBe('宮崎駿');
      expect(resolveCanonicalIP({ name: '蠟筆小新 睡衣小新' })).toBe('蠟筆小新');
      expect(resolveCanonicalIP({ name: '數碼寶貝 戰鬥暴龍獸' })).toBe('數碼寶貝');
      expect(resolveCanonicalIP({ name: '遊戲王 青眼白龍 雕像' })).toBe('遊戲王');
      expect(resolveCanonicalIP({ name: '間諜家家酒 安妮雅 哇庫哇庫' })).toBe('間諜家家酒');
      expect(resolveCanonicalIP({ name: 'POPMART Labubu 搪膠盲盒', category: 'BLIND_BOX' })).toBe('潮玩盲盒');
      expect(resolveCanonicalIP({ name: '凡人修仙傳 韓立' })).toBe('國漫');
      expect(resolveCanonicalIP({ name: '怪博士與阿拉雷' })).toBe('阿拉雷');
    });

    it('should fallback to custom category if provided and not general', () => {
      expect(resolveCanonicalIP({ category: '變形金剛', name: '柯博文' })).toBe('變形金剛');
    });

    it('should fallback to 綜合其他 if no match and category is generic', () => {
      expect(resolveCanonicalIP({ category: 'GENERAL', name: '無名小商品' })).toBe('綜合其他');
      expect(resolveCanonicalIP({ category: '', name: '' })).toBe('綜合其他');
    });
  });

  describe('calculateSuggestedPoints', () => {
    it('should calculate 5% rounded suggested points', () => {
      expect(calculateSuggestedPoints(100)).toBe(5);
      expect(calculateSuggestedPoints(199)).toBe(10);
      expect(calculateSuggestedPoints(250)).toBe(13);
      expect(calculateSuggestedPoints(0)).toBe(0);
      expect(calculateSuggestedPoints(null)).toBe(0);
      expect(calculateSuggestedPoints(undefined)).toBe(0);
    });
  });

  describe('calculateStoreBalance', () => {
    it('should detect OUT_OF_STOCK when total is 0', () => {
      const result = calculateStoreBalance({ chupeiStock: 0, jinshanStock: 0 });
      expect(result.status).toBe('OUT_OF_STOCK');
      expect(result.statusLabel).toBe('全店斷貨');
      expect(result.suggestTransfer).toBeNull();
    });

    it('should detect LOW_STOCK when both stores have <= 1 stock', () => {
      const result = calculateStoreBalance({ chupeiStock: 1, jinshanStock: 1 });
      expect(result.status).toBe('LOW_STOCK');
      expect(result.statusLabel).toBe('庫存告急');
      expect(result.suggestTransfer).toBeNull();
    });

    it('should detect JINSHAN_DEFICIT and suggest transfer from chupei to jinshan', () => {
      const result = calculateStoreBalance({
        chupeiStock: 10,
        jinshanStock: 2,
        chupeiStoreName: '竹北店',
        jinshanStoreName: '金山店',
      });
      expect(result.status).toBe('JINSHAN_DEFICIT');
      expect(result.statusLabel).toBe('金山缺貨');
      expect(result.suggestTransfer).toEqual({
        fromStoreId: 'chupei',
        fromStoreName: '竹北店',
        toStoreId: 'jinshan',
        toStoreName: '金山店',
        quantity: 4, // Math.floor((10 - 2) / 2) = 4
      });
      expect(result.rebalanceSuggestion).toContain('建議由竹北店調撥 4 隻補平金山店');
    });

    it('should detect CHUPEI_DEFICIT and suggest transfer from jinshan to chupei', () => {
      const result = calculateStoreBalance({
        chupeiStock: 1,
        jinshanStock: 9,
        chupeiStoreName: '竹北店',
        jinshanStoreName: '金山店',
      });
      expect(result.status).toBe('CHUPEI_DEFICIT');
      expect(result.statusLabel).toBe('竹北缺貨');
      expect(result.suggestTransfer).toEqual({
        fromStoreId: 'jinshan',
        fromStoreName: '金山店',
        toStoreId: 'chupei',
        toStoreName: '竹北店',
        quantity: 4,
      });
      expect(result.rebalanceSuggestion).toContain('建議由金山店調撥 4 隻補平竹北店');
    });

    it('should detect BALANCED when stock difference is small or ratios balanced', () => {
      const result = calculateStoreBalance({ chupeiStock: 5, jinshanStock: 5 });
      expect(result.status).toBe('BALANCED');
      expect(result.statusLabel).toBe('雙店平衡');
      expect(result.suggestTransfer).toBeNull();
    });
  });

  describe('calculateTurnoverDays', () => {
    it('should return correct turnover days when sales exist', () => {
      expect(calculateTurnoverDays(30, 30)).toBe(30);
      expect(calculateTurnoverDays(60, 30)).toBe(60);
      expect(calculateTurnoverDays(10, 20)).toBe(15);
    });

    it('should return 999 when stock exists but sales is 0', () => {
      expect(calculateTurnoverDays(10, 0)).toBe(999);
    });

    it('should return 0 when stock is 0 and sales is 0', () => {
      expect(calculateTurnoverDays(0, 0)).toBe(0);
    });
  });

  describe('calculateHotSellerAdvice', () => {
    it('should return advice for stock > 0', () => {
      const advice = calculateHotSellerAdvice(30, 10);
      expect(advice.dailyVelocity).toBe(1.0);
      expect(advice.estimatedStockoutDays).toBe(10);
      expect(advice.decisionAdvice).toContain('狂銷熱賣！');
    });

    it('should return advice for stock = 0', () => {
      const advice = calculateHotSellerAdvice(15, 0);
      expect(advice.decisionAdvice).toContain('已全數售罄！');
    });
  });

  describe('calculateSlowMovingAdvice', () => {
    it('should calculate tied capital and return advice', () => {
      const slow = calculateSlowMovingAdvice(5, 500);
      expect(slow.tiedCapital).toBe(2500);
      expect(slow.decisionAdvice).toContain('動銷停滯！庫存積壓 5 隻');
      expect(slow.decisionAdvice).toContain('壓資約 $2,500');
    });
  });

  describe('scoreProductForSuggest', () => {
    it('should score exact matches with highest score', () => {
      expect(scoreProductForSuggest({ id: 'P001', name: '索隆', barcode: '4719999' }, 'p001')).toBe(1000);
      expect(scoreProductForSuggest({ id: 'P002', name: '索隆', barcode: '4719999' }, '4719999')).toBe(1000);
    });

    it('should score prefix matches with 500', () => {
      expect(scoreProductForSuggest({ id: 'ONEPIECE-01', name: '魯夫' }, 'onepiece')).toBe(500);
    });

    it('should score name prefix matches with 300', () => {
      expect(scoreProductForSuggest({ id: 'X01', name: '火影忍者鳴人' }, '火影')).toBe(300);
    });

    it('should score name inclusion with 100', () => {
      expect(scoreProductForSuggest({ id: 'X01', name: '海賊王魯夫' }, '魯夫')).toBe(100);
    });

    it('should return 0 for excluded items', () => {
      expect(scoreProductForSuggest({ id: 'GK001', name: '測試' }, 'gk001')).toBe(0);
      expect(scoreProductForSuggest({ id: '88888', name: '加點' }, '88888')).toBe(0);
      expect(scoreProductForSuggest({ id: 'P99', name: 'None' }, 'p99')).toBe(0);
    });
  });

  describe('isExcludedProduct', () => {
    it('should filter out test codes and dummies', () => {
      expect(isExcludedProduct({ id: 'GK001', name: 'Mock' })).toBe(true);
      expect(isExcludedProduct({ id: '88888', name: '隨便加' })).toBe(true);
      expect(isExcludedProduct({ id: '0p', name: '0元' })).toBe(true);
      expect(isExcludedProduct({ id: 'DUMMY1', name: 'None', costPrice: 0, sellingPrice: 0, totalStock: 0 })).toBe(true);
    });

    it('should not filter out genuine products', () => {
      expect(isExcludedProduct({ id: 'PROD-001', name: '海賊王 魯夫 雕像', costPrice: 1000, sellingPrice: 2000, totalStock: 5 })).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should provide default categories and category alias mappings', () => {
      expect(DEFAULT_INVENTORY_CATEGORIES.length).toBeGreaterThan(15);
      expect(IP_TO_RAW_CATEGORY_MAP['海賊王']).toBeDefined();
    });
  });
});
