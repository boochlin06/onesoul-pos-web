import type { StoreBalanceResult, StoreBalanceStatus, SuggestedTransfer } from './inventory.types.js';

/**
 * 依據品名、主類別、次類別推導正規化 IP 系列
 */
export function resolveCanonicalIP(p: { category?: string | null; subCategory?: string | null; name?: string | null }): string {
  const cat = (p.category || '').trim();
  const sub = (p.subCategory || '').trim();
  const name = (p.name || '').trim();
  const combined = `${cat} ${sub} ${name}`.toLowerCase();

  if (combined.includes('海賊') || combined.includes('航海王') || combined.includes('one piece') || combined.includes('魯夫') || combined.includes('索隆') || combined.includes('艾斯') || combined.includes('娜美') || combined.includes('喬巴')) {
    return '海賊王';
  }
  if (combined.includes('火影') || combined.includes('naruto') || combined.includes('鳴人') || combined.includes('佐助') || combined.includes('卡卡西') || combined.includes('宇智波')) {
    return '火影忍者';
  }
  if (combined.includes('寶可夢') || combined.includes('神奇寶貝') || combined.includes('pokemon') || combined.includes('皮卡丘') || combined.includes('耿鬼') || combined.includes('噴火龍') || combined.includes('伊布')) {
    return '寶可夢';
  }
  if (combined.includes('七龍珠') || combined.includes('dragon ball') || combined.includes('悟空') || combined.includes('貝吉塔') || combined.includes('悟飯') || combined.includes('特南克斯')) {
    return '七龍珠';
  }
  if (combined.includes('咒術') || combined.includes('鏈鋸') || combined.includes('五條悟') || combined.includes('虎杖') || combined.includes('宿儺')) {
    return '咒術迴戰';
  }
  if (combined.includes('獵人') || combined.includes('hunter') || combined.includes('小傑') || combined.includes('奇犽') || combined.includes('西索') || combined.includes('庫洛洛')) {
    return '獵人';
  }
  if (combined.includes('鬼滅') || combined.includes('炭治郎') || combined.includes('禰豆子') || combined.includes('彌豆子') || combined.includes('善逸') || combined.includes('伊之助') || combined.includes('無慘')) {
    return '鬼滅之刃';
  }
  if (combined.includes('灌籃') || combined.includes('slam dunk') || combined.includes('櫻木') || combined.includes('流川') || combined.includes('三井')) {
    return '灌籃高手';
  }
  if (combined.includes('宮崎駿') || combined.includes('吉卜力') || combined.includes('龍貓') || combined.includes('千尋') || combined.includes('霍爾') || combined.includes('無臉男')) {
    return '宮崎駿';
  }
  if (combined.includes('小新') || combined.includes('蠟筆小新') || combined.includes('野原')) {
    return '蠟筆小新';
  }
  if (combined.includes('數碼寶貝') || combined.includes('digimon') || combined.includes('亞古獸') || combined.includes('戰鬥暴龍')) {
    return '數碼寶貝';
  }
  if (combined.includes('遊戲王') || combined.includes('青眼白龍') || combined.includes('黑魔導') || combined.includes('武藤遊戲')) {
    return '遊戲王';
  }
  if (combined.includes('安妮雅') || combined.includes('間諜家家酒') || combined.includes('spy family')) {
    return '間諜家家酒';
  }
  if (combined.includes('潮玩') || combined.includes('popmart') || combined.includes('泡泡瑪特') || combined.includes('labubu') || combined.includes('molly') || combined.includes('skullpanda') || cat === 'BLIND_BOX' || combined.includes('盲盒')) {
    return '潮玩盲盒';
  }
  if (combined.includes('國漫') || combined.includes('凡人修仙') || combined.includes('仙逆')) {
    return '國漫';
  }
  if (combined.includes('阿拉雷') || combined.includes('怪博士')) {
    return '阿拉雷';
  }
  if (cat && cat !== 'GENERAL' && cat !== '綜合' && cat !== 'None' && cat !== 'FIGURE') {
    return cat;
  }
  return '綜合其他';
}

/**
 * IP 與原始分類別名反查映射表
 */
