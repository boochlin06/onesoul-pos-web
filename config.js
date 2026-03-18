var SCRIPT_PROP = PropertiesService.getScriptProperties();

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

const appBackground = "1Dc_vjyCcl3_wjA1_IQssVEKTBA7sqJAjNgR3sSx-OSk";
const appChupei = "1OYpsKmJoVDmjailFvDj242FwcgGKpiysUcPez8Fbzek";
const appJinshan = "1Qt9eN2k6od1q01C-lH6KGQAzmmB3zJYsDCNguwjMXbM";

/*=====================================
  取得全域變數
=====================================*/
function get_global() {
  // 從指令碼屬性 取得 global
  let global = SCRIPT_PROP.getProperty('global') ? JSON.parse(SCRIPT_PROP.getProperty('global')) : {};
  // 網頁應用程式網址
  global['url'] = ScriptApp.getService().getUrl();
  global['webTitle'] = '玩獸'

  return global;
}

var global = get_global();
