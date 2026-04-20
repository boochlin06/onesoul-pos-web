/**
 * api_clockin.js - Extracted Module
 */

/**
 * 讀取班表設定區 (Row 2-4) 的門市營運參數
 */
function apiGetBranchConfig(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSchedule);
    if (!sheet) return { success: false, message: '找不到班表分頁' };

    var configData = sheet.getRange(1, 1, 4, 3).getDisplayValues(); // Row 1-4, A-C (用 getDisplayValues 避免時間格式被 timezone 轉換)
    var col = (branch === '竹北') ? 1 : 2; // B=1 竹北, C=2 金山

    var startTime = String(configData[1][col]).trim() || (branch === '竹北' ? '14:00' : '16:00'); // Row 2
    var standardHours = Number(configData[2][col]) || (branch === '竹北' ? 8 : 6); // Row 3
    var lateGraceMinutes = Number(configData[3][col]) || 15; // Row 4

    return {
      success: true,
      data: {
        startTime: startTime,
        standardHours: standardHours,
        lateGraceMinutes: lateGraceMinutes,
      }
    };
  } catch(error) {
    return { success: false, message: '讀取班表設定失敗: ' + error.toString() };
  }
}

/**
 * 查今天是不是營業日（讀班表 B/C 欄值班人員）
 */
function apiGetTodaySchedule(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSchedule);
    if (!sheet) return { success: false, message: '找不到班表分頁' };

    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'M/d');
    var data = sheet.getDataRange().getValues();
    var staffCol = (branch === '竹北') ? 1 : 2; // B=1 竹北, C=2 金山

    for (var r = 5; r < data.length; r++) { // Row 6+ (0-indexed: 5+)
      if (parseScheduleDate_(data[r][0]) === today) {
        var staffVal = String(data[r][staffCol] || '').trim();
        // 店休 / 未排班 / 空白 → 不營業
        if (!staffVal || staffVal.indexOf('店休') >= 0 || staffVal.indexOf('未排班') >= 0) {
          return { success: true, data: { open: false, staff: '', row: r + 1 } };
        }
        return { success: true, data: { open: true, staff: staffVal, row: r + 1 } };
      }
    }
    // 找不到今天 → 視為不營業
    return { success: true, data: { open: false, staff: '', row: -1 } };
  } catch(error) {
    return { success: false, message: '查詢班表失敗: ' + error.toString() };
  }
}

/**
 * 打卡 — 寫入班表 D/G 欄（上班時間）
 */
function apiClockIn(payload, callerEmail) {
  try {
    var branch = payload.branch;
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSchedule);
    if (!sheet) return { success: false, message: '找不到班表分頁' };

    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'M/d');
    var data = sheet.getDataRange().getValues();
    var clockInCol = (branch === '竹北') ? 3 : 6; // D=3(竹北), G=6(金山)
    var remarkCol = 9; // J

    // 讀設定區（用 getDisplayValues 避免時間格式被 timezone 轉換）
    var configCol = (branch === '竹北') ? 1 : 2;
    var configDisplay = sheet.getRange(1, 1, 4, 3).getDisplayValues();
    var startTime = String(configDisplay[1][configCol]).trim() || (branch === '竹北' ? '14:00' : '16:00');
    var lateGrace = Number(configDisplay[3][configCol]) || 15; // Row 4

    for (var r = 5; r < data.length; r++) {
      if (parseScheduleDate_(data[r][0]) === today) {
        // 已打卡
        if (data[r][clockInCol]) {
          return { success: false, message: '今天 ' + branch + ' 已打過卡 (' + data[r][clockInCol] + ')' };
        }

        var nowStr = Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm');
        sheet.getRange(r + 1, clockInCol + 1).setValue(nowStr);

        // 計算遲到/提早
        var startParts = startTime.split(':');
        var nowParts = nowStr.split(':');
        var startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        var nowMin = parseInt(nowParts[0]) * 60 + parseInt(nowParts[1]);
        var diffMin = nowMin - startMin;

        var remark = '';
        if (diffMin > 0) {
          remark = '遲到' + diffMin + '分鐘';
          // 超過寬限才通知
          if (diffMin > lateGrace) {
            // 讀班表取得值班人員名字
            var sched = apiGetTodaySchedule(branch);
            var staffName = (sched.success && sched.data && sched.data.staff) ? sched.data.staff : '';
            var lateMsg = [
              '⚠️ ' + branch + ' 遲到打卡',
              '─────────────',
              staffName ? '👤 值班人員：' + staffName : '',
              '⏰ 遲到：' + diffMin + ' 分鐘',
              '📧 打卡帳號：' + (callerEmail || ''),
              '🕐 打卡時間：' + nowStr
            ].filter(function(l) { return l; }).join('\n');
            sendNotification(lateMsg);
          }
        } else if (diffMin < 0) {
          remark = '提早' + Math.abs(diffMin) + '分鐘';
        }

        if (remark) {
          var existingRemark = data[r][remarkCol] || '';
          sheet.getRange(r + 1, remarkCol + 1).setValue(existingRemark ? existingRemark + '、' + remark : remark);
        }

        return {
          success: true,
          message: branch + ' 打卡成功 (' + nowStr + ')' + (remark ? ' — ' + remark : ''),
          data: { clockInTime: nowStr, remark: remark }
        };
      }
    }
    return { success: false, message: '班表中找不到今天的日期' };
  } catch(error) {
    return { success: false, message: '打卡失敗: ' + error.toString() };
  }
}

/**
 * 查今天門市的打卡狀態
 */
function apiGetTodayAttendance(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSchedule);
    if (!sheet) return { success: false, message: '找不到班表分頁' };

    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'M/d');
    var data = sheet.getDataRange().getValues();
    var clockInCol = (branch === '竹北') ? 3 : 6;
    var clockOutCol = (branch === '竹北') ? 4 : 7;

    for (var r = 5; r < data.length; r++) {
      if (parseScheduleDate_(data[r][0]) === today) {
        var clockInVal = data[r][clockInCol];
        if (clockInVal) {
          var clockInStr = '';
          if (clockInVal instanceof Date) {
            clockInStr = Utilities.formatDate(clockInVal, 'Asia/Taipei', 'HH:mm');
          } else {
            clockInStr = String(clockInVal).trim();
          }
          var clockOutVal = data[r][clockOutCol];
          var clockOutStr = clockOutVal ? String(clockOutVal).trim() : '';
          return {
            success: true,
            data: { clocked: true, clockInTime: clockInStr, clockOutTime: clockOutStr }
          };
        }
        return { success: true, data: { clocked: false } };
      }
    }
    return { success: true, data: { clocked: false } };
  } catch(error) {
    return { success: false, message: '查詢出勤狀態失敗: ' + error.toString() };
  }
}
