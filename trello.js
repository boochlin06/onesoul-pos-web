/**
 * trello.js
 * 整合 Trello API：關帳後自動建立帶走商品 Checklist 卡片
 */

var TRELLO_CONFIG_SHEET = 'API設定';

/**
 * 取得 Trello 設定檔
 * 優先讀取「API設定」Sheet，若無則讀取 ScriptProperties
 */
function _getTrelloConfig() {
  // 1. 嘗試從 Sheet 讀取，避免寫死在程式碼中，使用者也比較喜歡用 Sheet
  try {
    var sheet = SpreadsheetApp.openById(appBackground).getSheetByName(TRELLO_CONFIG_SHEET);
    if (sheet) {
      var gData = sheet.getRange('G2:G5').getValues();
      var config = {
        'TRELLO_API_KEY': String(gData[0][0] || '').trim(),
        'TRELLO_API_TOKEN': String(gData[1][0] || '').trim(),
        'TRELLO_LIST_ID': String(gData[2][0] || '').trim(),
        'TRELLO_ENABLE': String(gData[3][0] || '').trim().toUpperCase() // G5 放 TRUE 或 FALSE
      };
      if (config.TRELLO_API_KEY && config.TRELLO_API_TOKEN && config.TRELLO_LIST_ID) {
        return config;
      }
    }
  } catch(e) {
    console.warn('[Trello] 讀取 Sheet 設定失敗: ' + e.toString());
  }

  // 2. Fallback: 讀取 ScriptProperties
  var props = PropertiesService.getScriptProperties();
  return {
    TRELLO_API_KEY: props.getProperty('TRELLO_API_KEY'),
    TRELLO_API_TOKEN: props.getProperty('TRELLO_API_TOKEN'),
    TRELLO_LIST_ID: props.getProperty('TRELLO_LIST_ID')
  };
}

/**
 * [一次性小幫手]
 * 寫入 ScriptProperties（避免 Token 還沒放在 Sheet 前系統爛掉）
 */
function setupTrelloConfigs() {
  PropertiesService.getScriptProperties().setProperties({
    'TRELLO_API_KEY': '3c5b6a0cf38a0c5c8623f807a5c3b395',
    'TRELLO_API_TOKEN': 'ATTA02cf3c77f10cc1ec68b891cefb94a09417972e046e804bb9f6177af8800dc16a0CB091DE',
    'TRELLO_LIST_ID': '6612d75d6792f7a36bf294a4'
  });
  console.log('[Trello] 成功將設定檔寫入 ScriptProperties。');
}

/**
 * 關帳觸發的 Trello 建卡主程式
 * @param {string} branch - 門市 (竹北/金山)
 * @param {string} staff - 值班人員
 * @param {Array} gkItems - 關帳 GK 清單
 */
function createTrelloCardOnCloseDay(branch, staff, gkItems) {
  var conf = _getTrelloConfig();
  if (conf.TRELLO_ENABLE !== 'TRUE') {
    console.log('[Trello] 功能未開啟 (G5 不為 TRUE)，略過建卡。');
    return;
  }

  var key = conf.TRELLO_API_KEY;
  var token = conf.TRELLO_API_TOKEN;
  var idList = conf.TRELLO_LIST_ID;
  
  if (!key || !token || !idList) {
    console.warn('[Trello] 缺少 API 憑證或 List ID，略過建卡。');
    return;
  }

  // 過濾出客人要帶走的物品
  var takenItems = [];
  if (gkItems && gkItems.length > 0) {
    takenItems = gkItems.filter(function(g) { return g.category === '帶走'; });
  }
  
  if (takenItems.length === 0) {
    console.log('[Trello] 今日無帶走商品，略過建立 Trello 卡片。');
    return;
  }

  var dateStr = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd');
  var cardName = '[' + branch + '] ' + dateStr + ' 關帳帶走清單';
  var desc = '📅 關帳日期：' + dateStr + '\n👤 值班人員：' + (staff || '未登錄') + '\n\n（清單詳見 Checklist）';

  try {
    var params = { method: 'post', muteHttpExceptions: true };
    
    // 1. 建立 Trello Card
    var cardUrl = 'https://api.trello.com/1/cards?idList=' + idList + '&name=' + encodeURIComponent(cardName) + '&desc=' + encodeURIComponent(desc) + '&key=' + key + '&token=' + token;
    var cardRes = UrlFetchApp.fetch(cardUrl, params);
    if (cardRes.getResponseCode() !== 200) {
      console.error('[Trello] Card Create Error:', cardRes.getContentText());
      return;
    }
    var cardData = JSON.parse(cardRes.getContentText());
    var idCard = cardData.id;

    // 2. 在該卡片建立 Checklist
    var clUrl = 'https://api.trello.com/1/checklists?idCard=' + idCard + '&name=' + encodeURIComponent('📦 待領取/待出貨商品') + '&key=' + key + '&token=' + token;
    var clRes = UrlFetchApp.fetch(clUrl, params);
    if (clRes.getResponseCode() !== 200) {
      console.error('[Trello] Checklist Create Error:', clRes.getContentText());
      return;
    }
    var clData = JSON.parse(clRes.getContentText());
    var idChecklist = clData.id;

    // 3. 迴圈將被帶走的商品加入 Checklist
    for (var i = 0; i < takenItems.length; i++) {
      var itemText = takenItems[i].name + ' (' + takenItems[i].prizeId + ') — 👤 ' + takenItems[i].customer;
      var itemUrl = 'https://api.trello.com/1/checklists/' + idChecklist + '/checkItems?name=' + encodeURIComponent(itemText) + '&key=' + key + '&token=' + token;
      UrlFetchApp.fetch(itemUrl, params);
    }
    console.log('[Trello] 成功建立帶走清單卡片，ID: ' + idCard);
  } catch (e) {
    console.error('[Trello] 串接例外錯誤:', e.toString());
  }
}

/**
 * 測試 Trello 串接 (Mock)
 * 請在 GAS 編輯器中選擇此函式並按下「執行」(Run)
 */
function testTrelloIntegration() {
  console.log('--- 開始測試 Trello 自動建卡 ---');
  var mockBranch = '竹北(測試)';
  var mockStaff = '王大明(Mock)';
  var mockGkItems = [
    { category: '帶走', name: '海賊王 尼卡路飛 (A賞)', prizeId: '102', customer: '陳先生' },
    { category: '帶走', name: '鬼滅之刃 禰豆子 (B賞)', prizeId: '55', customer: '林小姐' },
    { category: '換點數', name: '不要的娃娃', prizeId: '12', customer: '不重要' } // 這個不會出現在卡片上
  ];
  
  // 檢查配置檔
  var conf = _getTrelloConfig();
  console.log('目前取得的設定: ', { 
    HAS_KEY: !!conf.TRELLO_API_KEY, 
    HAS_TOKEN: !!conf.TRELLO_API_TOKEN, 
    LIST_ID: conf.TRELLO_LIST_ID,
    ENABLE: conf.TRELLO_ENABLE 
  });

  if (conf.TRELLO_ENABLE !== 'TRUE') {
    console.warn('⚠️ 警告：API設定的 G5 尚未設為 TRUE，所以建卡會被略過。');
  }

  // 執行建卡 (如果 G5 沒開，這裡也不會有動作)
  createTrelloCardOnCloseDay(mockBranch, mockStaff, mockGkItems);
  console.log('--- 測試結束 ---');
}
