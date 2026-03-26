/**
 * helper.js — 通用工具函數
 * 所有跨檔案共用的小工具集中於此
 */

/**
 * 產生 UUID v4
 * @returns {string} UUID 字串
 */
function _uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : r & 0x3 | 0x8;
    return v.toString(16);
  });
}

/**
 * 顯示錯誤訊息（Browser.msgBox）
 * @param {string} message - 要顯示的訊息
 */
function showErrorMessage(message) {
  Browser.msgBox(message);
}

/**
 * 精準判斷有值的最後一行（忽略格式化的空白儲存格）
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 目標工作表
 * @returns {number} 最後有資料的行號（1-indexed），全空則回傳 0
 */
function getLastDataRow(sheet) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i].some(function(cell) { return cell !== ""; })) {
      return i + 1;
    }
  }
  return 0;
}

/**
 * 電話號碼標準化：9 碼補 0、886 開頭修正
 * @param {*} input - 原始電話值
 * @returns {string} 標準化後的 10 碼電話號碼
 */
function cleanPhone(input) {
  if (!input) return "";
  var str = input.toString().replace(/\D/g, '');
  if (str.length === 9) return "0" + str;
  if (str.startsWith("886") && str.length > 9) return "0" + str.substring(3);
  return str;
}