/**
 * notify.js — 統一通知接口
 *
 * 目前只 console.log，未來可替換為任何通知服務。
 *
 * 接入範例（擇一）：
 * ─────────────────────────────────────────────────
 * LINE Messaging API (推薦，LINE Notify 已於 2025 停用)
 *   → 需要：LINE Official Account + Channel Access Token
 *   → UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
 *       method: 'post',
 *       contentType: 'application/json',
 *       headers: { 'Authorization': 'Bearer ' + token },
 *       payload: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: message }] })
 *     });
 *
 * Telegram Bot
 *   → 需要：Bot Token + Chat ID (從 ScriptProperties 讀取)
 *   → UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
 *       method: 'post',
 *       payload: { chat_id: chatId, text: message }
 *     });
 *
 * Google Chat Webhook
 *   → 需要：Webhook URL (從 ScriptProperties 讀取)
 *   → UrlFetchApp.fetch(webhookUrl, {
 *       method: 'post',
 *       contentType: 'application/json',
 *       payload: JSON.stringify({ text: message })
 *     });
 * ─────────────────────────────────────────────────
 */

/**
 * 發送通知訊息
 * @param {string} message - 通知內容
 */
function sendNotification(message) {
  // TODO: 接上通知服務後取消下方註解，並加入對應的實作
  console.log('[Notification] ' + message);
}
