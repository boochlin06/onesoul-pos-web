/**
 * api_line.js - Extracted Module
 */

/**
 * 取得「LINE通知設定」Sheet 的所有 channel 清單
 */
function apiGetLineChannels(callerEmail) {
  if (!callerEmail || ADMIN_EMAILS.indexOf(callerEmail.toLowerCase()) === -1) {
    return { success: false, message: '無權限' };
  }
  try {
    var sheetName = typeof LINE_CONFIG_SHEET !== 'undefined' ? LINE_CONFIG_SHEET : 'API設定';
    var sheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetName);
    if (!sheet) return { success: true, data: [] };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, data: [] };

    var data = sheet.getRange('A2:D' + lastRow).getValues();
    var channelMap = {};
    for (var i = 0; i < data.length; i++) {
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

/**
 * 取得 GAS / LINE 用量（大師專用）
 */
function apiGetQuotaUsage(callerEmail) {
  if (!callerEmail || ADMIN_EMAILS.indexOf(callerEmail.toLowerCase()) === -1) {
    return { success: false, message: '無權限' };
  }
  var props = PropertiesService.getScriptProperties();
  var now = new Date();
  var today = Utilities.formatDate(now, 'Asia/Taipei', 'yyyyMMdd');
  var month = today.substring(0, 6);

  return {
    success: true,
    data: {
      gasApiToday: parseInt(props.getProperty('gas_api_' + today) || '0'),
      gasApiMonth: parseInt(props.getProperty('gas_api_month_' + month) || '0'),
      linePushToday: parseInt(props.getProperty('uf_push_' + today) || '0'),
      lineReplyToday: parseInt(props.getProperty('uf_reply_' + today) || '0'),
      urlFetchToday: parseInt(props.getProperty('uf_total_' + today) || '0'),
      linePushMonth: parseInt(props.getProperty('uf_push_month_' + month) || '0'),
      linePushLimit: 200,
      urlFetchLimit: 20000
    }
  };
}

// ── 臨時診斷用，確認 LINE 設定後移除 ──
function _diagnoseLine() {
  var result = {};
  var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  result.tokenSet = !!token;
  result.tokenLen = token ? token.length : 0;
  result.tokenPreview = token ? token.substring(0, 10) + '...' : '(null)';

  // 讀取所有 channel targets
  try {
    var sheet = SpreadsheetApp.openById(appBackground).getSheetByName('API設定');
    if (!sheet) {
      result.sheetFound = false;
    } else {
      result.sheetFound = true;
      var lastRow = sheet.getLastRow();
      result.lastRow = lastRow;
      if (lastRow >= 2) {
        var data = sheet.getRange('A2:D' + lastRow).getValues();
        result.allRows = data.map(function(r) {
          return { channel: String(r[0]).trim(), targetId: String(r[1]).trim().substring(0, 10) + '...', type: String(r[2]).trim(), desc: String(r[3]).trim() };
        });
        // 找 'all' channel
        result.allTargets = data.filter(function(r) { return String(r[0]).trim() === 'all'; }).map(function(r) { return String(r[1]).trim(); });
      }
    }
  } catch(e) {
    result.sheetError = e.toString();
  }

  // 嘗試呼叫 LINE API 驗證 token（用 bot info endpoint，不發訊息）
  if (token) {
    try {
      var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
        method: 'get',
        headers: { 'Authorization': 'Bearer ' + token },
        muteHttpExceptions: true
      });
      result.botInfoStatus = res.getResponseCode();
      result.botInfoBody = res.getContentText().substring(0, 200);
    } catch(e) {
      result.botInfoError = e.toString();
    }

    // 測試 1: 發到 group (allTargets[0])
    if (result.allTargets && result.allTargets.length > 0) {
      var testTarget = result.allTargets[0];
      try {
        var pushRes = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
          method: 'post',
          contentType: 'application/json',
          headers: { 'Authorization': 'Bearer ' + token },
          payload: JSON.stringify({
            to: testTarget,
            messages: [{ type: 'text', text: '🔧 診斷: group push 測試' }]
          }),
          muteHttpExceptions: true
        });
        result.groupPushStatus = pushRes.getResponseCode();
        result.groupPushBody = pushRes.getContentText().substring(0, 300);
      } catch(e) {
        result.groupPushError = e.toString();
      }
    }

    // 測試 2: 發到個人 (boss channel)
    var bossTargets = [];
    try {
      var sheet2 = SpreadsheetApp.openById(appBackground).getSheetByName('API設定');
      var data2 = sheet2.getRange('A2:D' + sheet2.getLastRow()).getValues();
      bossTargets = data2.filter(function(r) { return String(r[0]).trim() === 'boss'; }).map(function(r) { return String(r[1]).trim(); });
    } catch(e) {}
    
    if (bossTargets.length > 0) {
      try {
        var pushRes2 = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
          method: 'post',
          contentType: 'application/json',
          headers: { 'Authorization': 'Bearer ' + token },
          payload: JSON.stringify({
            to: bossTargets[0],
            messages: [{ type: 'text', text: '🔧 診斷: user push 測試' }]
          }),
          muteHttpExceptions: true
        });
        result.userPushStatus = pushRes2.getResponseCode();
        result.userPushBody = pushRes2.getContentText().substring(0, 300);
        result.userTarget = bossTargets[0].substring(0, 10) + '...';
      } catch(e) {
        result.userPushError = e.toString();
      }
    }
  }

  return { success: true, data: result };
}
