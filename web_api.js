
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
    var pointsDelta = totalCheckPoint - costToPayPoint; // 淨點數異動（相對值）

    var checkoutUID = phoneNumbers + "_" + Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd_HHmmss");
    var currentDate = Utilities.formatDate(new Date(), "GMT+8", "yyyy/MM/dd");

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

    // ★ 使用相對值加減，鎖內讀 DB 即時點數，防止 race condition
    // ★ 使用 _addPointsUnsafe 而非 addMemberPointsByPhone，因為 apiCheckout 已持有 ScriptLock
    var newPoints = _addPointsUnsafe(phoneNumbers, pointsDelta);
    if (newPoints == -1) return { success: false, message: '會員電話不存在或結帳失敗' };
    if (newPoints == -2) return { success: false, message: '客戶點數不足' };

    var tempApp = SpreadsheetApp.openById(appBackground);
    var targetSheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
    var dailySheet = tempApp.getSheetByName(targetSheetName);

    var lastRow = dailySheet.getLastRow();
    var saleMethodValues = [payment.receivedAmount, payment.remittance, payment.creditCard, payment.cash, payment.pointsUsed, orderNote];
    var newData = targetData.map(function(row, index) {
      return index === 0 ? row.concat(saleMethodValues).concat(pointsDelta) : row.concat(["","","","","","",""]);
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
          totalRevenue += Number(row[15]) || 0;
          totalCreditCard += Number(row[17]) || 0;
          totalRemittance += Number(row[18]) || 0;
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
          note
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
    try {
      notifyCloseDay(branch, txCount, totalRevenue, totalCreditCard, totalRemittance, discrepancy);
    } catch(notifyErr) {
      console.error('關帳 LINE 通知失敗: ' + notifyErr.toString());
    }

    return { success: true, message: branch + ' 關帳與結算紀錄成功' };
  } catch(error) {
    return { success: false, message: '關帳異常: ' + error.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ── 3. 查詢會員 API ───────────────────────────────────────
function apiGetMember(phone) {
  if (!phone) return { success: false, message: '請提供電話' };
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var memberSheet = tempApp.getSheetByName(sheetMemberList);
    var data = memberSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][2] == phone) {
        var birthday = data[i][4];
        if (birthday instanceof Date) birthday = Utilities.formatDate(birthday, "GMT+8", "yyyy/MM/dd");
        return { success: true, data: { name: data[i][1], phone: data[i][2], points: data[i][6] || 0, birthday: birthday, gender: data[i][3] } };
      }
    }
    return { success: false, message: '找不到會員' };
  } catch(error) { return { success: false, message: error.toString() }; }
}

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
    // 銷售紀錄
    var salesSheet = tempApp.getSheetByName(sheetSalesRecord);
    var salesLastRow = salesSheet.getLastRow();
    if (salesLastRow > 1) {
      var salesData = salesSheet.getRange(2, 1, salesLastRow - 1, salesSheet.getLastColumn()).getValues();
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
    // 當日銷售
    var dailySheetNames = [sheetTodaySalesRecordChupei, sheetTodaySalesRecordJinsang];
    for (var ds = 0; ds < dailySheetNames.length; ds++) {
      var dSheet = tempApp.getSheetByName(dailySheetNames[ds]);
      var dLastRow = dSheet.getLastRow();
      if (dLastRow <= 5) continue;
      var dData = dSheet.getRange(6, 1, dLastRow - 5, dSheet.getLastColumn()).getValues();
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
    
    rowsToDelete.sort(function(a, b) { return b - a; }); // 確保大→小，避免行號偏移
    for (var r = 0; r < rowsToDelete.length; r++) {
       sheet.deleteRow(rowsToDelete[r]);
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
          details.join(';'),                                                 // J 獎項明細
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

// ── 5. 取得所有會員 API ───────────────────────────────────
function apiGetAllMembers() {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var data = tempApp.getSheetByName(sheetMemberList).getDataRange().getValues();
    return { 
      success: true, 
      data: data.slice(1).map(row => {
        var birthday = row[4];
        if (birthday instanceof Date) birthday = Utilities.formatDate(birthday, "GMT+8", "yyyy/MM/dd");
        var timestamp = row[0];
        if (timestamp instanceof Date) timestamp = Utilities.formatDate(timestamp, "GMT+8", "yyyy/MM/dd HH:mm:ss");
        return { 
          timestamp: timestamp || '',
          name: row[1] || '', 
          phone: row[2] || '', 
          gender: row[3] || '',
          birthday: birthday || '',
          store: row[5] || '',
          points: row[6] || 0, 
          note: row[7] || '' 
        };
      }) 
    };
  } catch(error) { return { success: false, message: error.toString() }; }
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

// ── 8. 取得商品資料庫 API ─────────────────────────────────
function apiGetStockList(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetItemDB);
    if (!sheet) return { success: false, message: '找不到貨品資料庫分頁' };
    var data = sheet.getDataRange().getValues();
    var results = [];
    
    // 跳過標題列
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var id = row[0] ? row[0].toString().trim() : '';
        if (!id) continue;
        
        var rowBranch = row[16] ? row[16].toString().trim() : ''; // q 行
        // 依照前端選擇的店面過濾 (若有指定)
        if (branch && branch !== '全部' && rowBranch && rowBranch !== branch) continue;
        
        results.push({
            id: id,                                    // a 行
            name: row[1] ? row[1].toString() : '',     // b 行
            points: Number(row[4]) || 0,               // e 行
            category: row[9] ? row[9].toString() : '', // j 行
            quantity: Number(row[13]) || 0,            // n 行
            remark: '',
            branch: rowBranch
        });
    }
    return { success: true, data: results };
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 9. 取得盲盒資料庫 API ─────────────────────────────────
function apiGetBlindBoxList() {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetBlindBoxDB);
    if (!sheet) return { success: false, message: '找不到盲盒資料庫分頁' };
    var data = sheet.getDataRange().getValues();
    var results = [];
    
    // 跳過標題列
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var id = row[0] ? row[0].toString().trim() : '';
        if (!id) continue;
        
        results.push({
            id: id,
            name: row[1] ? row[1].toString() : '',
            points: Number(row[2]) || 0,
            manualPrice: Number(row[3]) || 0,
            autoSuggestPrice: Number(row[4]) || 0,
            cost: Number(row[5]) || 0,
            prizePoints: Number(row[6]) || 0,
            inventory: Number(row[7]) || 0,
            category: row[8] ? row[8].toString() : '',
            configuring: Number(row[9]) || 0,
            shipped: Number(row[10]) || 0,
            remaining: Number(row[11]) || 0,
            remark: row[12] ? row[12].toString() : ''
        });
    }
    return { success: true, data: results };
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

// ── 11. 根據貨號查詢貨品資料 API ───────────────────────────
function apiGetStockItemByNo(itemNo) {
  try {
    if (!itemNo) return { success: false, message: '請輸入貨號' };
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetItemDB);
    if (!sheet) return { success: false, message: '找不到貨品資料庫' };
    var data = sheet.getDataRange().getValues();
    var target = itemNo.toString().trim();
    
    for (var i = 1; i < data.length; i++) {
      var id = data[i][0] ? data[i][0].toString().trim() : '';
      if (id === target) {
        return {
          success: true,
          data: {
            id: id,
            name: data[i][1] ? data[i][1].toString() : '',
            points: Number(data[i][4]) || 0,  // Column E = 販售建議點數
          }
        };
      }
    }
    return { success: false, message: '找不到貨號 ' + itemNo };
  } catch(error) { return { success: false, message: error.toString() }; }
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
    
    dbSheet.getRange(lastRow + 1, 1, 2, 10).setValues(newData);
    
    return { success: true, message: '📦 [' + branch + '] 開套成功！編號 #' + nextId + ' 已入庫', setId: nextId.toString() };
  } catch(error) {
    return { success: false, message: '開套失敗: ' + error.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 驗證 Google ID Token — 回傳 email 或 null
 * 直接解碼 JWT payload (Base64url)，檢查 exp 和 aud
 */
function verifyGoogleIdToken_(idToken) {
  try {
    if (!idToken || typeof idToken !== 'string') return null;
    
    var parts = idToken.split('.');
    if (parts.length !== 3) return null;
    
    // Base64url → Base64（加 padding）
    var base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    
    var decoded = Utilities.base64Decode(base64);
    var jsonStr = Utilities.newBlob(decoded).getDataAsString('UTF-8');
    var payload = JSON.parse(jsonStr);
    
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
    
    return payload.email || null;
  } catch (e) {
    Logger.log('Token verification error: ' + e.toString());
    return null;
  }
}

// ── 客戶面 API ──────────────────────────────

/**
 * 客戶登入 — 電話+生日驗證，回傳會員資訊
 * @param {string} phone - 會員電話
 * @param {string} birth - 生日 (yyyyMMdd)
 * @returns {Object} { success, data: { name, points, info } }
 */
function apiMemberLogin(phone, birth) {
  try {
    if (!phone || !birth) {
      return { success: false, message: '電話和生日為必填' };
    }
    
    // ★ 速率限制：同一電話 60 秒內最多 5 次嘗試
    var cache = CacheService.getScriptCache();
    var rateKey = 'login_attempts_' + phone.toString().trim();
    var attempts = parseInt(cache.get(rateKey) || '0');
    if (attempts >= 5) {
      return { success: false, message: '嘗試次數過多，請 1 分鐘後再試' };
    }
    cache.put(rateKey, (attempts + 1).toString(), 60);

    var memberSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetMemberList);
    var memberData = memberSheet.getDataRange().getValues();

    // 去除前導 0
    var cleanedPhone = phone.toString().replace(/^0/, '');

    var member = null;
    for (var i = 1; i < memberData.length; i++) {
      var storedPhone = memberData[i][2].toString();
      var storedBirthDate = new Date(memberData[i][4]);
      var formattedStoredBirth = Utilities.formatDate(storedBirthDate, 'Asia/Taipei', 'yyyyMMdd');

      if (storedPhone === cleanedPhone && formattedStoredBirth === birth) {
        member = memberData[i];
        break;
      }
    }

    if (!member) {
      return { success: false, message: '無效的電話或生日' };
    }

    // 名字遮罩
    var name = member[1].toString();
    var maskedName = name.length > 2
      ? name[0] + 'x'.repeat(name.length - 2) + name[name.length - 1]
      : name[0] + 'x';

    return {
      success: true,
      data: {
        name: maskedName,
        points: parseInt(member[6]) || 0,
        info: member[7] ? member[7].toString() : '',
      }
    };
  } catch (e) {
    Logger.log('apiMemberLogin error: ' + e.toString());
    return { success: false, message: '登入失敗: ' + e.toString() };
  }
}

/**
 * 取得對外銷售清單（點數兌換 GK 清單）
 * @returns {Object} { success, data: [ [編號, 名稱, 點數, 地點], ... ] }
 */
function apiGetSellListPublic() {
  try {
    var sellList = SpreadsheetApp.openById(appBackground).getSheetByName('對外銷售清單');
    var data = sellList.getDataRange().getValues();
    return { success: true, data: data };
  } catch (e) {
    Logger.log('apiGetSellListPublic error: ' + e.toString());
    return { success: false, message: '取得清單失敗: ' + e.toString() };
  }
}

// ── 緊急通知 API ──────────────────────────────────────────

var ADMIN_EMAILS = ['onesoul.chupei@gmail.com', 'gamejeffjeff@gmail.com'];
var NOTICE_KEY = 'EMERGENCY_NOTICE';

function apiSetEmergencyNotice(message, callerEmail) {
  if (!callerEmail || ADMIN_EMAILS.indexOf(callerEmail.toLowerCase()) === -1) {
    return { success: false, message: '無權限發送緊急通知' };
  }
  if (!message || !message.trim()) {
    return { success: false, message: '通知內容不可為空' };
  }
  var props = PropertiesService.getScriptProperties();
  var notice = JSON.stringify({
    message: message.trim(),
    sender: callerEmail,
    timestamp: Utilities.formatDate(new Date(), "GMT+8", "yyyy/MM/dd HH:mm:ss")
  });
  props.setProperty(NOTICE_KEY, notice);
  return { success: true, message: '緊急通知已發佈' };
}

function apiGetEmergencyNotice() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(NOTICE_KEY);
  if (!raw) return { success: true, notice: null };
  try {
    return { success: true, notice: JSON.parse(raw) };
  } catch(e) {
    return { success: true, notice: null };
  }
}

