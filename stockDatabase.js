/**
 * stockDatabase.js — 庫存資料庫操作
 */

/**
 * 自動出貨更新 — 根據編號陣列批次增加已出貨數量
 * 注意：此函數使用 hardcoded 編號陣列，適合一次性批次操作
 */
function 自動出貨更新() {
  var sourceSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetItemDB);
  var shippedItems = [
    138, 339, 360, 392, 392, 199, 27, 95, 324, 76, 389, 21, 115, 358, 400, 255, 56, 126, 187
  ];

  var dataRange = sourceSheet.getDataRange();
  var data = dataRange.getValues();

  var header = data[0];
  var idIndex = header.indexOf('編號');
  var shippedIndex = header.indexOf('自動清點已出貨');

  if (idIndex === -1 || shippedIndex === -1) {
    Logger.log('未找到所需的欄位');
    return;
  }

  for (var i = 1; i < 500; i++) {
    var id = data[i][idIndex];
    if (shippedItems.includes(id)) {
      if (!data[i][shippedIndex]) data[i][shippedIndex] = 0;
      data[i][shippedIndex] += 1;
    }
  }

  dataRange.setValues(data);
}
