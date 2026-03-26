/**
 * menulist.js — Google Sheets 自訂選單
 * 在試算表開啟時自動建立選單項目
 */

/**
 * 試算表開啟時建立自訂選單
 * 綁定：onOpen 觸發器（自動執行）
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();

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
    .addItem('關帳', 'closeAccountBox')
    .addItem('開套', 'createSingleSetFinal')
    .addToUi();
}