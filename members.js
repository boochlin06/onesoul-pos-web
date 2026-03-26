/**
 * members.js — 會員管理
 * 包含：會員註冊、累積銷售金額統計
 */

/**
 * 會員註冊 — 從註冊表取最新一筆資料寫入會員資料庫
 * 綁定：Google Sheets 觸發器 (onFormSubmit) 或手動執行
 */
function onMemberRegister() {
  try {
    var memberForm = SpreadsheetApp.openById(appBackground).getSheetByName(sheetMemberReg);
    var lastRowNumber = getLastDataRow(memberForm);

    if (lastRowNumber === 0) {
      Logger.log("⚠️ 註冊表沒有資料！");
      return;
    }

    var newestMember = memberForm.getRange(lastRowNumber, 1, 1, 6).getValues()[0];

    if (newestMember.every(function(cell) { return cell === ""; })) {
      Logger.log("⚠️ 取得的會員資料為空，無法新增！");
      return;
    }

    // 初始點數為 0
    newestMember.push(0);

    var memberDatabase = SpreadsheetApp.openById(appBackground).getSheetByName(sheetMemberList);
    var targetLastRow = getLastDataRow(memberDatabase) + 1;
    memberDatabase.getRange(targetLastRow, 1, 1, newestMember.length).setValues([newestMember]);
    Logger.log("✅ 會員資料新增成功，位於行 " + targetLastRow);
  } catch (error) {
    Logger.log("❌ 錯誤: " + error.toString());
  }
}

/**
 * 統計累積銷售金額 — 彙總銷售紀錄中每位會員的消費總額
 * 將結果寫入會員資料庫的 L 欄
 */
function 統計累積銷售金額() {
  var CONFIG = {
    spreadsheetId: appBackground,
    salesSheetName: sheetSalesRecord,
    memberSheetName: "會員資料庫-開發版",
    salesPhoneIdx: 0,
    salesAmountIdx: DAILY_SALE_COL.RECEIVED_AMOUNT,
    memberPhoneIdx: 2,
    targetColIndex: 12,
  };

  var ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var salesSheet = ss.getSheetByName(CONFIG.salesSheetName);
  var memberSheet = ss.getSheetByName(CONFIG.memberSheetName);

  // 讀取銷售紀錄，統計每個電話的消費總額
  console.log("正在讀取銷售紀錄 (P 欄-實收金額)...");
  var salesData = salesSheet.getDataRange().getValues();
  var salesMap = {};
  var salesCount = 0;

  for (var i = 1; i < salesData.length; i++) {
    var phone = cleanPhone(salesData[i][CONFIG.salesPhoneIdx]);
    var amount = parseFloat(salesData[i][CONFIG.salesAmountIdx]);
    var validAmount = isNaN(amount) ? 0 : amount;

    if (phone.length === 10) {
      if (!salesMap[phone]) {
        salesMap[phone] = 0;
        salesCount++;
      }
      salesMap[phone] += validAmount;
    }
  }
  console.log("統計完成：共有 " + salesCount + " 個不重複電話有消費紀錄。");

  // 比對會員並準備寫入
  var memberData = memberSheet.getDataRange().getValues();
  var outputValues = [];
  var matchCount = 0;

  for (var j = 1; j < memberData.length; j++) {
    var memberPhone = cleanPhone(memberData[j][CONFIG.memberPhoneIdx]);
    var totalSales = 0;

    if (salesMap.hasOwnProperty(memberPhone)) {
      totalSales = salesMap[memberPhone];
      if (totalSales > 0) matchCount++;
    }
    outputValues.push([totalSales]);
  }

  // 寫入 L 欄
  if (outputValues.length > 0) {
    memberSheet.getRange(1, CONFIG.targetColIndex).setValue("累積消費金額");
    memberSheet.getRange(2, CONFIG.targetColIndex, outputValues.length, 1).setValues(outputValues);
    console.log("🎉 更新完畢！共配對到 " + matchCount + " 位會員有消費。");
  }
}