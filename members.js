function onMemberRegister() {
  try {
    // 開啟會員註冊表
    let memberForm = SpreadsheetApp.openById(appBackground).getSheetByName(sheetMemberReg);

    // 精準取得有資料的最後一行
    let lastRowNumber = getLastDataRow(memberForm);

    // 如果沒有資料，直接結束
    if (lastRowNumber === 0) {
      Logger.log("⚠️ 註冊表沒有資料！");
      return;
    }

    // 取得最新會員資料（1~6欄）
    let newestMember = memberForm.getRange(lastRowNumber, 1, 1, 6).getValues()[0];

    // 資料檢查：確認不是空的
    if (newestMember.every(cell => cell === "")) {
      Logger.log("⚠️ 取得的會員資料為空，無法新增！");
      return;
    }

    // 在資料末尾新增 0
    newestMember.push(0);

    // 開啟會員資料庫
    let memberDatabase = SpreadsheetApp.openById(appBackground).getSheetByName(sheetMemberList);

    Logger.log("✅ 準備新增會員資料: " + newestMember.join(", "));

    // 確保資料格式正確並垂直新增
    let targetLastRow = getLastDataRow(memberDatabase) + 1;
    memberDatabase.getRange(targetLastRow, 1, 1, newestMember.length).setValues([newestMember]);
    Logger.log("✅ 資料已使用 setValues 新增成功！ at ." + targetLastRow);

  } catch (error) {
    Logger.log("❌ 錯誤: " + error.toString());
  }
}

/**
 * 精準判斷有值的最後一行（忽略格式化的空白儲存格）
 */
function getLastDataRow(sheet) {
  let data = sheet.getDataRange().getValues();  // 取得所有資料
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].some(cell => cell !== "")) {  // 如果該列有任何一格不為空
      return i + 1;  // 回傳實際有資料的行號
    }
  }
  return 0;  // 全表皆為空
}

function 統計累積銷售金額() {
  // ==========================================
  // 1. 設定區 (根據截圖精準校正)
  // ==========================================
  var CONFIG = {
    spreadsheetId: appBackground,
    salesSheetName: sheetSalesRecord,
    memberSheetName: "會員資料庫-開發版",
    
    // --- 銷售紀錄表 (根據截圖1) ---
    salesPhoneIdx: 0,    // A欄：電話
    // ⚠️ 關鍵修正：抓取 P 欄 (Index 15) 的「實收金額」
    // (A=0 ... L=11 ... O=14(id), P=15)
    salesAmountIdx: 15,  
    
    // --- 會員資料庫 (根據截圖2) ---
    memberPhoneIdx: 2,   // C欄：電話
    
    // ⚠️ 關鍵修正：寫入 L 欄 (第 12 欄)
    // 因為 K 欄是「重複註冊」，我們寫在它後面才不會蓋掉資料
    targetColIndex: 12   
  };

  // ==========================================
  // 2. 輔助工具：電話暴力整形 (這段邏輯是正確的，保留)
  // ==========================================
  function cleanPhone(input) {
    if (!input) return "";
    var str = input.toString().replace(/\D/g, ''); // 殺掉非數字
    
    // 9碼補0 (912... -> 0912...)
    if (str.length === 9) {
      return "0" + str;
    }
    // 886開頭修正
    if (str.startsWith("886") && str.length > 9) {
      return "0" + str.substring(3);
    }
    return str;
  }

  // ==========================================
  // 3. 主程式執行
  // ==========================================
  var ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var salesSheet = ss.getSheetByName(CONFIG.salesSheetName);
  var memberSheet = ss.getSheetByName(CONFIG.memberSheetName);
  
  // --- A. 讀取銷售紀錄 ---
  console.log("正在讀取銷售紀錄 (P欄-實收金額)...");
  var salesData = salesSheet.getDataRange().getValues();
  var salesMap = {};
  var salesCount = 0;
  
  for (var i = 1; i < salesData.length; i++) {
    var rawPhone = salesData[i][CONFIG.salesPhoneIdx];
    var phone = cleanPhone(rawPhone);
    
    // 讀取 P 欄 (Index 15)
    var amount = parseFloat(salesData[i][CONFIG.salesAmountIdx]);
    var validAmount = isNaN(amount) ? 0 : amount;
    
    if (phone.length === 10) {
      if (!salesMap[phone]) {
        salesMap[phone] = 0;
        salesCount++; // 紀錄有多少人消費
      }
      salesMap[phone] += validAmount;
    }
  }
  console.log("統計完成：共有 " + salesCount + " 個不重複電話有消費紀錄。");

  // --- B. 比對會員並準備寫入 ---
  console.log("正在比對會員資料...");
  var memberData = memberSheet.getDataRange().getValues();
  var outputValues = [];
  var matchCount = 0;
  
  for (var j = 1; j < memberData.length; j++) {
    var rawMemberPhone = memberData[j][CONFIG.memberPhoneIdx];
    var memberPhone = cleanPhone(rawMemberPhone);
    
    var totalSales = 0;
    
    // 比對電話
    if (salesMap.hasOwnProperty(memberPhone)) {
      totalSales = salesMap[memberPhone];
      if(totalSales > 0) matchCount++; // 紀錄成功配對且有金額的人數
    }
    
    outputValues.push([totalSales]);
  }
  
  // --- C. 寫入資料 (L欄) ---
  if (outputValues.length > 0) {
    // 為了保險，先設定標題 (如果是新的欄位)
    memberSheet.getRange(1, CONFIG.targetColIndex).setValue("累積消費金額");
    
    // 寫入數據
    memberSheet.getRange(2, CONFIG.targetColIndex, outputValues.length, 1)
               .setValues(outputValues);
    
    console.log("🎉 更新完畢！");
    console.log("成功將金額寫入 L 欄 (第12欄)。");
    console.log("共配對到 " + matchCount + " 位會員有消費。");
  }
}