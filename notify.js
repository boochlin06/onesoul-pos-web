/**
 * notify.js — LINE Messaging API 推送通知（Sheet-based channel 制）
 *
 * 通知目標設定在後台 Sheet「LINE通知設定」分頁：
 *   A 欄: channel（如 all, admin, 竹北, 金山）
 *   B 欄: targetId（groupId 或 userId）
 *   C 欄: type（group / user）
 *   D 欄: 說明
 *
 * ScriptProperties 只需設定：
 *   LINE_CHANNEL_ACCESS_TOKEN — Channel Access Token (long-lived)
 *
 * 用法：
 *   sendNotify('all', '📊 關帳通知');      → 發到 channel=all 的所有目標
 *   sendNotify('admin', '⚠️ 作廢訂單');    → 只發給 admin
 *   sendNotify('竹北', '⏰ 竹北未打卡');    → 只發竹北群
 */

var LINE_CONFIG_SHEET = 'LINE通知設定';

// ── 核心通知 API ──────────────────────────────────────────

/**
 * 發送通知到指定 channel 的所有目標
 * @param {string} channel - channel 名稱（對應 Sheet A 欄）
 * @param {string} message - 通知內容
 */
function sendNotify(channel, message) {
  var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) {
    console.log('[Notify] (TOKEN 未設定) [' + channel + '] ' + message);
    return;
  }

  var targets = _getChannelTargets(channel);
  if (targets.length === 0) {
    console.log('[Notify] channel "' + channel + '" 無對應目標，略過');
    return;
  }

  for (var i = 0; i < targets.length; i++) {
    _linePush(token, targets[i], message);
  }
}

/**
 * 向下相容：發到 'all' channel（取代舊的 sendNotification）
 * @param {string} message - 通知內容
 */
function sendNotification(message) {
  sendNotify('all', message);
}

/**
 * 向下相容：發給管理員（取代舊的 sendAdminNotification）
 * @param {string} message - 通知內容
 */
function sendAdminNotification(message) {
  sendNotify('admin', message);
}

// ── Sheet 設定讀取 ────────────────────────────────────────

/**
 * 從「LINE通知設定」Sheet 讀取指定 channel 的 targetId 列表
 * 支援 5 分鐘快取，避免每次通知都讀 Sheet
 * @param {string} channel
 * @returns {string[]} targetId 陣列
 */
function _getChannelTargets(channel) {
  // 先查 cache
  var cache = CacheService.getScriptCache();
  var cacheKey = 'line_ch_' + channel;
  var cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) { /* cache corrupt */ }
  }

  // 讀 Sheet
  try {
    var sheet = SpreadsheetApp.openById(appBackground).getSheetByName(LINE_CONFIG_SHEET);
    if (!sheet) {
      console.error('[Notify] 找不到「' + LINE_CONFIG_SHEET + '」分頁');
      return [];
    }

    var data = sheet.getDataRange().getValues();
    var targets = [];
    for (var i = 1; i < data.length; i++) { // 跳標題
      var ch = String(data[i][0] || '').trim();
      var targetId = String(data[i][1] || '').trim();
      if (ch === channel && targetId) {
        targets.push(targetId);
      }
    }

    // 寫入 cache（5 分鐘）
    try { cache.put(cacheKey, JSON.stringify(targets), 300); } catch(e) {}
    return targets;
  } catch(e) {
    console.error('[Notify] 讀取 Sheet 失敗: ' + e.toString());
    return [];
  }
}

// ── LINE API 底層 ─────────────────────────────────────────

/**
 * LINE Push Message
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
      console.error('[LINE Push] → ' + to.substring(0, 8) + '... HTTP ' + code + ': ' + res.getContentText());
    }
  } catch (e) {
    console.error('[LINE Push Error] ' + e.toString());
  }
}

/**
 * LINE Reply Message（回覆用，免費不算 Push 額度）
 */
function _lineReply(replyToken, message) {
  var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) return;
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: message }]
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error('[LINE Reply Error] ' + e.toString());
  }
}

// ── Webhook 處理 ──────────────────────────────────────────

/**
 * 處理 LINE webhook event
 * - 收到「ID」指令 → 回覆 groupId / userId（方便設定 Sheet）
 * @param {Object} event - LINE webhook event
 */
function handleLineWebhookEvent(event) {
  // 「ID」指令 — 回覆 groupId 和 userId
  if (event.type === 'message' && event.message && event.message.type === 'text') {
    var text = event.message.text.trim();
    if (text === 'ID' || text === 'id') {
      var info = ['📋 LINE ID 資訊'];
      if (event.source.groupId) info.push('GroupId: ' + event.source.groupId);
      if (event.source.userId) info.push('UserId: ' + event.source.userId);
      info.push('', '請將上方 ID 貼到後台「LINE通知設定」分頁');
      _lineReply(event.replyToken, info.join('\n'));
    }
  }
}

// ── 出勤通知 ──────────────────────────────────────────────

/**
 * 定時檢查未打卡 — 每小時自動執行
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
      var cacheKey = 'unclocked_' + branch + '_' + todayKey;
      if (cache.get(cacheKey)) continue;

      var config = apiGetBranchConfig(branch);
      if (!config.success || !config.data) continue;
      var parts = config.data.startTime.split(':');
      var startMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);

      if (nowMin < startMin + 30) continue;
      if (nowMin > startMin + 180) continue;

      var sched = apiGetTodaySchedule(branch);
      if (!sched.success || !sched.data || !sched.data.open) continue;

      var att = apiGetTodayAttendance(branch);
      if (att.success && att.data && !att.data.clocked) {
        // 發到對應門市的 channel，沒有就發 all
        var ch = _getChannelTargets(branch).length > 0 ? branch : 'all';
        sendNotify(ch,
          '⏰ ' + branch + ' 店開店時間已過，尚未打卡！\n' +
          '👤 今日值班：' + sched.data.staff
        );
        cache.put(cacheKey, '1', 21600);
      }
    } catch (e) {
      console.error('[checkUnclocked] ' + branch + ': ' + e.toString());
    }
  }
}

/**
 * 自動安裝未打卡檢查觸發器 — 只需執行一次
 */
function setupUnclockedTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkUnclocked') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('checkUnclocked')
    .timeBased()
    .everyHours(1)
    .create();
  console.log('[Setup] checkUnclocked trigger installed (every 1 hour)');
}

// ── 關帳通知 ──────────────────────────────────────────────

/**
 * 關帳完成通知 — 從 apiCloseDay 呼叫
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
  sendNotify('all', lines.join('\n'));
}

// ── 測試 ──────────────────────────────────────────────────

function testLineNotify() {
  sendNotify('all', '🧪 測試通知 — channel 制串接成功！');
}

function testAdminNotify() {
  sendNotify('admin', '🔒 管理員測試 — 只有你看得到');
}
