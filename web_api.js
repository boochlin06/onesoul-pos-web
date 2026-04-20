/**
 * 預防 CSV/Spreadsheet 注入攻擊 (OWASP A03)
 * 若字串開頭為 = + - @ ，加上單引號保護
 */
function sanitizeForSheet(val) {
  if (typeof val === 'number') return val;
  if (val === null || val === undefined) return '';
  var str = val.toString();
  // 純數字（含負數如 '-500'）不跳脫，避免破壞後續 Number() 解析
  if (/^[=+\-@]/.test(str) && isNaN(str)) {
    return "'" + str;
  }
  return val;
}

/**
 * 處理 Web POS 傳過來的 POST 請求
 */
function doPost(e) {
  _countGasCall();
  try {
    var params = JSON.parse(e.postData.contents);

    // ★ LINE Webhook — bot 被加入群組時自動擷取 groupId
    if (Array.isArray(params.events)) {
      params.events.forEach(function(event) {
        handleLineWebhookEvent(event);
      });
      return ContentService.createTextOutput('OK');
    }

    // ★ API Key 驗證 — 擋掉未授權存取
    var storedKey = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (storedKey && params.apiKey !== storedKey) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: '未授權存取 (Invalid API Key)' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ★ 客戶面 API — 不需要 Google OAuth idToken
    var action = params.action;
    var payload = params.payload || {};
    if (action === 'memberLogin' || action === 'getSellList') {
      var result;
      if (action === 'memberLogin') {
        result = apiMemberLogin(payload.phone, payload.birth);
      } else {
        result = apiGetSellListPublic();
      }
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ★ Google ID Token 驗證 — 擋掉非白名單帳號（POS 專用 API）
    var idToken = params.idToken;
    if (idToken) {
      var tokenEmail = verifyGoogleIdToken_(idToken);
      if (!tokenEmail) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: '無效的登入 Token' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var allowedStr = PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAILS') || '';
      var allowed = allowedStr.split(',').map(function(s) { return s.trim().toLowerCase(); });
      if (allowed.length > 0 && allowed[0] !== '' && allowed.indexOf(tokenEmail.toLowerCase()) === -1) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: '此帳號無權限使用 (' + tokenEmail + ')' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    var result;
    switch (action) {
      case "checkout":
        result = apiCheckout(payload);
        break;
      case "closeDay":
        result = apiCloseDay(payload, tokenEmail);
        break;
      case "getMember":
        result = apiGetMember(payload.phone);
        break;
      case "getPrizeLibrary":
        result = apiGetPrizeLibrary(payload.branch);
        break;
      case "getAllMembers":
        result = apiGetAllMembers();
        break;
      case "getSalesRecords":
        result = apiGetSalesRecords(payload);
        break;
      case "getStockList":
        result = apiGetStockList(payload.branch);
        break;
      case "getDailySales":
        result = apiGetDailySales(payload.branch);
        break;
      case "deleteDailySales":
        result = apiDeleteDailySales(payload.branch, payload.checkoutUID);
        break;
      case "getBlindBoxList":
        result = apiGetBlindBoxList();
        break;
      case "deletePrizeLibrary":
        result = apiDeletePrizeLibrary(payload.branch, payload.setId, tokenEmail);
        break;
      case "setOpeningCash":
        result = apiSetOpeningCash(payload.branch, payload.amount);
        break;
      case "getOpeningCash":
        result = apiGetOpeningCash(payload.branch);
        break;
      case "getMemberSalesRecords":
        result = apiGetMemberSalesRecords(payload.phone);
        break;
      case "createSet":
        result = apiCreateSet(payload);
        break;
      case "getStockItemByNo":
        result = apiGetStockItemByNo(payload.itemNo);
        break;
      case "setEmergencyNotice":
        result = apiSetEmergencyNotice(payload.message, tokenEmail);
        break;
      case "getEmergencyNotice":
        result = apiGetEmergencyNotice();
        break;
      case "clearEmergencyNotice":
        result = apiClearEmergencyNotice(tokenEmail);
        break;
      case "getDrawCounts":
        result = apiGetDrawCounts(tokenEmail);
        break;
      case "getBranchConfig":
        result = apiGetBranchConfig(payload.branch);
        break;
      case "getTodaySchedule":
        result = apiGetTodaySchedule(payload.branch);
        break;
      case "clockIn":
        result = apiClockIn(payload, tokenEmail);
        break;
      case "getTodayAttendance":
        result = apiGetTodayAttendance(payload.branch);
        break;
      case "saveDraft":
        result = apiSaveDraft(payload);
        break;
      case "getDrafts":
        result = apiGetDrafts(payload.branch);
        break;
      case "clearDraft":
        result = apiClearDraft(payload.sessionId, payload.branch);
        break;
      case "sendLineMessage":
        result = apiSendLineMessage(payload, tokenEmail);
        break;
      case "getLineChannels":
        result = apiGetLineChannels(tokenEmail);
        break;
      case "getQuotaUsage":
        result = apiGetQuotaUsage(tokenEmail);
        break;
      case "getInventoryCheckEnabled":
        result = apiGetInventoryCheckEnabled();
        break;
      case "getInventoryCheckList":
        result = apiGetInventoryCheckList(payload.branch);
        break;
      case "submitInventoryCheck":
        result = apiSubmitInventoryCheck(payload, tokenEmail);
        break;
      case "applyInventoryCheck":
        result = apiApplyInventoryCheck(payload, tokenEmail);
        break;
      case "_diagnoseLine":
        result = _diagnoseLine();
        break;
      default:
        result = { success: false, message: "未知的 Action: " + action };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "解析請求失敗: " + error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}









// ── 5.5 銷售紀錄列解析公用函數 ─────────────────────────────
function parseSalesRow(row, uid, phone, branchValue) {
  var isOldMerch = row[4] && !isNaN(Number(row[4])) && row[4].toString().trim() !== '';
  if (isOldMerch) {
    return {
      phone: phone,
      lotteryId: row[1] ? row[1].toString() : '',
      prize: '', 
      draws: Number(row[2]) || 1,
      type: row[3] ? row[3].toString() : '',
      setName: '',
      unitPrice: Number(row[4]) || 0,
      prizeId: '',
      prizeName: row[5] ? row[5].toString() : '',
      unitPoints: Number(row[6]) || 0,
      points: Number(row[7]) || 0,
      amount: Number(row[8]) || 0,
      remark: row[9] ? row[9].toString() : '',
      date: row[13] instanceof Date ? Utilities.formatDate(row[13], 'GMT+8', 'yyyy/MM/dd HH:mm') : (row[13] ? row[13].toString() : ''),
      checkoutUID: uid,
      receivedAmount: Number(row[15]) || 0,
      remittance: Number(row[16]) || 0,
      creditCard: Number(row[17]) || 0,
      cash: Number(row[18]) || 0,
      pointsUsed: Number(row[19]) || 0,
      channel: row[20] ? row[20].toString() : '',
      pointDelta: Number(row[21]) || 0,
      branch: branchValue
    };
  } else {
    return {
      phone: phone,
      lotteryId: row[1] ? row[1].toString() : '',
      prize: row[2] ? row[2].toString() : '',
      draws: Number(row[3]) || 0,
      type: row[4] ? row[4].toString() : '',
      setName: row[5] ? row[5].toString() : '',
      unitPrice: Number(row[6]) || 0,
      prizeId: row[7] ? row[7].toString() : '',
      prizeName: row[8] ? row[8].toString() : '',
      unitPoints: Number(row[9]) || 0,
      points: Number(row[10]) || 0,
      amount: Number(row[11]) || 0,
      remark: row[12] ? row[12].toString() : '',
      date: row[13] instanceof Date ? Utilities.formatDate(row[13], 'GMT+8', 'yyyy/MM/dd HH:mm') : (row[13] ? row[13].toString() : ''),
      checkoutUID: uid,
      receivedAmount: Number(row[15]) || 0,
      remittance: Number(row[16]) || 0,
      creditCard: Number(row[17]) || 0,
      cash: Number(row[18]) || 0,
      pointsUsed: Number(row[19]) || 0,
      channel: row[20] ? row[20].toString() : '',
      pointDelta: Number(row[21]) || 0,
      branch: branchValue
    };
  }
}









/**
 * 驗證 Google ID Token — 回傳 email 或 null
 * 透過 Google 官方 tokeninfo endpoint 驗證簽章 + CacheService 快取避免重複 HTTP
 */
function verifyGoogleIdToken_(idToken) {
  try {
    if (!idToken || typeof idToken !== 'string') return null;
    
    var parts = idToken.split('.');
    if (parts.length !== 3) return null;
    
    // ★ 快取：同一 token 5 分鐘內不重複驗證（用 token 末 40 字元當 key，避免超過 key 長度限制）
    var cache = CacheService.getScriptCache();
    var cacheKey = 'jwt_' + idToken.substring(idToken.length - 40);
    var cachedEmail = cache.get(cacheKey);
    if (cachedEmail) return cachedEmail;
    
    // ★ 透過 Google 官方 endpoint 驗證 JWT 簽章與有效性 (防範偽造權限)
    var response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + idToken, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      Logger.log('Token verification failed: ' + response.getContentText());
      return null;
    }
    
    var payload = JSON.parse(response.getContentText());
    
    // 檢查 token 是否過期
    var now = Math.floor(new Date().getTime() / 1000);
    if (payload.exp && payload.exp < now) {
      Logger.log('Token expired: exp=' + payload.exp + ' now=' + now);
      return null;
    }
    
    // 驗證 issuer（必須來自 Google）
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      Logger.log('Token issuer invalid: ' + payload.iss);
      return null;
    }
    
    // 驗證 audience
    var expectedClientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
    if (expectedClientId && payload.aud !== expectedClientId) {
      Logger.log('Token audience mismatch: expected=' + expectedClientId + ' got=' + payload.aud);
      return null;
    }
    
    // ★ 驗證通過，寫入快取（2700 秒 = 45 分鐘）
    var email = payload.email || null;
    if (email) {
      cache.put(cacheKey, email, 2700);
    }
    return email;
  } catch (e) {
    Logger.log('Token verification error: ' + e.toString());
    return null;
  }
}

// ── 客戶面 API ──────────────────────────────



// ── 緊急通知 API ──────────────────────────────────────────

var ADMIN_EMAILS = ['onesoul.chupei@gmail.com', 'gamejeffjeff@gmail.com'];
var NOTICE_KEY = 'EMERGENCY_NOTICE';




// ── 抽選狀況 API（大師專用）─────────────────────────────────


// ══════════════════════════════════════════════════════════════
// 打卡 / 出勤 API
// ══════════════════════════════════════════════════════════════

/**
 * 從班表 A 欄的日期文字解析出 M/D 格式
 * 支援：Date 物件、"3月1日 (星期日)"、"3/1"、"3月1日" 等格式
 */
function parseScheduleDate_(cellDate) {
  if (cellDate instanceof Date) {
    return (cellDate.getMonth() + 1) + '/' + cellDate.getDate();
  }
  var s = String(cellDate);
  var m = s.match(/(\d+)月(\d+)/);
  if (m) return parseInt(m[1]) + '/' + parseInt(m[2]);
  m = s.match(/(\d+)\/(\d+)/);
  if (m) return parseInt(m[1]) + '/' + parseInt(m[2]);
  return '';
}





// ── 即時結帳監控 API ──────────────────────────────────────




// ── LINE 訊息 API（大師專用）────────────────────────────────




// ── 庫存盤點 API ──────────────────────────────────────────
