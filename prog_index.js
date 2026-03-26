/**
 * prog_index.js — 前端頁面處理 + 會員登入/查詢
 * 處理 doGet 路由對應的頁面渲染及會員 API
 */

/**
 * 首頁（會員登入頁面）
 */
function index(e, menu) {
  var title = '會員登入';
  var content = render('member_detail.html', {});
  return render('tmp.html', { content: content, menu: menu }, title);
}

/**
 * 點數兌換清單頁面
 */
function stocklist(e, menu) {
  var title = '點數兌換清單';
  var content = "<h2 class='mt-3'>" + title + "</h2>";
  content += render('stock_list.html', { rows: getSellList() });
  return render('tmp.html', { content: content, menu: menu }, title);
}

/**
 * 相關連結頁面
 */
function about(e, menu) {
  var title = '相關連結';
  var content = render('about.html', { data: title });
  return render('tmp.html', { content: content, menu: menu }, title);
}

/**
 * 取得對外銷售清單資料
 * @returns {Array[]} 銷售清單二維陣列
 */
function getSellList() {
  var sellList = SpreadsheetApp.openById(appBackground).getSheetByName('對外銷售清單');
  return sellList.getDataRange().getValues();
}

/**
 * 會員登入 — 以電話 + 生日驗證身份，建立 session
 * @param {string} phone - 會員電話（含前導 0）
 * @param {string} birth - 生日（yyyyMMdd 格式）
 * @returns {string} JSON 字串含 sessionId、memberInfo 或錯誤訊息
 */
function login(phone, birth) {
  try {
    if (!phone || typeof phone !== 'string' || !birth || typeof birth !== 'string') {
      throw new Error('電話或是生日錯誤');
    }

    var memberSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetMemberList);
    var memberData = memberSheet.getDataRange().getValues();

    // 去除前導 0
    phone = phone.substring(1);
    var formattedInputBirth = birth;

    var member = memberData.slice(1).find(function(row) {
      var storedPhone = row[2].toString();
      var storedBirthDate = new Date(row[4]);
      var formattedStoredBirth = Utilities.formatDate(storedBirthDate, 'Asia/Taipei', 'yyyyMMdd');
      return storedPhone === phone && formattedStoredBirth === formattedInputBirth;
    });

    if (member) {
      var memberInfo = {
        points: parseInt(member[6]),
        name: member[1].toString(),
        birth: formattedInputBirth,
        phone: phone
      };

      var cache = CacheService.getUserCache();
      var sessionId = Utilities.getUuid();
      var threeDaysInSeconds = 3 * 24 * 60 * 60;
      cache.put(sessionId, JSON.stringify(memberInfo), threeDaysInSeconds);

      return JSON.stringify({
        sessionId: sessionId,
        memberInfo: memberInfo,
        message: 'Login successful'
      });
    } else {
      return JSON.stringify({ points: -1, message: '無效的電話或是生日' });
    }
  } catch (error) {
    console.error('Error in login:', error);
    return JSON.stringify({ points: -1, message: error.message });
  }
}

/**
 * 檢查登入狀態 — 透過 sessionId 驗證 cache 中的會員資訊
 * @param {string} sessionId - 登入時取得的 session ID
 * @returns {string} JSON 字串含會員資訊或錯誤訊息
 */
function checkLoginStatus(sessionId) {
  try {
    if (!sessionId) {
      return JSON.stringify({ points: -1, message: 'No session ID provided' });
    }

    var cache = CacheService.getUserCache();
    var memberInfoString = cache.get(sessionId);

    if (memberInfoString) {
      var memberInfo = JSON.parse(memberInfoString);
      return JSON.stringify({
        points: memberInfo.points,
        name: memberInfo.name,
        birth: memberInfo.birth,
        phone: memberInfo.phone,
        info: memberInfo.info || '',
        message: 'User is logged in'
      });
    } else {
      return JSON.stringify({ points: -1, message: 'Session expired or invalid' });
    }
  } catch (error) {
    console.error('Error in checkLoginStatus:', error);
    return JSON.stringify({ points: -1, message: error.message });
  }
}

/**
 * 查詢會員詳細資料
 * @param {string} phone - 會員電話
 * @returns {string} JSON 字串含 points、name、info
 */
function queryMemberDetail(phone) {
  var memberSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetMemberList);
  var dataRange = memberSheet.getRange(2, 2, memberSheet.getLastRow() - 1, 7);
  var memberData = dataRange.getValues();

  var memberPhone = phone.replace(/^0/, '');
  var member = memberData.find(function(row) { return row[1].toString() === memberPhone; });

  return JSON.stringify({
    points: member ? (parseInt(member[5], 10) || 0) : -1,
    name: member ? member[0].toString() : "",
    info: member ? member[6].toString() : ""
  });
}