function apiClearEmergencyNotice(callerEmail) {
  if (!callerEmail || ADMIN_EMAILS.indexOf(callerEmail.toLowerCase()) === -1) {
    return { success: false, message: '無權限撤回緊急通知' };
  }
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(NOTICE_KEY);
  return { success: true, message: '緊急通知已撤回' };
}

// ── 抽選狀況 API（大師專用）─────────────────────────────────

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

/**
 * 讀取班表設定區 (Row 2-4) 的門市營運參數
 */
function apiGetBranchConfig(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSchedule);
    if (!sheet) return { success: false, message: '找不到班表分頁' };

    var configData = sheet.getRange(1, 1, 4, 3).getDisplayValues(); // Row 1-4, A-C (用 getDisplayValues 避免時間格式被 timezone 轉換)
    var col = (branch === '竹北') ? 1 : 2; // B=1 竹北, C=2 金山

    var startTime = String(configData[1][col]).trim() || (branch === '竹北' ? '14:00' : '16:00'); // Row 2
    var standardHours = Number(configData[2][col]) || (branch === '竹北' ? 8 : 6); // Row 3
    var lateGraceMinutes = Number(configData[3][col]) || 15; // Row 4

    return {
      success: true,
      data: {
        startTime: startTime,
        standardHours: standardHours,
        lateGraceMinutes: lateGraceMinutes,
      }
    };
  } catch(error) {
    return { success: false, message: '讀取班表設定失敗: ' + error.toString() };
  }
}

