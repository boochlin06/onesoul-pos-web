/**
 * notify.js — LINE Messaging API 推送通知
 *
 * ScriptProperties 需設定：
 *   LINE_CHANNEL_ACCESS_TOKEN — Channel Access Token (long-lived)
 *   LINE_GROUP_ID             — 通知目標群組 ID
 */

/**
 * 推送通知到 LINE 群組
 * @param {string} message - 通知內容
 */
function sendNotification(message) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  var groupId = props.getProperty('LINE_GROUP_ID');

  if (!token || !groupId) {
    console.log('[Notification] (LINE 未設定) ' + message);
    return;
  }

  _linePush(token, groupId, message);
}

/**
 * 推送通知到特定使用者
 * @param {string} userId - LINE userId
 * @param {string} message - 通知內容
 */
function sendNotificationToUser(userId, message) {
  var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token || !userId) {
    console.log('[Notification] (LINE 未設定) ' + message);
    return;
  }
  _linePush(token, userId, message);
}

/**
 * LINE Push Message 底層
 */
function _linePush(token, to, message) {
  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify({
        to: to,
        messages: [{ type: 'text', text: message }]
      }),
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    if (code !== 200) {
      console.error('[LINE Push] HTTP ' + code + ': ' + res.getContentText());
    }
  } catch (e) {
    console.error('[LINE Push Error] ' + e.toString());
  }
}

/**
 * Webhook 處理 — 自動擷取 groupId
 * bot 被加入群組時，LINE 會送 event，從中取得 groupId 存入 ScriptProperties
 * @param {Object} event - LINE webhook event
 */
function handleLineWebhookEvent(event) {
  if (event.source && event.source.groupId) {
    var gid = event.source.groupId;
    PropertiesService.getScriptProperties().setProperty('LINE_GROUP_ID', gid);
    console.log('[LINE] Saved groupId: ' + gid);
  }
}

/**
 * 定時檢查未打卡 — 每小時自動執行
 * 動態讀取各店開店時間，開店後 30 分鐘仍未打卡才通知
 * 用 CacheService 避免同一天重複通知
 */
function checkUnclocked() {
  var branches = ['竹北', '金山'];
  var cache = CacheService.getScriptCache();
  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var todayKey = Utilities.formatDate(now, 'Asia/Taipei', 'yyyyMMdd');

  for (var i = 0; i < branches.length; i++) {
    var branch = branches[i];
    try {
      // 已通知過今天這家店就跳過
      var cacheKey = 'unclocked_' + branch + '_' + todayKey;
      if (cache.get(cacheKey)) continue;

      // 讀取開店時間
      var config = apiGetBranchConfig(branch);
      if (!config.success || !config.data) continue;
      var parts = config.data.startTime.split(':');
      var startMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);

      // 還沒到開店後 30 分鐘 → 不檢查
      if (nowMin < startMin + 30) continue;
      // 超過開店後 3 小時 → 不再提醒（避免深夜誤觸）
      if (nowMin > startMin + 180) continue;

      var sched = apiGetTodaySchedule(branch);
      if (!sched.success || !sched.data || !sched.data.open) continue;

      var att = apiGetTodayAttendance(branch);
      if (att.success && att.data && !att.data.clocked) {
        sendNotification(
          '⏰ ' + branch + ' 店開店時間已過，尚未打卡！\n' +
          '👤 今日值班：' + sched.data.staff
        );
        // 標記已通知，6 小時內不重複
        cache.put(cacheKey, '1', 21600);
      }
    } catch (e) {
      console.error('[checkUnclocked] ' + branch + ': ' + e.toString());
    }
  }
}

/**
 * 自動安裝未打卡檢查觸發器 — 只需執行一次
 * 會先清除舊的同名 trigger，再建一個每小時執行的
 */
function setupUnclockedTrigger() {
  // 清除舊 trigger
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkUnclocked') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // 建立每小時執行
  ScriptApp.newTrigger('checkUnclocked')
    .timeBased()
    .everyHours(1)
    .create();
  console.log('[Setup] checkUnclocked trigger installed (every 1 hour)');
}

/**
 * 關帳完成通知 — 從 apiCloseDay 呼叫
 * @param {string} branch - 門市
 * @param {number} txCount - 交易筆數
 * @param {number} totalRevenue - 營業額
 * @param {number} totalCreditCard - 信用卡總額
 * @param {number} totalRemittance - 匯款總額
 * @param {number} discrepancy - 現金差異
 */
function notifyCloseDay(branch, txCount, totalRevenue, totalCreditCard, totalRemittance, discrepancy) {
  var cashRevenue = totalRevenue - totalCreditCard - totalRemittance;
  var lines = [
    '📊 ' + branch + ' 今日關帳完成',
    '─────────────',
    '💰 營業額：$' + Math.round(totalRevenue),
    '📝 交易筆數：' + txCount + ' 筆',
    '💵 現金：$' + Math.round(cashRevenue),
    '💳 信用卡：$' + Math.round(totalCreditCard),
    '🏦 匯款：$' + Math.round(totalRemittance),
  ];
  if (discrepancy !== 0) {
    lines.push('⚠️ 現金差異：$' + discrepancy);
  }
  sendNotification(lines.join('\n'));
}

/**
 * 測試用 — 驗證 LINE 推送是否正常
 */
function testLineNotify() {
  sendNotification('🧪 Dev 測試通知 — LINE 串接成功！');
}
