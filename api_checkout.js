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
 * 儲存結帳草稿到 ScriptProperties
 * Key: draft_{branch}_{sessionId}
 */
function apiSaveDraft(payload) {
  try {
    var branch = payload.branch;
    var sessionId = payload.sessionId;
    var email = payload.email || '';
    var data = payload.data || {};
    if (!branch || !sessionId) return { success: false, message: '缺少 branch 或 sessionId' };

    var key = 'draft_' + branch + '_' + sessionId;
    var value = JSON.stringify({ email: email, data: data, ts: Date.now() });
    PropertiesService.getScriptProperties().setProperty(key, value);
    return { success: true };
  } catch(error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * 取得指定門市的所有活躍草稿（過期自動清除）
 */
function apiGetDrafts(branch) {
  try {
    if (!branch) return { success: false, message: '缺少 branch' };
    var props = PropertiesService.getScriptProperties();
    var allProps = props.getProperties();
    var prefix = 'draft_' + branch + '_';
    var now = Date.now();
    var results = [];

    for (var key in allProps) {
      if (key.indexOf(prefix) !== 0) continue;
      try {
        var val = JSON.parse(allProps[key]);
        if (now - val.ts > DRAFT_EXPIRE_MS) {
          props.deleteProperty(key); // 清除過期
          continue;
        }
        var sessionId = key.substring(prefix.length);
        results.push({
          sessionId: sessionId,
          email: val.email || '',
          data: val.data || {},
          ts: val.ts,
          ago: Math.round((now - val.ts) / 1000) // 秒前
        });
      } catch(e) {
        props.deleteProperty(key); // 格式錯誤也清掉
      }
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
    var key = 'draft_' + branch + '_' + sessionId;
    PropertiesService.getScriptProperties().deleteProperty(key);
    return { success: true };
  } catch(error) {
    return { success: false, message: error.toString() };
  }
}
