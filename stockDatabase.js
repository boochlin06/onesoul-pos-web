function 自動出貨更新() {
  var sourceSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetItemDB);
  // 出貨的編號陣列
  var shippedItems = [
  138, 339, 360, 392, 392, 199, 27, 95, 324, 76, 389, 21, 115, 358, 400, 255,56,126,187
];

  // 取得資料範圍及資料
  var dataRange = sourceSheet.getDataRange();
  var data = dataRange.getValues();

  // 找到 "編號" 和 "自動清點已出貨" 欄位的索引
  var header = data[0];
  var idIndex = header.indexOf('編號');
  var shippedIndex = header.indexOf('自動清點已出貨');

  // 若索引無效，終止執行
  if (idIndex === -1 || shippedIndex === -1) {
    Logger.log('未找到所需的欄位');
    return;
  }

  // 更新出貨數量
  for (var i = 1; i < 500; i++) {
    var id = data[i][idIndex];
    if (shippedItems.includes(id)) {
      // 若欄位是空白，則初始化為 0
      if (!data[i][shippedIndex]) {
        data[i][shippedIndex] = 0;
      }
      // 增加出貨數量
      data[i][shippedIndex] += 1;
    }
  }

  // 將更新後的資料寫回表格
  dataRange.setValues(data);
}
