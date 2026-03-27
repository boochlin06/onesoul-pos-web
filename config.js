/**
 * config.js — 全域設定與常數
 * 所有 Sheet 名稱、Spreadsheet ID、欄位索引皆集中於此
 */

var SCRIPT_PROP = PropertiesService.getScriptProperties();

// ── Sheet 名稱 ──
const sheetLotterySetterJinsang = "福袋配置庫-金山";
const sheetLotterySetter = "福袋配置庫";
const sheetMemberList = "會員資料庫";
const sheetMemberReg = "會員註冊";
const sheetCheckout = "結帳頁面";
const sheetLotteryDB = "福袋獎項庫";
const sheetItemDB = "貨品資料庫";
const sheetSalesRecord = "銷售紀錄";
const sheetPointConfirm = "點數校正";
const sheetTodaySalesRecord = "當日結帳紀錄";
const sheetTodaySalesRecordChupei = "當日結帳紀錄";
const sheetTodaySalesRecordJinsang = "當日結帳紀錄-金山";
const sheetBlindBoxDB = "盲盒資料庫";
const sheetCloseDayLog = "開關帳紀錄";
const sheetVoidSetLog = "廢套紀錄";

// ── Spreadsheet IDs ──
const appBackground = "1Dc_vjyCcl3_wjA1_IQssVEKTBA7sqJAjNgR3sSx-OSk";
const appChupei = "1OYpsKmJoVDmjailFvDj242FwcgGKpiysUcPez8Fbzek";
const appJinshan = "1Qt9eN2k6od1q01C-lH6KGQAzmmB3zJYsDCNguwjMXbM";

/** 備份用 Spreadsheet IDs */
const BACKUP_IDS = {
  memberPoint: '1fHwrgnjcgH461M9y1Yxojq-LnQtaLUGGpLCyy7AvjkE',
  dailySales: '14aN2rPIaILYPNdzMZACbj17GAetVxXEl38037a8nmBc',
};

/** 當日銷售紀錄欄位索引（A=0 起算） */
const DAILY_SALE_COL = {
  PHONE: 0,
  LOTTERY_NUM: 1,
  ITEM_CODE: 2,
  PICK_METHOD: 4,
  PRIZE_ID: 7,
  PRIZE_NAME: 8,
  POINT: 10,
  ID: 14,
  RECEIVED_AMOUNT: 15,
  DELETE_FLAG: 22,
};

/** 帶走/點數 常數 */
const PICK_METHOD = {
  TAKE: "帶走",
  POINT: "點數",
};

// ── 全域變數 ──

/**
 * 取得全域設定（含網頁 URL 與標題）
 * @returns {Object} global 設定物件
 */
function get_global() {
  let global = SCRIPT_PROP.getProperty('global') ? JSON.parse(SCRIPT_PROP.getProperty('global')) : {};
  global['url'] = ScriptApp.getService().getUrl();
  global['webTitle'] = '玩獸';
  return global;
}

var global = get_global();