/**
 * 查今天是不是營業日（讀班表 B/C 欄值班人員）
 */
function apiGetTodaySchedule(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSchedule);
    if (!sheet) return { success: false, message: '找不到班表分頁' };

    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'M/d');
    var data = sheet.getDataRange().getValues();
    var staffCol = (branch === '竹北') ? 1 : 2; // B=1 竹北, C=2 金山

    for (var r = 5; r < data.length; r++) { // Row 6+ (0-indexed: 5+)
      if (parseScheduleDate_(data[r][0]) === today) {
        var staffVal = String(data[r][staffCol] || '').trim();
        // 店休 / 未排班 / 空白 → 不營業
        if (!staffVal || staffVal.indexOf('店休') >= 0 || staffVal.indexOf('未排班') >= 0) {
          return { success: true, data: { open: false, staff: '', row: r + 1 } };
        }
        return { success: true, data: { open: true, staff: staffVal, row: r + 1 } };
      }
    }
    // 找不到今天 → 視為不營業
    return { success: true, data: { open: false, staff: '', row: -1 } };
  } catch(error) {
    return { success: false, message: '查詢班表失敗: ' + error.toString() };
  }
}

/**
 * 打卡 — 寫入班表 D/G 欄（上班時間）
 */
function apiClockIn(payload, callerEmail) {
  try {
    var branch = payload.branch;
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSchedule);
    if (!sheet) return { success: false, message: '找不到班表分頁' };

    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'M/d');
    var data = sheet.getDataRange().getValues();
    var clockInCol = (branch === '竹北') ? 3 : 6; // D=3(竹北), G=6(金山)
    var remarkCol = 9; // J

    // 讀設定區（用 getDisplayValues 避免時間格式被 timezone 轉換）
    var configCol = (branch === '竹北') ? 1 : 2;
    var configDisplay = sheet.getRange(1, 1, 4, 3).getDisplayValues();
    var startTime = String(configDisplay[1][configCol]).trim() || (branch === '竹北' ? '14:00' : '16:00');
    var lateGrace = Number(configDisplay[3][configCol]) || 15; // Row 4

    for (var r = 5; r < data.length; r++) {
      if (parseScheduleDate_(data[r][0]) === today) {
        // 已打卡
        if (data[r][clockInCol]) {
          return { success: false, message: '今天 ' + branch + ' 已打過卡 (' + data[r][clockInCol] + ')' };
        }

        var nowStr = Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm');
        sheet.getRange(r + 1, clockInCol + 1).setValue(nowStr);

        // 計算遲到/提早
        var startParts = startTime.split(':');
        var nowParts = nowStr.split(':');
        var startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        var nowMin = parseInt(nowParts[0]) * 60 + parseInt(nowParts[1]);
        var diffMin = nowMin - startMin;

        var remark = '';
        if (diffMin > 0) {
          remark = '遲到' + diffMin + '分鐘';
          // 超過寬限才通知
          if (diffMin > lateGrace) {
            sendNotification('⚠️ ' + branch + '店遲到 ' + diffMin + ' 分鐘打卡（' + (callerEmail || '') + '）');
          }
        } else if (diffMin < 0) {
          remark = '提早' + Math.abs(diffMin) + '分鐘';
        }

        if (remark) {
          var existingRemark = data[r][remarkCol] || '';
          sheet.getRange(r + 1, remarkCol + 1).setValue(existingRemark ? existingRemark + '、' + remark : remark);
        }

        return {
          success: true,
          message: branch + ' 打卡成功 (' + nowStr + ')' + (remark ? ' — ' + remark : ''),
          data: { clockInTime: nowStr, remark: remark }
        };
      }
    }
    return { success: false, message: '班表中找不到今天的日期' };
  } catch(error) {
    return { success: false, message: '打卡失敗: ' + error.toString() };
  }
}

