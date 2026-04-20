/**
 * api_prize.js - Extracted Module
 */

// ── 4. 取得獎項庫 API ─────────────────────────────────────
function apiGetPrizeLibrary(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetLotteryDB);
    var data = sheet.getDataRange().getValues();
    var results = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      var colJ = (row[9] || '').toString().trim();
      if (branch && colJ && colJ.indexOf(branch) === -1) continue;
      var isPointsSet = colJ.indexOf('點數') !== -1;
      var parsedBranch = colJ.replace('點數', '').trim() || '';
      results.push({ setId: row[0].toString(), setName: row[1]||'', unitPrice: row[2]||0, prize: (row[3]||'').toString().trim(), prizeId: (row[4]||'').toString(), prizeName: row[5]||'', points: row[6]||0, draws: row[7]||1, branch: parsedBranch, isPointsSet: isPointsSet, drawnCount: Number(row[10]) || 0 });
    }
    return { success: true, data: results };
  } catch(error) { return { success: false, message: error.toString() }; }
}

function apiDeletePrizeLibrary(branch, setId, callerEmail) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch(e) {
    return { success: false, message: '系統忙碌中，請稍後再試作廢福袋' };
  }

  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetLotteryDB);
    var data = sheet.getDataRange().getValues();
    var rowsToDelete = [];
    var matchedRows = []; // 收集獎項明細用
    
    // 從後面往前找，這樣刪除列時 Index 才不會跑到錯亂
    for (var i = data.length - 1; i >= 1; i--) {
      var row = data[i];
      if (row[0] && row[0].toString().trim() === setId.toString().trim()) {
        
        // 如果有傳 branch，進一步確認 branch 相符才刪除 (防誤刪其他店同編號獎項)
        if (branch && row[9] && row[9].toString().trim() !== branch.toString().trim()) {
           continue; 
        }
        
        rowsToDelete.push(i + 1);
        matchedRows.push(row);
      }
    }
    
    if (rowsToDelete.length === 0) {
      return { success: false, message: '找不到此編號對應的任何獎項' };
    }

    // 在刪除前先收集紀錄資訊
    var firstRow = matchedRows[matchedRows.length - 1]; // matchedRows 是反向的，最後一個 = 第一筆
    var setName = firstRow[1] || '';
    var unitPrice = firstRow[2] || 0;
    var colJ = (firstRow[9] || '').toString().trim();
    var isPointsSet = colJ.indexOf('點數') !== -1;
    var originalDate = firstRow[8] || ''; // I 欄 date
    if (originalDate instanceof Date) originalDate = Utilities.formatDate(originalDate, "GMT+8", "yyyy/MM/dd");
    
    // 計算總抽數 + 獎項明細 + 已抽數（交叉比對銷售紀錄+當日銷售）
    var totalDraws = 0;
    var totalDrawn = 0;
    var details = [];

    // ── 先掃描銷售紀錄與當日銷售建立 counts map ──
    var drawCounts = {};
    // 銷售紀錄 — ★ 只讀 A-E 欄 (setId/prize/draws/舊格式判斷)，不讀完整 22 欄
    var salesSheet = tempApp.getSheetByName(sheetSalesRecord);
    var salesLastRow = salesSheet.getLastRow();
    if (salesLastRow > 1) {
      var salesData = salesSheet.getRange(2, 1, salesLastRow - 1, 5).getValues();
      for (var si = 0; si < salesData.length; si++) {
        var sRow = salesData[si];
        var sIsOld = sRow[4] && !isNaN(Number(sRow[4])) && sRow[4].toString().trim() !== '';
        var sSetId = (sRow[1] || '').toString().trim();
        if (sIsOld) continue; // 舊格式商品無獎項代號
        var sPrize = String(sRow[2] || '').trim().toLowerCase();
        var sDraws = Number(sRow[3]) || 0;
        if (!sDraws && sSetId && sPrize) sDraws = 1;
        if (sSetId && sPrize && sDraws > 0) {
          var sKey = sSetId + '_' + sPrize;
          drawCounts[sKey] = (drawCounts[sKey] || 0) + sDraws;
        }
      }
    }
    // 當日銷售 — ★ 只讀到 W 欄 (23 欄)，不讀完整寬度
    var dailySheetNames = [sheetTodaySalesRecordChupei, sheetTodaySalesRecordJinsang];
    for (var ds = 0; ds < dailySheetNames.length; ds++) {
      var dSheet = tempApp.getSheetByName(dailySheetNames[ds]);
      var dLastRow = dSheet.getLastRow();
      if (dLastRow <= 5) continue;
      var dData = dSheet.getRange(6, 1, dLastRow - 5, 23).getValues();
      for (var dj = 0; dj < dData.length; dj++) {
        var dRow = dData[dj];
        if (dRow[22] && dRow[22].toString().trim() !== '') continue;
        var dIsOld = dRow[4] && !isNaN(Number(dRow[4])) && dRow[4].toString().trim() !== '';
        if (dIsOld) continue;
        var dSetId2 = (dRow[1] || '').toString().trim();
        var dPrize2 = String(dRow[2] || '').trim().toLowerCase();
        var dDraws2 = Number(dRow[3]) || 0;
        if (!dDraws2 && dSetId2 && dPrize2) dDraws2 = 1;
        if (dSetId2 && dPrize2 && dDraws2 > 0) {
          var dKey2 = dSetId2 + '_' + dPrize2;
          drawCounts[dKey2] = (drawCounts[dKey2] || 0) + dDraws2;
        }
      }
    }

    matchedRows.reverse().forEach(function(row) {
      var prize = row[3] || '';
      var prizeName = row[5] || '';
      var points = Math.round(Number(row[6]) || 0);
      var draws = Number(row[7]) || 1;
      var drawnKey = setId.toString().trim() + '_' + String(prize).toLowerCase();
      var drawn = drawCounts[drawnKey] || 0;
      totalDraws += draws;
      totalDrawn += drawn;
      details.push(prize + ':' + prizeName + ':' + points + ':已抽' + drawn);
    });
    
    rowsToDelete.sort(function(a, b) { return a - b; }); // 小→大排序，方便合併連續區段
    
    // ★ 批次刪除：合併連續行號為區段，從底部往上一次刪整段（1-2 次 API call 取代 N 次）
    var groups = [];
    var gStart = rowsToDelete[0], gEnd = rowsToDelete[0];
    for (var r = 1; r < rowsToDelete.length; r++) {
      if (rowsToDelete[r] === gEnd + 1) {
        gEnd = rowsToDelete[r]; // 連續，延伸區段
      } else {
        groups.push({ start: gStart, count: gEnd - gStart + 1 });
        gStart = gEnd = rowsToDelete[r];
      }
    }
    groups.push({ start: gStart, count: gEnd - gStart + 1 });
    
    // 從底部往上刪，避免行號偏移
    for (var g = groups.length - 1; g >= 0; g--) {
      sheet.deleteRows(groups[g].start, groups[g].count);
    }
    SpreadsheetApp.flush();

    // ── 寫入「廢套紀錄」──
    try {
      var logSheet = tempApp.getSheetByName(sheetVoidSetLog);
      if (logSheet) {
        if (logSheet.getLastRow() === 0) {
          logSheet.appendRow(['作廢時間', '門市', '操作人員', '套號', '套名', '單抽價', '獎項數', '總抽數', '已抽總數', '獎項明細', '是否點數套', '原始建套日期']);
        }
        logSheet.appendRow([
          Utilities.formatDate(new Date(), "GMT+8", "yyyy/MM/dd HH:mm:ss"), // A 作廢時間
          branch || '',                                                      // B 門市
          callerEmail || '',                                                 // C 操作人員
          setId,                                                             // D 套號
          setName,                                                           // E 套名
          unitPrice,                                                         // F 單抽價
          matchedRows.length,                                                // G 獎項數
          totalDraws,                                                        // H 總抽數
          totalDrawn,                                                        // I 已抽總數
          sanitizeForSheet(details.join(';')),                               // J 獎項明細
          isPointsSet ? 'TRUE' : 'FALSE',                                    // K 是否點數套
          originalDate                                                       // L 原始建套日期
        ]);
      }
    } catch(logErr) {
      console.error('廢套紀錄寫入失敗: ' + logErr.toString());
    }

    return { success: true, message: '已成功作廢整套福袋' };
    
  } catch(error) { return { success: false, message: error.toString() }; 
  } finally {
    lock.releaseLock();
  }
}

