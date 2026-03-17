/*=====================================
  [API Controller] 處理所有從 React 網頁發過來的 POST API 請求
=====================================*/

function doPost(e) {
  // CORS Headers 允許外部前端呼叫
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  try {
    // 解析 JSON body
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var payload = requestData.payload;

    var responseData = {};

    // 根據 action 分配到不同的邏輯函數
    switch (action) {
      case 'getMemberInfo':
        responseData = api_getMemberInfo(payload);
        break;
      case 'submitCheckout':
        responseData = api_submitCheckout(payload);
        break;
      // 可擴充其他 API
      default:
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: 'Unknown action: ' + action
        })).setMimeType(ContentService.MimeType.JSON);
    }

    // 正常回傳
    var res = ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: responseData
    })).setMimeType(ContentService.MimeType.JSON);
    
    return res;

  } catch (error) {
    // 錯誤回傳
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 處理 OPTIONS 請求，避免預檢 (Preflight) CORS 出錯
function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

// --- API 具體邏輯 ---

/**
 * 查詢會員資訊
 * payload: { phone: "0912345678" }
 */
function api_getMemberInfo(payload) {
  var phone = payload.phone;
  if (!phone) throw new Error("Missing phone number");

  var tempApp = SpreadsheetApp.openById(appBackground);
  var memberSheet = tempApp.getSheetByName(sheetMemberList);
  var data = memberSheet.getDataRange().getValues();
  
  // 第一行是標題，從第二行開始找
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] == phone) { // 手機號碼在第三列（索引2）
      return {
        name: data[i][1], // 姓名
        phone: data[i][2], // 電話
        points: data[i][6], // 目前點數(H? or G? 需要對應 sheet 上的位置) -> 對應現有程式碼點數為 6
      };
    }
  }
  
  throw new Error("找不到該手機號碼的會員資料");
}

/**
 * 送出結帳
 * 這裡會將網頁傳來的購物資料轉換為寫入 Sheet 的格式，取代現有的服務端讀出 UI Cell。
 */
function api_submitCheckout(payload) {
  throw new Error("Not implemented yet.");
}
