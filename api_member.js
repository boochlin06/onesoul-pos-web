/**
 * api_member.js - Extracted Module
 */

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

// ── 5. 取得所有會員 API ───────────────────────────────────
function apiGetAllMembers() {
  try {
    // 1. 優先命中記憶體分塊快取 (約 200~400ms)
    var cached = typeof getChunkedCache === 'function' ? getChunkedCache('ALL_MEMBERS') : null;
    if (cached) {
      return { success: true, data: cached, fromCache: true };
    }

    // 2. Cache Miss: 開檔讀取並使用原生高效日期格式化
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetMemberList);
    if (!sheet) return { success: false, message: '找不到會員資料庫分頁' };
    var data = sheet.getDataRange().getValues();
    var results = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var phone = row[2] ? row[2].toString().trim() : '';
      if (!phone) continue;

      results.push({
        timestamp: typeof fastFormatDate === 'function' ? fastFormatDate(row[0], true) : (row[0] || ''),
        name: row[1] ? row[1].toString() : '',
        phone: phone,
        gender: row[3] ? row[3].toString() : '',
        birthday: typeof fastFormatDate === 'function' ? fastFormatDate(row[4], false) : (row[4] || ''),
        store: row[5] ? row[5].toString() : '',
        points: Number(row[6]) || 0,
        note: row[7] ? row[7].toString() : ''
      });
    }

    if (typeof setChunkedCache === 'function') {
      setChunkedCache('ALL_MEMBERS', results, 21600); // 6 小時
    }
    return { success: true, data: results };
  } catch(error) { return { success: false, message: error.toString() }; }
}

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
