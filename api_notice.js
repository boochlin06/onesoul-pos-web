/**
 * api_notice.js - Extracted Module
 */

function apiSetEmergencyNotice(message, callerEmail) {
  if (!callerEmail || ADMIN_EMAILS.indexOf(callerEmail.toLowerCase()) === -1) {
    return { success: false, message: '無權限發送緊急通知' };
  }
  if (!message || !message.trim()) {
    return { success: false, message: '通知內容不可為空' };
  }
  var props = PropertiesService.getScriptProperties();
  var notice = JSON.stringify({
    message: message.trim(),
    sender: callerEmail,
    timestamp: Utilities.formatDate(new Date(), "GMT+8", "yyyy/MM/dd HH:mm:ss")
  });
  props.setProperty(NOTICE_KEY, notice);
  return { success: true, message: '緊急通知已發佈' };
}

function apiGetEmergencyNotice() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(NOTICE_KEY);
  if (!raw) return { success: true, notice: null };
  try {
    return { success: true, notice: JSON.parse(raw) };
  } catch(e) {
    return { success: true, notice: null };
  }
}

function apiClearEmergencyNotice(callerEmail) {
  if (!callerEmail || ADMIN_EMAILS.indexOf(callerEmail.toLowerCase()) === -1) {
    return { success: false, message: '無權限撤回緊急通知' };
  }
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(NOTICE_KEY);
  return { success: true, message: '緊急通知已撤回' };
}
