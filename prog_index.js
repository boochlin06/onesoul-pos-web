function index(e, menu) {
  let title = '會員登入'
  // let content = `<h2 class='mt-3'>${title}</h2>`;
  let content = render('member_detail.html',{});
  return render('tmp.html',{content: content, menu: menu }, title);
}

function stocklist(e, menu){
  let title = '點數兌換清單';
  let content = `<h2 class='mt-3'>${title}</h2>`;
  content += render('stock_list.html',{rows:getSellList()});
  return render('tmp.html', {content: content, menu: menu}, title); 
}

function about(e, menu){
  let title = '相關連結';
  console.log(title);
  let content = render('about.html',{data:title});
  console.log('about');
  return render('tmp.html', {content: content, menu: menu}, title); 
}


function getSellList() {
  
  let sellList = SpreadsheetApp.openById(appBackground).getSheetByName('對外銷售清單');
  var sellData = sellList.getDataRange().getValues();
  
  return sellData;
}


function login(phone, birth) {
  try {
    if (!phone || typeof phone !== 'string' || !birth || typeof birth !== 'string') {
      throw new Error('電話或是生日錯誤');
    }
    let memberSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetMemberList);
    var memberData = memberSheet.getDataRange().getValues();
    
    // Remove the first character from the phone number
    phone = phone.substring(1);
    // Format the input birth date (already in 'yyyyMMdd' format)
    const formattedInputBirth = birth;
    // Skip the header row and find the matching member
    const member = memberData.slice(1).find(row => {
      const storedPhone = row[2].toString();
      const storedBirthDate = new Date(row[4]);
      const formattedStoredBirth = Utilities.formatDate(storedBirthDate, 'Asia/Taipei', 'yyyyMMdd');
      
      return storedPhone === phone && formattedStoredBirth === formattedInputBirth;
    });
    if (member) {
      const memberInfo = {
        points: parseInt(member[6]),
        name: member[1].toString(),
        birth: formattedInputBirth,
        phone: phone
      };
      
      // 將會員信息寫入 cache，作為 session，設置為三天後過期
      const cache = CacheService.getUserCache();
      const sessionId = Utilities.getUuid();
      const threeDaysInSeconds = 3 * 24 * 60 * 60; // 3天的秒數
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

function checkLoginStatus(sessionId) {
  try {
    if (!sessionId) {
      return JSON.stringify({ points: -1, message: 'No session ID provided' });
    }

    const cache = CacheService.getUserCache();
    const memberInfoString = cache.get(sessionId);

    if (memberInfoString) {
      const memberInfo = JSON.parse(memberInfoString);
      return JSON.stringify({ 
        points: memberInfo.points,
        name: memberInfo.name,
        birth: memberInfo.birth,
        phone: memberInfo.phone,
        info: memberInfo.info || '', // 添加 info 字段，如果存在的話
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

function logintest() {
  console.log(login("0955881093","19880401"));
}

function queryMemberDetail(phone) {
  let memberSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetMemberList);
  
  // 獲取需要的列：名字（第2列）、電話（第3列）和點數（第7列）
  const dataRange = memberSheet.getRange(2, 2, memberSheet.getLastRow() - 1, 7);
  const memberData = dataRange.getValues();
  
  // 移除電話號碼開頭的 '0'（如果存在）
  const cleanPhone = phone.replace(/^0/, '');
  
  // 使用 find 方法來查找匹配的會員
  const member = memberData.find(row => row[1].toString() === cleanPhone);
  
  const result = {
    points: member ? (parseInt(member[5], 10) || 0) : -1,
    name: member ? member[0].toString() : "",
    info: member? member[6].toString():""
  };
  
  return JSON.stringify(result);
}