// ── 12. 開套 (建立新福袋組) API ─────────────────────────────
function apiCreateSet(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch(e) {
    return { success: false, message: '系統忙碌中，請稍後再試開套' };
  }
  
  try {
    var itemNo = (payload.itemNo || '').toString().trim();
    var itemName = (payload.itemName || '').toString().trim();
    var totalDraws = parseInt(payload.totalDraws) || 0;
    var actualPrice = parseInt(payload.actualPrice) || 0;
    var suggestedPrice = parseInt(payload.suggestedPrice) || 0;
    var branch = payload.branch || '竹北';
    
    if (!itemNo || !itemName) return { success: false, message: '貨號或名稱不可為空' };
    if (!totalDraws || totalDraws <= 0) return { success: false, message: '抽數必須大於 0' };
    if (!actualPrice || actualPrice <= 0) return { success: false, message: '單抽價格必須大於 0' };
    if (actualPrice < suggestedPrice * 0.92) return { success: false, message: '實際價格不可低於建議價格的 92% (' + Math.ceil(suggestedPrice * 0.92) + ')' };
    if (actualPrice > suggestedPrice * 1.5) return { success: false, message: '實際價格不可高於建議價格的 150% (' + Math.floor(suggestedPrice * 1.5) + ')' };
    
    var tempApp = SpreadsheetApp.openById(appBackground);
    var dbSheet = tempApp.getSheetByName(sheetLotteryDB);
    if (!dbSheet) return { success: false, message: '找不到獎項庫分頁' };
    
    // 計算下一個套號 (在鎖保護下讀取)
    var lastRow = dbSheet.getLastRow();
    var nextId = 1;
    if (lastRow > 1) {
      var lastValue = dbSheet.getRange(lastRow, 1).getValue();
      nextId = (parseInt(lastValue) || 0) + 1;
    }
    
    var formattedDate = Utilities.formatDate(new Date(), "GMT+8", "yyyy/M/d");
    
    // 固定寫入兩列：GK獎項(1抽) + 非GK(剩餘抽數)
    var newData = [
      [nextId, itemName, actualPrice, "1", itemNo, itemName, "0", 1, formattedDate, branch],
      [nextId, itemName, actualPrice, "Z", "0p", "非GK", "0", totalDraws - 1, formattedDate, branch]
    ];
    
    // ★ 防護 Spreadsheet Formula Injection
    newData = newData.map(function(row) {
      return row.map(sanitizeForSheet);
    });
    
    dbSheet.getRange(lastRow + 1, 1, 2, 10).setValues(newData);
    
    return { success: true, message: '📦 [' + branch + '] 開套成功！編號 #' + nextId + ' 已入庫', setId: nextId.toString() };
  } catch(error) {
    return { success: false, message: '開套失敗: ' + error.toString() };
  } finally {
    lock.releaseLock();
  }
}

