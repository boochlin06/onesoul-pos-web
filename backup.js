function dailyMemberPointBackup() {
  // 获取源工作簿和目标工作簿
  var sourceWorkbook = SpreadsheetApp.openById(appBackground);
  var destinationWorkbook = SpreadsheetApp.openById("1fHwrgnjcgH461M9y1Yxojq-LnQtaLUGGpLCyy7AvjkE");
  
  // 获取源工作表
  var sourceSheet = sourceWorkbook.getSheetByName(sheetMemberList);

  // 获取今天的日期
  var today = new Date();
  var formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd");

  // 检查目标工作簿是否已存在今天的备份工作表，如果存在，则返回
  if (destinationWorkbook.getSheetByName(formattedDate)) {
    Logger.log("今天的备份工作表已存在，无需创建。");
    return;
  }

  // 创建今天的备份工作表
  var destinationSheet = destinationWorkbook.insertSheet(formattedDate);

  // 清空目标工作表的内容
  destinationSheet.clearContents();

  // 获取源工作表的内容范围
  var rangeToCopy = sourceSheet.getDataRange();
  var valuesToCopy = rangeToCopy.getValues();
  
  // 获取目标工作表的数据范围
  var numRows = valuesToCopy.length;
  var numColumns = valuesToCopy[0].length;
  var destinationRange = destinationSheet.getRange(1, 1, numRows, numColumns);

  // 将源工作表的内容一次性复制到目标工作表
  destinationRange.setValues(valuesToCopy);

  Logger.log("成功复制工作表到备份文件中的指定工作表中。");
}


function dailyTodaySaleRecordBackupChupei() {
  // 获取源工作簿和目标工作簿
  var sourceWorkbook = SpreadsheetApp.openById(appChupei);
  var destinationWorkbook = SpreadsheetApp.openById("14aN2rPIaILYPNdzMZACbj17GAetVxXEl38037a8nmBc");
  
  // 获取源工作表
  var sourceSheet = sourceWorkbook.getSheetByName(sheetTodaySalesRecord);

  // 获取今天的日期
  var today = new Date();
  var formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd-竹北");

  var backupSheet = destinationWorkbook.getSheetByName(formattedDate);
  var count = 1;
  while (backupSheet) {
    if (count === 1) {
      formattedDate += " -1";
    } else {
      formattedDate = formattedDate.slice(0, -3) + " -" + count;
    }
    backupSheet = destinationWorkbook.getSheetByName(formattedDate);
    count++;
  }

  // 创建今天的备份工作表
  var destinationSheet = destinationWorkbook.insertSheet(formattedDate);

  // 清空目标工作表的内容
  destinationSheet.clearContents();

  // 获取源工作表的内容范围
  var rangeToCopy = sourceSheet.getDataRange();
  var valuesToCopy = rangeToCopy.getValues();
  
  // 获取目标工作表的数据范围
  var numRows = valuesToCopy.length;
  var numColumns = valuesToCopy[0].length;
  var destinationRange = destinationSheet.getRange(1, 1, numRows, numColumns);

  // 将源工作表的内容一次性复制到目标工作表
  destinationRange.setValues(valuesToCopy);

  Logger.log("成功复制工作表到备份文件中的指定工作表中。");
}


function dailyTodaySaleRecordBackupJinsang() {
  // 获取源工作簿和目标工作簿
  var sourceWorkbook = SpreadsheetApp.openById(appJinshan);
  var destinationWorkbook = SpreadsheetApp.openById("14aN2rPIaILYPNdzMZACbj17GAetVxXEl38037a8nmBc");
  
  // 获取源工作表
  var sourceSheet = sourceWorkbook.getSheetByName(sheetTodaySalesRecord);

  // 获取今天的日期
  var today = new Date();
  var formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd-金山");

  var backupSheet = destinationWorkbook.getSheetByName(formattedDate);
  var count = 1;
  while (backupSheet) {
    if (count === 1) {
      formattedDate += " -1";
    } else {
      formattedDate = formattedDate.slice(0, -3) + " -" + count;
    }
    backupSheet = destinationWorkbook.getSheetByName(formattedDate);
    count++;
  }

  // 创建今天的备份工作表
  var destinationSheet = destinationWorkbook.insertSheet(formattedDate);

  // 清空目标工作表的内容
  destinationSheet.clearContents();

  // 获取源工作表的内容范围
  var rangeToCopy = sourceSheet.getDataRange();
  var valuesToCopy = rangeToCopy.getValues();
  
  // 获取目标工作表的数据范围
  var numRows = valuesToCopy.length;
  var numColumns = valuesToCopy[0].length;
  var destinationRange = destinationSheet.getRange(1, 1, numRows, numColumns);

  // 将源工作表的内容一次性复制到目标工作表
  destinationRange.setValues(valuesToCopy);

  Logger.log("成功复制工作表到备份文件中的指定工作表中。");
}