/**
 * 查今天門市的打卡狀態
 */
function apiGetTodayAttendance(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSchedule);
    if (!sheet) return { success: false, message: '找不到班表分頁' };

    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'M/d');
    var data = sheet.getDataRange().getValues();
    var clockInCol = (branch === '竹北') ? 3 : 6;
    var clockOutCol = (branch === '竹北') ? 4 : 7;

    for (var r = 5; r < data.length; r++) {
      if (parseScheduleDate_(data[r][0]) === today) {
        var clockInVal = data[r][clockInCol];
        if (clockInVal) {
          var clockInStr = '';
          if (clockInVal instanceof Date) {
            clockInStr = Utilities.formatDate(clockInVal, 'Asia/Taipei', 'HH:mm');
          } else {
            clockInStr = String(clockInVal).trim();
          }
          var clockOutVal = data[r][clockOutCol];
          var clockOutStr = clockOutVal ? String(clockOutVal).trim() : '';
          return {
            success: true,
            data: { clocked: true, clockInTime: clockInStr, clockOutTime: clockOutStr }
          };
        }
        return { success: true, data: { clocked: false } };
      }
    }
    return { success: true, data: { clocked: false } };
  } catch(error) {
    return { success: false, message: '查詢出勤狀態失敗: ' + error.toString() };
  }
}

