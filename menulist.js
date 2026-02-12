function onOpen() {
  var ui = SpreadsheetApp.getUi();
  // 创建自定义菜单
  ui.createMenu('福袋')
      .addItem('竹北福袋入檔', '竹北福袋入檔')
      .addItem('金山福袋入檔', '金山福袋入檔')
      .addToUi();
  ui.createMenu('修正工具')
      .addItem('點數校正', '點數校正')
      .addToUi();
  ui.createMenu('結帳')
  .addItem('結帳', '結帳')
  .addToUi();
  ui.createMenu('當日操作')
  .addItem('刪除錯單', 'deleteTodaySaleRecord')
  .addItem('關帳','closeAccountBox')
  .addItem('開套','createSingleSetFinal')
  // .addItem('關帳方塊','closeAccountBox')
  .addToUi();
}