function 福袋入檔(source = sheetLotterySetter) {
  
  var originalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(source);
  var targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetLotteryDB);
  var originalData = originalSheet.getDataRange().getValues();

  // 遍历原始数据的每一行
  var initialRow = 1;
  var currentDate = new Date();
  var startRow = initialRow;
  var colp = 2; //獎項名稱
  var colitem = 3;//獎品代碼
  var colitemName = 4;//獎品全名
  var colnum = 5;// 獎項抽數
  var colcost = 7; // 獎品價值
  var colamount = 9; // 總值
  var colpoint = 8;// 可轉換點數
  var coldone = 11; // 完成符號

  var lotterySet = [];
  var success = true;
  var finalId = 0;
  var message = '';
  for (var i = initialRow ; i <originalData.length ; i++) {
    var row = originalData[i];
    if (row[coldone] == "總成本") {
      success = true;
      startRow = i;
      finalId = getMaxValueOfColumnA()+1;
    }
    // check all value
    var name = originalData[startRow][1];
    var price = originalData[startRow + 1][coldone-1];
    var done = originalData[startRow + 5][coldone];
    if (name == '' || price == '' || done != "可") {
      // showErrorMessage("第"+(i+1)+"行有誤,福袋內容不完整");
      continue;
    }
    var item = row[colitem];
    var itemName = row[colitemName];
    var num = row[colnum];
    var pick = row[colp];
    var cost = row[colcost];
    var amount = row[colamount];
    var point = row[colpoint];
    
    console.log(i+"-"+pick+"-"+item+"-"+num+"-"+cost+"-"+amount);
    if (item != '' && num !=0) {
      if (cost == '錯誤' || num == 0 || num == '' || pick == '') {
          showErrorMessage("第"+(i+1)+"行有誤,福袋內容不完整");
          success = false;
          continue;
      }

      lotterySet.push([finalId, name, price, pick, item,itemName, point, num, currentDate]);
    }
    // console.log(lotterySet);
    if (pick == "LS") {
      if (success) {
        var lastRow = targetSheet.getLastRow();
        // 将转换后数据追加到目标工作表的最后一行之后
        if (lotterySet.length > 0) {
          targetSheet.getRange(lastRow + 1, 1, lotterySet.length, lotterySet[0].length).setValues(lotterySet);
          targetSheet.getRange(lastRow + 1, 1, lotterySet.length, lotterySet[0].length).setBorder(true, false, true, false, false, false);
          showErrorMessage(originalData[startRow][1] +"-"+ originalSheet.getRange(startRow + 6, coldone+1).getValue()+"-已成功加入\n");
          // message = message +originalData[startRow][1] +"-"+ originalSheet.getRange(startRow + 6, coldone+1).getValue()+"-已成功加入\n";
        }
        lotterySet = [];

        // 将 "done" 列的值更改为 "已完成"
        originalSheet.getRange(startRow + 6, coldone+1).setValue('已完成');
        console.log(originalData[startRow][1] +"-"+ originalSheet.getRange(startRow + 6, coldone+1).getValue());
      } else {
          Browser.msgBox(originalData[startRow][1] +"-"+ originalSheet.getRange(startRow + 6, coldone+1).getValue()+'-加入失敗');
      }
    }
  }
  // showErrorMessage(message);
  
}
function getMaxValueOfColumnA() {
  var targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetLotteryDB);
  var lastRow = targetSheet.getLastRow();
  var value = targetSheet.getRange(lastRow,1).getValue();
  var max = 0;
  if (typeof value === 'number' && value > max) {
    max = value;
  }
  return max;
}

function 金山福袋入檔() {
  福袋入檔(sheetLotterySetterJinsang);
}
function 竹北福袋入檔() {

  福袋入檔(sheetLotterySetter);

}
/**
 * 執行「開套」並自動清空輸入區
 */
function createSingleSetFinal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 定義問題：確保變數鏈結正確
  const opSheet = ss.getSheetByName(sheetTodaySalesRecordJinsang);
  const dbSheet = ss.getSheetByName(sheetLotteryDB);
  
  if (!opSheet || !dbSheet) {
    SpreadsheetApp.getUi().alert("❌ 系統錯誤：找不到分頁變數定義，請確認腳本最上方已定義變數。");
    return;
  }

  // 2. 分析現況：參數抓取與多重防呆
  const itemNo = opSheet.getRange("N2").getValue();
  const itemName = opSheet.getRange("O2").getValue();
  const totalDraws = opSheet.getRange("P2").getValue();
  const suggestedPrice = opSheet.getRange("Q2").getValue();
  const actualPrice = opSheet.getRange("R2").getValue();
  const statusCell = opSheet.getRange("S2");
  
  // 價格與參數校驗
  if (!itemNo || !totalDraws || actualPrice < (suggestedPrice * 0.9)) {
    SpreadsheetApp.getUi().alert("🛑 拒絕執行：欄位未填全，或實際價格未達 9 折標線。");
    return;
  }

  // 3. 點出矛盾：流水號生成與資料封裝
  const lastRow = dbSheet.getLastRow();
  let nextId = 1;
  if (lastRow > 1) {
    const lastValue = dbSheet.getRange(lastRow, 1).getValue();
    nextId = (parseInt(lastValue) || 0) + 1;
  }
  
  const formattedDate = Utilities.formatDate(new Date(), "GMT+8", "yyyy/M/d");
  const payload = [
    [nextId, itemName, actualPrice, "1", itemNo, itemName, "0", "1", formattedDate, "竹北"],
    [nextId, itemName, actualPrice, "Z", "0p", "非GK", "0", totalDraws - 1, formattedDate, "竹北"]
  ];

  // 4. 提出解決方向：原子寫入後「一鍵清空」
  try {
    dbSheet.getRange(lastRow + 1, 1, 2, 10).setValues(payload);
    
    // 關鍵步驟：開套完成後，清除使用者輸入的部分 (N2, P2, R2, S2)
    // 我們不清除 O2 和 Q2，因為那是公式所在地
    opSheet.getRangeList(['N2', 'P2', 'R2', 'S2']).clearContent();
    
    // 將游標自動跳回 N2，準備下一筆輸入 (提升硬體操作手感)
    opSheet.getRange("N2").activate();

    SpreadsheetApp.getUi().alert("📦 開套成功！編號 " + nextId + " 已入庫。");
    
  } catch (e) {
    SpreadsheetApp.getUi().alert("🔥 寫入失敗，系統噴錯：" + e.message);
  }
}