// ── 即時結帳監控 API ──────────────────────────────────────

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

// ── LINE 訊息 API（大師專用）────────────────────────────────

/**
 * 取得「LINE通知設定」Sheet 的所有 channel 清單
 */
function apiGetLineChannels(callerEmail) {
  if (!callerEmail || ADMIN_EMAILS.indexOf(callerEmail.toLowerCase()) === -1) {
    return { success: false, message: '無權限' };
  }
  try {
    var sheet = SpreadsheetApp.openById(appBackground).getSheetByName('LINE通知設定');
    if (!sheet) return { success: true, data: [] };
    var data = sheet.getDataRange().getValues();
    var channelMap = {};
    for (var i = 1; i < data.length; i++) {
      var ch = String(data[i][0] || '').trim();
      var desc = String(data[i][3] || '').trim();
      if (ch && !channelMap[ch]) {
        channelMap[ch] = desc || ch;
      }
    }
    var channels = [];
    for (var key in channelMap) {
      channels.push({ value: key, label: channelMap[key] });
    }
    return { success: true, data: channels };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * 發送 LINE 訊息到指定 channel
 */
function apiSendLineMessage(payload, callerEmail) {
  if (!callerEmail || ADMIN_EMAILS.indexOf(callerEmail.toLowerCase()) === -1) {
    return { success: false, message: '無權限發送 LINE 訊息' };
  }
  var channel = (payload.channel || '').trim();
  var message = (payload.message || '').trim();
  if (!channel) return { success: false, message: '請選擇發送目標' };
  if (!message) return { success: false, message: '訊息內容不可為空' };

  try {
    sendNotify(channel, message);
    console.log('[LINE Send] channel=' + channel + ', by=' + callerEmail + ', msg=' + message.substring(0, 100));
    return { success: true, message: '已發送到 [' + channel + ']' };
  } catch(e) {
    return { success: false, message: '發送失敗: ' + e.toString() };
  }
}

