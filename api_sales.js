/**
 * api_sales.js - Extracted Module
 */

function apiCloseDay(payload, callerEmail) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    return { success: false, message: '另一間門市正在關帳中，請稍後再試' };
  }

  try {
    var branch = payload.branch;
    var openingCash = payload.openingCash || 0;
    var expectedCash = payload.expectedCash || 0;
    var actualCash = payload.actualCash || 0;
    var discrepancy = payload.discrepancy || 0;
    var note = payload.note || '';

    var tempApp = SpreadsheetApp.openById(appBackground);
    var sourceSheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
    var targetSheetName = sheetSalesRecord;
    
    var sourceSheet = tempApp.getSheetByName(sourceSheetName);
    var targetSheet = tempApp.getSheetByName(targetSheetName);
    var lastRowSource = sourceSheet.getLastRow();
    var noData = (lastRowSource <= 5);

    var dataToMove = [];
    var txCount = 0, totalRevenue = 0, totalCreditCard = 0, totalRemittance = 0;

    if (!noData) {
      var numToMove = lastRowSource - 5;
      var srcCols = sourceSheet.getLastColumn();
      dataToMove = sourceSheet.getRange(6, 1, numToMove, srcCols).getValues();

      var dataWithBranch = dataToMove.map(function(row) {
        while (row.length < 25) row.push('');
        if (!row[24]) row[24] = branch;
        return row;
      });

      var lastRowTarget = targetSheet.getLastRow();
      var targetCols = Math.max(srcCols, 25);
      targetSheet.getRange(lastRowTarget + 1, 1, dataWithBranch.length, targetCols).setValues(dataWithBranch);
      sourceSheet.getRange(6, 1, numToMove, srcCols).clearContent();

      // 統計交易資料
      var uidSet = {};
      dataToMove.forEach(function(row) {
        var uid = (row[14] || '').toString().trim();
        if (uid && !uidSet[uid]) {
          uidSet[uid] = true;
          totalRevenue += Number(row[15]) || 0;     // 實收總額 (receivedAmount)
          totalCreditCard += Number(row[17]) || 0;  // 信用卡 (creditCard)
          totalRemittance += Number(row[16]) || 0;  // 匯款 (remittance) (原先誤植為 18 現金)
        }
      });
      txCount = Object.keys(uidSet).length;
    }

    var props = PropertiesService.getScriptProperties();
    props.deleteProperty('openingCash_' + branch);

    // ── 寫入「開關帳紀錄」──
    try {
      var logSheet = tempApp.getSheetByName(sheetCloseDayLog);
      if (logSheet) {
        if (logSheet.getLastRow() === 0) {
          logSheet.appendRow(['關帳時間', '門市', '操作人員', '開櫃準備金', '應收現金', '實收現金', '現金差異', '信用卡總額', '匯款總額', '本日營業額', '交易筆數', '備註']);
        }
        logSheet.appendRow([
          Utilities.formatDate(new Date(), "GMT+8", "yyyy/MM/dd HH:mm:ss"),
          branch,
          callerEmail || '',
          openingCash,
          expectedCash,
          actualCash,
          discrepancy,
          Math.round(totalCreditCard),
          Math.round(totalRemittance),
          Math.round(totalRevenue),
          txCount,
          sanitizeForSheet(note)
        ]);
      }
    } catch(logErr) {
      console.error('開關帳紀錄寫入失敗: ' + logErr.toString());
    }

    // ── 寫入班表出勤下班時間 ──
    try {
      var schedSheet = tempApp.getSheetByName(sheetSchedule);
      if (schedSheet) {
        var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'M/d');
        var schedData = schedSheet.getDataRange().getValues();
        var schedDisplay = schedSheet.getDataRange().getDisplayValues();
        var clockOutCol = (branch === '竹北') ? 4 : 7;
        var hoursCol   = (branch === '竹北') ? 5 : 8;
        var clockInCol = (branch === '竹北') ? 3 : 6;
        var remarkCol  = 9;
        var configCol = (branch === '竹北') ? 1 : 2;
        var standardHours = Number(schedDisplay[2][configCol]) || (branch === '竹北' ? 8 : 6);

        console.log('班表關帳 — 今天: ' + today + ', branch: ' + branch + ', clockInCol: ' + clockInCol);

        for (var r = 5; r < schedData.length; r++) {
          var dateStr = parseScheduleDate_(schedData[r][0]);
          if (dateStr === today) {
            var clockInVal = schedDisplay[r][clockInCol];
            console.log('班表關帳 — 找到 row ' + (r + 1) + ', clockInVal: [' + clockInVal + ']');
            if (!clockInVal) break;
            var nowStr = Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm');
            schedSheet.getRange(r + 1, clockOutCol + 1).setValue(nowStr);

            var inParts = String(clockInVal).split(':');
            var outParts = nowStr.split(':');
            var inMin = parseInt(inParts[0]) * 60 + parseInt(inParts[1]);
            var outMin = parseInt(outParts[0]) * 60 + parseInt(outParts[1]);
            var actualHours = Math.round((outMin - inMin) / 30) * 0.5;
            schedSheet.getRange(r + 1, hoursCol + 1).setValue(actualHours);

            var diff = actualHours - standardHours;
            if (diff !== 0) {
              var existingRemark = schedDisplay[r][remarkCol] || '';
              var hourNote = diff > 0 ? '加班' + diff + 'hr' : '早退' + Math.abs(diff) + 'hr';
              var newRemark = existingRemark ? existingRemark + '、' + hourNote : hourNote;
              schedSheet.getRange(r + 1, remarkCol + 1).setValue(newRemark);
            }
            console.log('班表關帳 — 寫入成功: 下班=' + nowStr + ', 工時=' + actualHours);
            break;
          }
        }
      }
    } catch(schedErr) {
      console.error('班表出勤寫入失敗: ' + schedErr.toString());
    }

    // ── LINE 關帳通知 ──
    console.log('[CloseDay] ▶ 開始 LINE 通知流程, branch=' + branch + ', txCount=' + txCount + ', revenue=' + totalRevenue);
    try {
      // 建立 phone → 姓名 對照表
      var memberMap = {};
      try {
        var memberData = tempApp.getSheetByName(sheetMemberList).getDataRange().getValues();
        for (var mi = 1; mi < memberData.length; mi++) {
          var mPhone = String(memberData[mi][2] || '').trim().replace(/^0+/, '');
          var mName = String(memberData[mi][1] || '').trim();
          if (mPhone && mName) memberMap[mPhone] = mName;
        }
        console.log('[CloseDay] memberMap 建立完成, 共 ' + Object.keys(memberMap).length + ' 筆');
      } catch(e) {
        console.error('[CloseDay] memberMap 建立失敗: ' + e.toString());
      }

      var gkItems = [];
      if (dataToMove.length > 0) {
        dataToMove.forEach(function(row) {
          var lotteryId = (row[1] || '').toString().trim();
          var type = (row[4] || '').toString().trim();
          var prizeId = (row[7] || '').toString().trim();
          var prizeName = (row[8] || '').toString().trim();
          var phone = (row[0] || '').toString().trim();
          var points = Number(row[10]) || 0;
          var merchId = (row[2] || '').toString().trim();
          var cleanPhone = phone.replace(/^0+/, '');
          var customerName = memberMap[cleanPhone] || phone || '散客';

          if (lotteryId && type === '帶走' && prizeId) {
            var iStr = prizeName.toLowerCase();
            if (!iStr.includes('非gk') && !iStr.includes('盲盒')) {
              gkItems.push({ category: '帶走', customer: customerName, name: prizeName, prizeId: prizeId });
            }
          }
          else if (lotteryId && type === '點數' && prizeId) {
            var iStr2 = prizeName.toLowerCase();
            if (!iStr2.includes('非gk') && !iStr2.includes('盲盒')) {
              gkItems.push({ category: '換點數', customer: customerName, name: prizeName, prizeId: prizeId, points: Math.abs(points) });
            }
          }
          else if (!lotteryId) {
            var cNum = Number(merchId);
            if (merchId && !isNaN(cNum) && cNum < 100000 && merchId !== '88888' && merchId !== '99999') {
              gkItems.push({ category: '點數直購', customer: customerName, name: prizeName, prizeId: merchId, points: Math.abs(points) });
            }
          }
        });
      }
      console.log('[CloseDay] gkItems 收集完成, 共 ' + gkItems.length + ' 筆');

      // 讀班表取得今日值班人員
      var sched = apiGetTodaySchedule(branch);
      var staffName = (sched.success && sched.data && sched.data.staff) ? sched.data.staff : '';
      console.log('[CloseDay] 值班人員: ' + (staffName || '(無)') + ', 準備呼叫 notifyCloseDay...');

      notifyCloseDay(branch, txCount, totalRevenue, totalCreditCard, totalRemittance, discrepancy, note, gkItems, staffName);
      console.log('[CloseDay] ✓ notifyCloseDay 完成');

      createTrelloCardOnCloseDay(branch, staffName, gkItems);
      console.log('[CloseDay] ✓ createTrelloCardOnCloseDay 完成');
    } catch(notifyErr) {
      console.error('[CloseDay] ✗ 關帳通知/建卡失敗: ' + notifyErr.toString() + '\n' + notifyErr.stack);
    }

    return { success: true, message: branch + ' 關帳與結算紀錄成功' };
  } catch(error) {
    return { success: false, message: '關帳異常: ' + error.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ── 2. 關帳 API 與 現金管理 API ────────────────────────────
function apiSetOpeningCash(branch, amount) {
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('openingCash_' + branch, amount.toString());
    return { success: true, message: '開櫃現金設定成功', amount: Number(amount) };
  } catch(error) {
    return { success: false, message: '設定開櫃現金失敗: ' + error.toString() };
  }
}

function apiGetOpeningCash(branch) {
  try {
    var props = PropertiesService.getScriptProperties();
    var val = props.getProperty('openingCash_' + branch);
    return { success: true, amount: val ? Number(val) : null };
  } catch(error) {
    return { success: false, message: '讀取開櫃現金失敗: ' + error.toString() };
  }
}

// ── 7. 當日銷售 API ───────────────────────────────────────
function apiGetDailySales(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var targetSheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
    var sheet = tempApp.getSheetByName(targetSheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 5) return { success: true, data: [] };

    // 資料從第 6 列開始 (第 1-5 列為標題與說明)
    var lastCol = Math.max(sheet.getLastColumn(), 25);
    var data = sheet.getRange(6, 1, lastRow - 5, lastCol).getValues();
    var results = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var uid = row[14] ? row[14].toString().trim() : '';
      var phone = row[0] ? row[0].toString().trim() : '';
      if (!uid || uid.toLowerCase() === 'id' || uid.toLowerCase() === 'checkoutuid' || phone === '電話') continue;

      results.push(parseSalesRow(row, uid, phone, branch));
    }
    return { success: true, data: results.reverse() };
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 8. 刪除當日單筆銷售 API ─────────────────────────────────
function apiDeleteDailySales(branch, checkoutUID) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch(e) {
    return { success: false, message: '系統忙碌中，請稍後再試作廢' };
  }

  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var targetSheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
    var sheet = tempApp.getSheetByName(targetSheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 5) return { success: false, message: '找不到訂單 (表單無資料)' };

    var data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues(); // 包含 1-5 標題供偵測
    var rowsToDelete = [];
    var phoneToUpdate = '';
    var totalPointsImpact = 0;
    var kColumnSum = 0;
    
    // 從最後一行往上找，避開 1-5 列標題 (index 0-4)
    for (var i = data.length - 1; i >= 5; i--) {
      if (data[i][14] && data[i][14].toString().trim() === checkoutUID.toString().trim()) {
        rowsToDelete.push(i + 1);
        if (!phoneToUpdate && data[i][0]) { 
          phoneToUpdate = data[i][0].toString().trim(); 
        }
        // V 欄 (Index 21: 點數異動)
        if (data[i][21] !== '' && data[i][21] !== undefined) {
          totalPointsImpact += Number(data[i][21]);
        }
        // K 欄 (Index 10: 單行點數) 作為 fallback
        if (data[i][10] !== '' && data[i][10] !== undefined) {
          kColumnSum += Number(data[i][10]);
        }
      }
    }
    
    // V 欄為 0 時 fallback 到 K 欄加總（點數套舊資料 V 欄可能未寫入）
    if (totalPointsImpact === 0 && kColumnSum !== 0) {
      totalPointsImpact = kColumnSum;
    }
    
    if (rowsToDelete.length === 0) return { success: false, message: '找不到訂單' };
    
    // ★ 使用 _addPointsUnsafe 而非手寫點數操作，因為 apiDeleteDailySales 已持有 ScriptLock
    if (phoneToUpdate && !isNaN(totalPointsImpact) && totalPointsImpact !== 0) {
      var refundResult = _addPointsUnsafe(phoneToUpdate, -totalPointsImpact);
      if (refundResult == -1) {
        return { success: false, message: '作廢失敗：找不到會員電話 ' + phoneToUpdate };
      }
      if (refundResult == -2) {
        return { success: false, message: '作廢失敗：退點後客戶點數將變為負數，請先處理客戶點數' };
      }
    }
    rowsToDelete.sort(function(a, b) { return b - a; }); // 確保大→小，避免行號偏移
    for (var r = 0; r < rowsToDelete.length; r++) sheet.deleteRow(rowsToDelete[r]);
    return { success: true, message: '已作廢且點數已退回' };
  } catch(error) { return { success: false, message: error.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ── 6. 取得銷售紀錄 API ───────────────────────────────────
function apiGetSalesRecords(payload) {
  var limit = payload.limit || 300;
  var offset = payload.offset || 0;
  // 不再依賴請求的 branch，直接讀全部分店資料

  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSalesRecord);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, data: [], hasMore: false };

    var totalRecords = lastRow - 1;
    var numToFetch = Math.min(totalRecords - offset, limit);
    if (numToFetch <= 0) return { success: true, data: [], hasMore: false };

    var startRow = lastRow - offset - numToFetch + 1;
    var lastCol = Math.max(sheet.getLastColumn(), 25); // 至少涵蓋到第25欄 (Column Y)
    var data = sheet.getRange(startRow, 1, numToFetch, lastCol).getValues();
    
    var results = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var uid = row[14] ? row[14].toString().trim() : '';
      var phone = row[0] ? row[0].toString().trim() : '';
      if (!uid || uid.toLowerCase() === 'id' || uid.toLowerCase() === 'checkoutuid' || phone === '電話') continue;

      // 分店從 col[24] (Column Y) 讀取
      var rowBranch = row[24] ? row[24].toString().trim() : '';
      results.push(parseSalesRow(row, uid, phone, rowBranch));
    }
    
    var hasMore = (offset + numToFetch) < totalRecords;
    return { success: true, data: results.reverse(), hasMore: hasMore };
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 10. 取得特定會員銷售紀錄 API (v3: batch read + cache) ────────
function apiGetMemberSalesRecords(phone, limit) {
  if (!phone) return { success: false, message: '請提供會員電話' };
  limit = limit || 200;
  var phoneStr = phone.toString().trim();

  // ★ CacheService：5 分鐘快取，同一會員連續查不重撈
  var cache = CacheService.getScriptCache();
  var cacheKey = 'memberSales_' + phoneStr;
  var cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) { /* cache corrupt, re-fetch */ }
  }

  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSalesRecord);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, data: [] };

    var lastCol = Math.max(sheet.getLastColumn(), 25);

    // ★ Step 1: 只讀 A 欄 (1 column)，極快
    var phoneCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    
    // ★ Step 2: 在 JS 裡找出所有匹配的行號 (0-indexed in phoneCol)
    var matchedIndices = [];
    for (var i = phoneCol.length - 1; i >= 0 && matchedIndices.length < limit; i--) {
      var val = phoneCol[i][0];
      if (val && val.toString().trim() === phoneStr) {
        matchedIndices.push(i);
      }
    }
    if (matchedIndices.length === 0) return { success: true, data: [] };

    // ★ Step 3: 一次批次讀取所有匹配行的完整資料
    //    找出最小和最大 index，讀取那個區間，再 filter
    var minIdx = matchedIndices[matchedIndices.length - 1]; // smallest (因為 reverse 迭代)
    var maxIdx = matchedIndices[0]; // largest
    var batchStart = minIdx + 2; // +2 因為 phoneCol 從 row 2 開始
    var batchCount = maxIdx - minIdx + 1;
    var batchData = sheet.getRange(batchStart, 1, batchCount, lastCol).getValues();

    // ★ Step 4: 從 batch 中挑出匹配行，組裝結果
    var matchedSet = {};
    for (var m = 0; m < matchedIndices.length; m++) {
      matchedSet[matchedIndices[m] - minIdx] = true; // offset into batchData
    }

    var results = [];
    // matchedIndices 已經是 newest-first (因為 reverse 迭代)
    for (var j = 0; j < matchedIndices.length; j++) {
      var batchOffset = matchedIndices[j] - minIdx;
      var row = batchData[batchOffset];

      var uid = row[14] ? row[14].toString().trim() : '';
      if (!uid || uid.toLowerCase() === 'id' || uid.toLowerCase() === 'checkoutuid') continue;

      var rowBranch = row[24] ? row[24].toString().trim() : '';
      results.push(parseSalesRow(row, uid, phoneStr, rowBranch));
    }

    var response = { success: true, data: results };

    // ★ 寫入快取 (最多 100KB, TTL 300秒=5分鐘)
    try {
      var jsonStr = JSON.stringify(response);
      if (jsonStr.length < 100000) cache.put(cacheKey, jsonStr, 300);
    } catch(e) { /* cache write failed, ignore */ }

    return response;
  } catch(error) { return { success: false, message: error.toString() }; }
}
