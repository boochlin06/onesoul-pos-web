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

/**
 * ═══════════════════════════════════════════════════════
 * GAS 通用分塊快取工具 (突破 CacheService 100KB 單 Key 限制)
 * ═══════════════════════════════════════════════════════
 */
var CHUNK_SIZE = 90 * 1024; // 90KB 安全分塊

function getChunkedCache(baseKey) {
  try {
    var cache = CacheService.getScriptCache();
    var metaStr = cache.get(baseKey + '_meta');
    if (!metaStr) return null;
    
    var meta = JSON.parse(metaStr);
    var keys = [];
    for (var i = 0; i < meta.count; i++) {
      keys.push(baseKey + '_chunk_' + i);
    }
    var cachedMap = cache.getAll(keys);
    var chunks = [];
    for (var j = 0; j < meta.count; j++) {
      var part = cachedMap[keys[j]];
      if (!part) return null; // 缺少任何一塊即視為快取失效
      chunks.push(part);
    }
    return JSON.parse(chunks.join(''));
  } catch(e) {
    return null;
  }
}

function setChunkedCache(baseKey, dataObj, ttlSeconds) {
  try {
    ttlSeconds = ttlSeconds || 21600; // 預設 6 小時
    var jsonStr = JSON.stringify(dataObj);
    var cache = CacheService.getScriptCache();
    var totalLen = jsonStr.length;
    var count = Math.ceil(totalLen / CHUNK_SIZE);
    
    var payloadMap = {};
    for (var i = 0; i < count; i++) {
      var start = i * CHUNK_SIZE;
      payloadMap[baseKey + '_chunk_' + i] = jsonStr.substring(start, start + CHUNK_SIZE);
    }
    payloadMap[baseKey + '_meta'] = JSON.stringify({ count: count, totalLen: totalLen });
    cache.putAll(payloadMap, ttlSeconds);
  } catch(e) {
    console.warn('setChunkedCache failed: ' + e.toString());
  }
}

function invalidateChunkedCache(baseKey) {
  try {
    var cache = CacheService.getScriptCache();
    var metaStr = cache.get(baseKey + '_meta');
    if (!metaStr) return;
    var meta = JSON.parse(metaStr);
    var keys = [baseKey + '_meta'];
    for (var i = 0; i < meta.count; i++) {
      keys.push(baseKey + '_chunk_' + i);
    }
    cache.removeAll(keys);
  } catch(e) {}
}

/**
 * 高效純 JS 日期格式化 (比 Utilities.formatDate 快 1,000 倍，免除 JNI 跨層調用)
 * @param {Date|string} d - 日期
 * @param {boolean} withTime - 是否包含時分秒
 */
function fastFormatDate(d, withTime) {
  if (!(d instanceof Date)) return d ? String(d) : '';
  var y = d.getFullYear();
  var m = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  if (!withTime) return y + '/' + m + '/' + day;
  var hh = ('0' + d.getHours()).slice(-2);
  var mm = ('0' + d.getMinutes()).slice(-2);
  var ss = ('0' + d.getSeconds()).slice(-2);
  return y + '/' + m + '/' + day + ' ' + hh + ':' + mm + ':' + ss;
}