function apiGetDrawCounts(callerEmail) {
  if (!callerEmail || ADMIN_EMAILS.indexOf(callerEmail.toLowerCase()) === -1) {
    return { success: false, message: '無權限查詢抽選狀況' };
  }

  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var counts = {}; // key: "setId_prize" → 已抽數

    // ── 掃描歷史銷售紀錄 ──
    var salesSheet = tempApp.getSheetByName(sheetSalesRecord);
    var salesLastRow = salesSheet.getLastRow();
    if (salesLastRow > 1) {
      var salesData = salesSheet.getRange(2, 1, salesLastRow - 1, salesSheet.getLastColumn()).getValues();
      for (var i = 0; i < salesData.length; i++) {
        var row = salesData[i];
        var isOldFmt = row[4] && !isNaN(Number(row[4])) && row[4].toString().trim() !== '';
        var setId = (row[1] || '').toString().trim();
        var prize, draws;
        if (isOldFmt) {
          prize = ''; // 舊格式商品 — 無獎項代號
          draws = Number(row[2]) || 1;
        } else {
          prize = String(row[2] || '').trim().toLowerCase();
          draws = Number(row[3]) || 0;
          if (!draws && setId && prize) draws = 1; // 有效福袋紀錄至少算 1 抽
        }
        if (setId && prize && draws > 0) {
          var key = setId + '_' + prize;
          counts[key] = (counts[key] || 0) + draws;
        }
      }
    }

    // ── 掃描兩店當日銷售 ──
    var dailySheets = [sheetTodaySalesRecordChupei, sheetTodaySalesRecordJinsang];
    for (var s = 0; s < dailySheets.length; s++) {
      var dSheet = tempApp.getSheetByName(dailySheets[s]);
      var dLastRow = dSheet.getLastRow();
      if (dLastRow <= 5) continue;
      var dData = dSheet.getRange(6, 1, dLastRow - 5, dSheet.getLastColumn()).getValues();
      for (var j = 0; j < dData.length; j++) {
        var dRow = dData[j];
        // 跳過已作廢的紀錄
        if (dRow[22] && dRow[22].toString().trim() !== '') continue;
        var dIsOld = dRow[4] && !isNaN(Number(dRow[4])) && dRow[4].toString().trim() !== '';
        var dSetId = (dRow[1] || '').toString().trim();
        var dPrize, dDraws;
        if (dIsOld) {
          dPrize = '';
          dDraws = Number(dRow[2]) || 1;
        } else {
          dPrize = String(dRow[2] || '').trim().toLowerCase();
          dDraws = Number(dRow[3]) || 0;
          if (!dDraws && dSetId && dPrize) dDraws = 1;
        }
        if (dSetId && dPrize && dDraws > 0) {
          var dKey = dSetId + '_' + dPrize;
          counts[dKey] = (counts[dKey] || 0) + dDraws;
        }
      }
    }

    // ── 寫回「福袋獎項庫」K 欄 ──
    var lotterySheet = tempApp.getSheetByName(sheetLotteryDB);
    var lotteryData = lotterySheet.getDataRange().getValues();
    if (lotteryData.length > 1) {
      var kValues = [];
      for (var k = 1; k < lotteryData.length; k++) {
        var lRow = lotteryData[k];
        var lSetId = (lRow[0] || '').toString().trim();
        var lPrize = (lRow[3] || '').toString().trim().toLowerCase(); // D 欄 = prize code
        var lKey = lSetId + '_' + lPrize;
        kValues.push([counts[lKey] || 0]);
      }
      // K 欄 = 第 11 欄，從第 2 行開始（跳過標題）
      lotterySheet.getRange(2, 11, kValues.length, 1).setValues(kValues);
    }

    return { success: true, data: counts };
  } catch(error) {
    return { success: false, message: '查詢抽選狀況失敗: ' + error.toString() };
  }
}
