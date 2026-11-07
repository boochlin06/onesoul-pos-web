import type { AllocationPresetTemplate } from './allocation.types.js';

// 內建經典 Google Sheet 常用配置範本 (相容歷史 Sheet: 1, 2, 3 數字賞、X 盲盒賞、Z 小賞)
export const DEFAULT_PRESET_TEMPLATES: AllocationPresetTemplate[] = [
  {
    id: 'tpl-100-standard',
    name: '【100抽標準賞 (預設)】1/2號大賞 + X盲盒 + Z小賞 (建議單抽$350)',
    storeId: 'chupei',
    status: 'TEMPLATE',
    totalDraws: 100,
    price1: 350,
    price3: 1020, // 97折
    price5: 1660, // 95折
    price10: 3150, // 90折
    isTenPlusOne: false,
    targetMargin: 45,
    items: [
      { prizeGrade: '1', prizeName: 'WAWA飛翔坊寶寶A款', productId: '2905', draws: 1, costPrice: 2100, points: 144 },
      { prizeGrade: '2', prizeName: 'WAWA飛翔坊寶寶B款', productId: '2906', draws: 2, costPrice: 2100, points: 144 },
      { prizeGrade: 'X', prizeName: '任選盲盒一個', productId: 'X', draws: 5, costPrice: 200, points: 10 },
      { prizeGrade: 'Z', prizeName: '非GK保底小賞 (1P)', productId: '0p', draws: 92, costPrice: 0, points: 1, isNonGk: true },
    ],
  },
  {
    id: 'tpl-80-standard',
    name: '【80抽經典賞】A/B/C/D賞 + 最後賞 (建議單抽$350)',
    storeId: 'chupei',
    status: 'TEMPLATE',
    totalDraws: 80,
    price1: 350,
    price3: 1020, // 97折
    price5: 1660, // 95折
    price10: 3150, // 90折
    isTenPlusOne: false,
    targetMargin: 45,
    items: [
      { prizeGrade: 'A', prizeName: 'WAWA飛翔坊寶寶A款', productId: '2905', draws: 1, costPrice: 2100, points: 144 },
      { prizeGrade: 'B', prizeName: 'WAWA飛翔坊寶寶B款', productId: '2906', draws: 2, costPrice: 2100, points: 144 },
      { prizeGrade: 'C', prizeName: '航海王 索隆 經典景品', productId: '3234', draws: 3, costPrice: 800, points: 30 },
      { prizeGrade: 'X', prizeName: '任選盲盒一個', productId: 'X', draws: 5, costPrice: 200, points: 10 },
      { prizeGrade: 'LS', prizeName: '艾斯特製版 特別限定雕像', productId: '', draws: 1, costPrice: 3500, points: 100 },
      { prizeGrade: 'Z', prizeName: '非GK保底小賞 (1P)', productId: '0p', draws: 68, costPrice: 0, points: 1, isNonGk: true },
    ],
  },
  {
    id: 'tpl-300-medium',
    name: '【300抽中型進階套】1~5號賞 + 20抽X盲盒 + 273抽Z小賞 (建議單抽$400)',
    storeId: 'chupei',
    status: 'TEMPLATE',
    totalDraws: 300,
    price1: 400,
    price3: 1160,
    price5: 1900,
    price10: 3600,
    isTenPlusOne: false,
    targetMargin: 52,
    items: [
      { prizeGrade: '1', prizeName: 'CX翼神龍C版 究極雕像', productId: '3233', draws: 1, costPrice: 21000, points: 840 },
      { prizeGrade: '2', prizeName: '神官盜賊基斯 高階GK', productId: '2880', draws: 1, costPrice: 3300, points: 130 },
      { prizeGrade: '3', prizeName: 'SAKURA櫻栗子球 精品', productId: '3202', draws: 2, costPrice: 2800, points: 110 },
      { prizeGrade: '4', prizeName: '鬼滅限量原創雕像', productId: '', draws: 3, costPrice: 1500, points: 60 },
      { prizeGrade: 'X', prizeName: '任選盲盒一個', productId: 'X', draws: 20, costPrice: 200, points: 10 },
      { prizeGrade: 'Z', prizeName: '非GK保底小賞 (1P)', productId: '0p', draws: 273, costPrice: 0, points: 1, isNonGk: true },
    ],
  },
  {
    id: 'tpl-1000-mega',
    name: '【1000抽大型套組】多款頂級GK + 50抽X盲盒 + 935抽Z小賞 (建議單抽$500)',
    storeId: 'chupei',
    status: 'TEMPLATE',
    totalDraws: 1000,
    price1: 500,
    price3: 1450,
    price5: 2380,
    price10: 4500,
    isTenPlusOne: false,
    targetMargin: 55,
    items: [
      { prizeGrade: '1', prizeName: '1號賞 頂級雕像 魯夫四檔限定', productId: '926', draws: 1, costPrice: 35000, points: 1500 },
      { prizeGrade: '2', prizeName: '2號賞 索隆三千世界 極限GK', productId: '3233', draws: 2, costPrice: 18000, points: 700 },
      { prizeGrade: '3', prizeName: '3號賞 艾斯炎帝 豪華雕像', productId: '2880', draws: 3, costPrice: 9000, points: 350 },
      { prizeGrade: '4', prizeName: '4號賞 人氣MASTERLISE手辦', productId: '', draws: 9, costPrice: 2500, points: 100 },
      { prizeGrade: 'X', prizeName: 'X賞 正版盲盒大集合', productId: '', draws: 50, costPrice: 180, points: 8 },
      { prizeGrade: 'Z', prizeName: 'Z賞 非GK保底小賞 (可換點數)', productId: '0p', draws: 935, costPrice: 1, points: 1, isNonGk: true },
    ],
  },
  {
    id: 'tpl-3000-festival',
    name: '【3000抽巨型年節一番賞】全館大聯動 (建議單抽$600，最高支援至3000抽)',
    storeId: 'chupei',
    status: 'TEMPLATE',
    totalDraws: 3000,
    price1: 600,
    price3: 1750,
    price5: 2850,
    price10: 5400,
    isTenPlusOne: false,
    targetMargin: 58,
    items: [
      { prizeGrade: '1', prizeName: '特賞 神級限量等身大胸像', productId: '926', draws: 1, costPrice: 65000, points: 3000 },
      { prizeGrade: '2', prizeName: '1號賞 究極巨型雕像 (3款)', productId: '3233', draws: 3, costPrice: 22000, points: 900 },
      { prizeGrade: '3', prizeName: '2號賞 高階精品GK (6款)', productId: '2880', draws: 6, costPrice: 8500, points: 350 },
      { prizeGrade: '4', prizeName: '3號賞 熱門景品大全套', productId: '', draws: 20, costPrice: 1200, points: 50 },
      { prizeGrade: 'X', prizeName: 'X賞 全館任選盲盒大賞', productId: '', draws: 150, costPrice: 200, points: 10 },
      { prizeGrade: 'Z', prizeName: 'Z賞 非GK保底小賞 / 點數大放送', productId: '0p', draws: 2820, costPrice: 1, points: 1, isNonGk: true },
    ],
  },
];