export const IP_TO_RAW_CATEGORY_MAP: Record<string, string[]> = {
  '海賊王': ['海賊王'],
  '火影忍者': ['火影忍者', '火影'],
  '蠟筆小新': ['蠟筆小新', '小新'],
  '間諜家家酒': ['間諜家家酒', '安妮雅'],
  '咒術迴戰': ['咒術迴戰', '鏈鋸咒術'],
  '潮玩盲盒': ['潮玩盲盒', '潮玩'],
  '綜合其他': ['綜合其他', '綜合', 'GENERAL'],
  '火影': ['火影', '火影忍者'],
  '小新': ['小新', '蠟筆小新'],
  '安妮雅': ['安妮雅', '間諜家家酒'],
  '鏈鋸咒術': ['鏈鋸咒術', '咒術迴戰'],
  '潮玩': ['潮玩', '潮玩盲盒'],
  '綜合': ['綜合', '綜合其他', 'GENERAL'],
};

/**
 * 預設分類庫存列表
 */
export const DEFAULT_INVENTORY_CATEGORIES = [
  '海賊王',
  '火影忍者',
  '寶可夢',
  '七龍珠',
  '咒術迴戰',
  '獵人',
  '鬼滅之刃',
  '灌籃高手',
  '宮崎駿',
  '蠟筆小新',
  '數碼寶貝',
  '遊戲王',
  '間諜家家酒',
  '潮玩盲盒',
  '國漫',
  '阿拉雷',
  '綜合其他',
  '火影',
  '小新',
  '安妮雅',
  '鏈鋸咒術',
  '潮玩',
  '綜合',
  'GK',
  'BLIND_BOX',
  'GENERAL',
  'FIGURE',
];

/**
 * 建議點數折抵計算（5% 售價連動，四捨五入）
 */
export function calculateSuggestedPoints(sellingPrice?: number | null): number {
  const price = Math.max(0, Number(sellingPrice) || 0);
  return Math.round(price * 0.05);
}

/**
 * 門市庫存對稱平衡與調撥建議純函數
 */
export function calculateStoreBalance(input: {
  chupeiStock: number;
  jinshanStock: number;
  chupeiStoreName?: string;
  jinshanStoreName?: string;
}): StoreBalanceResult {
  const { chupeiStock, jinshanStock, chupeiStoreName = '竹北店', jinshanStoreName = '金山店' } = input;
  const totalStock = chupeiStock + jinshanStock;

  if (totalStock === 0) {
    return {
      status: 'OUT_OF_STOCK',
      statusLabel: '全店斷貨',
      statusColor: 'slate',
      rebalanceSuggestion: '全店無現貨，請向廠商採購追單',
      suggestTransfer: null,
    };
  }

  if (chupeiStock <= 1 && jinshanStock <= 1) {
    return {
      status: 'LOW_STOCK',
      statusLabel: '庫存告急',
      statusColor: 'rose',
      rebalanceSuggestion: '雙店存量皆處危險低水位，請盡速追單進貨',
      suggestTransfer: null,
    };
  }

  const diff = chupeiStock - jinshanStock;
  const transferQty = Math.floor(Math.abs(diff) / 2);

  if (diff > 0 && transferQty >= 1 && (jinshanStock <= 2 || chupeiStock / (jinshanStock || 1) >= 1.8)) {
    return {
      status: 'JINSHAN_DEFICIT',
      statusLabel: '金山缺貨',
      statusColor: 'amber',
      rebalanceSuggestion: `建議由${chupeiStoreName}調撥 ${transferQty} 隻補平${jinshanStoreName}`,
      suggestTransfer: {
        fromStoreId: 'chupei',
        fromStoreName: chupeiStoreName,
        toStoreId: 'jinshan',
        toStoreName: jinshanStoreName,
        quantity: transferQty,
      },
    };
  }

  if (diff < 0 && transferQty >= 1 && (chupeiStock <= 2 || jinshanStock / (chupeiStock || 1) >= 1.8)) {
    return {
      status: 'CHUPEI_DEFICIT',
      statusLabel: '竹北缺貨',
      statusColor: 'amber',
      rebalanceSuggestion: `建議由${jinshanStoreName}調撥 ${transferQty} 隻補平${chupeiStoreName}`,
      suggestTransfer: {
        fromStoreId: 'jinshan',
        fromStoreName: jinshanStoreName,
        toStoreId: 'chupei',
        toStoreName: chupeiStoreName,
        quantity: transferQty,
      },
    };
  }

  return {
    status: 'BALANCED',
    statusLabel: '雙店平衡',
    statusColor: 'emerald',
    rebalanceSuggestion: '雙店存量平衡無須調撥',
    suggestTransfer: null,
  };
}

