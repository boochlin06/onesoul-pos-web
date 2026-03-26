// ── 集中管理所有前端通知/錯誤/驗證文字 ──

export const MSG = {
  // ── 結帳 ──
  checkout: {
    memberLoaded: (name: string | number) => `✓ 已帶入會員 ${name}`,
    memberSearching: '查詢會員中…',
    memberFound: (name: string, pts: number) => `✓ 找到會員: ${name}，點數 ${pts}`,
    memberNotFound: (msg?: string) => `✗ ${msg || '找不到會員'}`,
    cleared: '已清空畫面',
    confirmClear: '確定要清空所有已填寫的結帳資料嗎？',
    sending: '結帳資料傳送中…',
    success: (pts: number | string) => `✓ 結帳成功！會員最新點數: ${pts}`,
    fail: (msg: string) => `✗ 結帳失敗：${msg}`,
    networkError: '✗ 網路錯誤，請檢查連線',
    networkErrorShort: '✗ 網路錯誤',
  },

  // ── 會員 ──
  member: {
    loadRetrying: '會員資料載入失敗，2 秒後重試…',
    loadFailed: '會員資料載入失敗，請手動重新整理',
    enterPhone: '請輸入會員電話',
    notFound: (msg?: string) => msg || '找不到此會員',
    historyFailed: '查詢紀錄失敗',
  },

  // ── 當日銷售 ──
  sales: {
    fetchFail: (msg?: string) => msg || '讀取當日銷售失敗',
    fetchNetworkFail: '當日銷售網路請求失敗',
    voiding: '正在作廢訂單...',
    voidSuccess: (msg?: string) => msg || '作廢成功',
    voidFail: (msg: string) => `作廢失敗: ${msg}`,
    voidNetworkFail: '網路異常，無法作廢',
    openingCashSetting: '設定開櫃現金中…',
    openingCashSuccess: '✓ 開櫃現金設定成功',
    openingCashFail: '✗ 設定失敗',
    closingDay: '系統關帳與結算中…',
    closeDayFail: (msg: string) => `✗ 關帳失敗: ${msg}`,
  },

  // ── 銷售紀錄 ──
  salesRecords: {
    cached: '已從快取讀取銷售紀錄',
    fetching: '從伺服器取得最新紀錄...',
    updated: '銷售紀錄已更新並儲存快取',
    fetchFail: (msg?: string) => msg || '讀取銷售紀錄失敗 (API回傳錯誤)',
    fetchNetworkFail: '讀取銷售紀錄失敗 (網路錯誤)',
    cacheCleared: '快取已清除',
  },

  // ── 獎項庫 ──
  prizes: {
    crossBranchVoid: (b: string) => `無法作廢其他門市（${b}）的套組`,
    voiding: '執行整套作廢中...',
    voidSuccess: '整套獎項作廢成功！',
    voidFail: (msg: string) => `作廢失敗：${msg}`,
    voidNetworkFail: '網路錯誤，作廢失敗',
  },

  // ── 結帳驗證 ──
  validation: {
    emptyCart: '無法結帳：請至少輸入一項福袋或商品',
    noPhone: '請輸入客戶電話號碼',
    noMemberLookup: '請先按下 Enter 完成會員查詢，確認會員身份與最新點數後再結帳',
    lotteryIncomplete: (i: number) => `無法結帳：福袋區第 ${i} 項資料有誤（請確認單號與獎項正確，且套名與獎項名稱皆已帶出）`,
    merchIncomplete: (i: number) => `無法結帳：直購商品區第 ${i} 項資料不完整（請確認貨號與商品名稱皆已帶出，且數量必須為大於 0 的整數）`,
    negativeValues: '無法結帳：輸入的收款明細、系統應收總額，以及單項商品金額均不能為負數',
    amountMismatch: (received: number, due: number) => `無法結帳：實收總額 (${received}) 與系統應付總額 (${due}) 不符`,
    insufficientPoints: (cost: number, current: number) => `無法結帳：點數餘額不足！本單需扣除：${cost} 點，會員目前僅有：${current} 點`,
  },
} as const;
