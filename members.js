/**
 * members.js — 會員管理
 * 包含：會員註冊 (onFormSubmit trigger)
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