/**
 * 計算週轉天數（Turnover Days）
 */
export function calculateTurnoverDays(totalStock: number, sales30d: number): number {
  if (sales30d > 0) {
    return Math.round(totalStock / (sales30d / 30));
  }
  return totalStock > 0 ? 999 : 0;
}

/**
 * 爆款熱銷決策建議純函數
 */
export function calculateHotSellerAdvice(salesCount30d: number, currentStock: number): {
  dailyVelocity: number;
  estimatedStockoutDays: number;
  decisionAdvice: string;
} {
  const dailyVelocity = parseFloat((salesCount30d / 30).toFixed(2));
  const estimatedStockoutDays = dailyVelocity > 0 ? Math.max(0, Math.round(currentStock / dailyVelocity)) : 999;
  let decisionAdvice = `狂銷熱賣！近30天售出 ${salesCount30d} 隻，現餘 ${currentStock} 隻 (約 ${estimatedStockoutDays} 天售罄)，強烈建議向廠商追單！`;
  if (currentStock === 0) {
    decisionAdvice = `已全數售罄！近30天動銷 ${salesCount30d} 隻，目前雙店已斷貨，請緊急向廠商補貨！`;
  }
  return { dailyVelocity, estimatedStockoutDays, decisionAdvice };
}

/**
 * 滯銷積壓決策建議純函數
 */
export function calculateSlowMovingAdvice(currentStock: number, costPrice: number): {
  tiedCapital: number;
  decisionAdvice: string;
} {
  const cost = costPrice || 200;
  const tiedCapital = currentStock * cost;
  return {
    tiedCapital,
    decisionAdvice: `動銷停滯！庫存積壓 ${currentStock} 隻 (壓資約 $${tiedCapital.toLocaleString()})，建議排入一番賞大賞/配賞看板排程，或福袋盲盒出清。`,
  };
}

/**
 * 商品自動補全評分演算法
 */
export function scoreProductForSuggest(
  prod: { id?: string | null; name?: string | null; barcode?: string | null },
  searchKeyword: string
): number {
  const prodId = (prod.id || '').trim();
  const prodName = (prod.name || '').trim();
  const barcode = (prod.barcode || '').trim();

  // 排除無效/測試假貨號
  if (['GK001', 'GEN001', 'BB001', '88888', '99999', '0p', '3935'].includes(prodId)) return 0;
  if (!prodName || prodName === 'None' || prodName.startsWith('商品-')) return 0;

  const idLower = prodId.toLowerCase();
  const nameLower = prodName.toLowerCase();
  const barcodeLower = barcode.toLowerCase();

  if (idLower === searchKeyword || barcodeLower === searchKeyword) {
    return 1000;
  }
  if (idLower.startsWith(searchKeyword) || barcodeLower.startsWith(searchKeyword)) {
    return 500;
  }
  if (nameLower.startsWith(searchKeyword)) {
    return 300;
  }
  if (nameLower.includes(searchKeyword)) {
    return 100;
  }
  return 0;
}

/**
 * 排除無效空白佔位幽靈商品、測試商品與特殊系統商品
 */
export function isExcludedProduct(prod: {
  id: string;
  name?: string | null;
  barcode?: string | null;
  costPrice?: number | null;
  sellingPrice?: number | null;
  totalStock?: number;
}): boolean {
  const prodName = (prod.name || '').trim();
  const prodId = (prod.id || '').trim();
  const isDummyName = !prodName || prodName === 'None' || prodName.startsWith('商品-') || prodName.startsWith('[待補品名') || prodName === prodId;
  const isFakeCode = ['GK001', 'GEN001', 'BB001'].includes(prodId) || ['4710001', '4710002', '4710003'].includes(prod.barcode || '');
  const isSpecialCode = isFakeCode || prodId === '88888' || prodId === '99999' || prodId === '0p' || prodId === '3935' || prodName === '隨便加' || prodName === '隨便扣';
  const isZeroStockAndPrice = (prod.costPrice || 0) === 0 && (prod.sellingPrice || 0) === 0 && (prod.totalStock ?? 0) === 0;

  return isSpecialCode || (isDummyName && isZeroStockAndPrice) || (isDummyName && (prod.costPrice || 0) === 0 && (prod.sellingPrice || 0) === 0);
}
