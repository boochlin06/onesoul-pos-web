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
