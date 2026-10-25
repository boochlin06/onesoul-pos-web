/**
 * api_checkout.js - Extracted Module
 */

// ── 1. 結帳 API (含 LockService) ─────────────────────────────
function apiCheckout(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // 等待最多 30 秒取得鎖
  } catch(e) {
    return { success: false, message: '系統忙碌中，請稍後再試 (鎖定逾時)' };
  }

  try {
    var phoneInput = payload.customer.phone || payload.customer.phoneName || '';
    var phoneNumbers = phoneInput.split(/[- ]/)[0];

    var branch = payload.branch; 
    var lotteries = payload.lotteries || [];
    var merchandises = payload.merchandises || [];
    var payment = payload.payment || { receivedAmount: 0, remittance: 0, creditCard: 0, cash: 0, pointsUsed: 0 };
    var orderNote = payload.orderNote || '';
    
    var totalCheckPoint = payload.summary.pointsChange || 0;
    var costToPayPoint = payment.pointsUsed || 0;
    var pointsDelta = totalCheckPoint - costToPayPoint;

    var now = new Date();
    var checkoutUID = phoneNumbers + "_" + Utilities.formatDate(now, "GMT+8", "yyyy-MM-dd_HHmmss");
    var currentDate = Utilities.formatDate(now, "GMT+8", "yyyy/MM/dd");

    var targetData = [];
    
    for (var i = 0; i < lotteries.length; i++) {
      var item = lotteries[i];
      var netPoints = (item.totalPoints || 0) - (item.pointsCost || 0);
      targetData.push([
        phoneNumbers, item.id, item.prize, item.draws, item.type, item.setName, 
        item.unitPrice, item.prizeId, item.prizeName, item.unitPoints, 
        netPoints, item.amount, item.remark, currentDate, checkoutUID
      ]);
    }
    
    for (var j = 0; j < merchandises.length; j++) {
      var m = merchandises[j];
      var mPoints = 0;
      if (m.paymentType === '點數' || m.id === '99999') {
        mPoints = -Math.abs(m.totalPoints);
      } else if (m.id === '88888') {
        mPoints = Math.abs(m.totalPoints);
      }
      
      targetData.push([
        phoneNumbers, "", m.id, m.quantity, m.paymentType, 
        "", m.unitAmount, "", m.name, m.suggestedPoints, 
        mPoints, m.actualAmount, m.remark, currentDate, checkoutUID
      ]);
    }

    // 更新會員點數（使用相對值防護 Race Condition）
    var newPoints = _addPointsUnsafe(phoneNumbers, pointsDelta);
    if (newPoints === -1) return { success: false, message: '會員電話不存在或結帳失敗' };
    if (newPoints === -2) return { success: false, message: '客戶點數不足' };

    var tempApp = SpreadsheetApp.openById(appBackground);
    var targetSheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
    var dailySheet = tempApp.getSheetByName(targetSheetName);

    var lastRow = dailySheet.getLastRow();
    var saleMethodValues = [payment.receivedAmount, payment.remittance, payment.creditCard, payment.cash, payment.pointsUsed, orderNote];
    var newData = targetData.map(function(row, index) {
      return index === 0 ? row.concat(saleMethodValues).concat(pointsDelta) : row.concat(["","","","","","",""]);
    });
    
    // ★ 防護 Spreadsheet Formula Injection
    newData = newData.map(function(row) {
      return row.map(sanitizeForSheet);
    });
    
    if (newData.length > 0) {
       dailySheet.getRange(lastRow + 1, 1, newData.length, newData[0].length).setValues(newData);
       dailySheet.getRange(lastRow + 1, 1, newData.length, newData[0].length).setBorder(true, false, true, false, false, false);
    }

    return { success: true, message: '結帳成功', newPoints: newPoints, checkoutUID: checkoutUID };
  } catch(error) {
    return { success: false, message: '結帳失敗: ' + error.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 結帳草稿 TTL (3 小時，單位：秒)
 */
var DRAFT_CACHE_TTL_SEC = 3 * 60 * 60;

/**
 * 儲存結帳草稿到 CacheService（徹底隔離，不佔用 ScriptProperties 500KB 配額）
 * Key: draft_{branch}_{sessionId}
 */
function apiSaveDraft(payload) {
  try {
    var branch = payload.branch;
    var sessionId = payload.sessionId;
    var email = payload.email || '';
    var data = payload.data || {};
    if (!branch || !sessionId) return { success: false, message: '缺少 branch 或 sessionId' };

    var cache = CacheService.getScriptCache();
    var key = 'draft_' + branch + '_' + sessionId;
    var value = JSON.stringify({ email: email, data: data, ts: Date.now() });

    // 存入 CacheService，設定 3 小時自動焚毀
    cache.put(key, value, DRAFT_CACHE_TTL_SEC);

    // 維護門市活躍 Session 索引列表（輕量字串陣列）
    var indexKey = 'draft_idx_' + branch;
    var sessionList = [];
    try {
      sessionList = JSON.parse(cache.get(indexKey) || '[]');
    } catch(e) { sessionList = []; }

    if (sessionList.indexOf(sessionId) === -1) {
      sessionList.push(sessionId);
      cache.put(indexKey, JSON.stringify(sessionList), DRAFT_CACHE_TTL_SEC);
    }

    // 同步清理舊版可能殘留在 ScriptProperties 中的同名 key
    try {
      PropertiesService.getScriptProperties().deleteProperty(key);
    } catch(ign) {}

    return { success: true };
  } catch(error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * 取得指定門市的所有活躍草稿（過期由 CacheService 自動回收）
 */
function apiGetDrafts(branch) {
  try {
    if (!branch) return { success: false, message: '缺少 branch' };
    var cache = CacheService.getScriptCache();
    var indexKey = 'draft_idx_' + branch;
    var sessionList = [];
    try {
      sessionList = JSON.parse(cache.get(indexKey) || '[]');
    } catch(e) { sessionList = []; }

    var results = [];
    var validSessions = [];
    var now = Date.now();

    for (var i = 0; i < sessionList.length; i++) {
      var sId = sessionList[i];
      var raw = cache.get('draft_' + branch + '_' + sId);
      if (!raw) continue; // 已過期或被自動清除
      try {
        var val = JSON.parse(raw);
        results.push({
          sessionId: sId,
          email: val.email || '',
          data: val.data || {},
          ts: val.ts,
          ago: Math.round((now - val.ts) / 1000) // 秒前
        });
        validSessions.push(sId);
      } catch(e) {}
    }

    // 更新索引，剔除失效 session
    if (validSessions.length !== sessionList.length) {
      cache.put(indexKey, JSON.stringify(validSessions), DRAFT_CACHE_TTL_SEC);
    }

    return { success: true, data: results };
  } catch(error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * 清除指定 session 的草稿
 */
function apiClearDraft(sessionId, branch) {
  try {
    if (!sessionId || !branch) return { success: false, message: '缺少參數' };
    var cache = CacheService.getScriptCache();
    var key = 'draft_' + branch + '_' + sessionId;
    cache.remove(key);

    var indexKey = 'draft_idx_' + branch;
    try {
      var sessionList = JSON.parse(cache.get(indexKey) || '[]');
      var filtered = sessionList.filter(function(id) { return id !== sessionId; });
      cache.put(indexKey, JSON.stringify(filtered), DRAFT_CACHE_TTL_SEC);
    } catch(e) {}

    // 同步清理舊版可能殘留在 ScriptProperties 中的同名 key
    try {
      PropertiesService.getScriptProperties().deleteProperty(key);
    } catch(ign) {}

    return { success: true };
  } catch(error) {
    return { success: false, message: error.toString() };
  }
}
