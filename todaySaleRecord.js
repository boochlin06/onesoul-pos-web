function deleteTodaySaleRecord() {
  var sourceSheet = SpreadsheetApp.openById(appChupei).getSheetByName(sheetTodaySalesRecordChupei);
  var sourceBackSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetTodaySalesRecordChupei);
  var deleteId = sourceSheet.getRange("F1").getValue(); // 获取要删除的 ID
  var lastRow = sourceSheet.getLastRow();
  var saleItems = sourceSheet.getRange("A6:X" + lastRow).getValues(); // 获取销售记录的数据范围
  var deletedRows = {}; // 用于存储要删除的行索引
  var pointDeltas = {}; // 用于存储需要修改的点数差值
  var idIndex = 14;
  var deleteIndex = 22;
  var pointIndex = 10;
  var phoneIndex = 0;

  if (deleteId === '') {
    showErrorMessage("刪除 ID 為空");
    return;
  }

  // 遍历销售记录，收集要删除的行索引及需要修改的电话号码和点数差值
  saleItems.forEach(function(row, index) {
    var id = row[idIndex]; // 获取每一行的 ID（假设 ID 在第 15 列）
    var deleted = row[deleteIndex]; // 假设“Y”表示已删除
    console.log(id+"-"+deleted);
    if (id === deleteId && deleted !== "Y") {
      var phoneNumber = row[phoneIndex]; // 获取电话号码
      var point = row[pointIndex]; // 获取点数
      if (!isNaN(point)) {
        deletedRows[index + 6] = true; // 将要删除的行索引添加到对象中，索引从 0 开始，但实际行号从 6 开始
        pointDeltas[phoneNumber] = (pointDeltas[phoneNumber] || 0) + point;
      } else {
        showErrorMessage("行 " + (index + 6) + " 的点数不是数字，无法处理。");
      }
    }
  });

  try {
    // 删除收集到的行
    for (var row in deletedRows) {
      sourceBackSheet.getRange(row, deleteIndex+1).setValue("Y"); // 标记为已删除
      var range = sourceBackSheet.getRange(row, 1, 1, deleteIndex+2); // 获取要删除的行的范围
      range.setFontLine("line-through").setBackground("red"); // 将要删除的行标记为删除状态
    }

    // 修改点数
    for (var phoneNumber in pointDeltas) {
      var delta = pointDeltas[phoneNumber];
      var currentPoint = addMemberPointsByPhone(phoneNumber, -delta);
      if (currentPoint >= 0) {
        showErrorMessage("刪除 ID " + deleteId + " 成功，點數修正為：" + currentPoint);
      } else if (currentPoint === -2) {
        showErrorMessage("刪除 ID " + deleteId + " 成功");
      } else if (currentPoint === -1) {
        showErrorMessage("刪除 ID " + deleteId + " 成功，但客戶點數變為負值");
      }
    }

    // 清除 F1 单元格的值
    sourceSheet.getRange("F1").setValue("");
  } catch (error) {
    console.error(error);
    showErrorMessage('刪除销售记录时发生异常');

    // 恢复表格状态
    for (var row in deletedRows) {
      sourceBackSheet.getRange(row, deleteIndex+1).setValue(""); // 清除删除标记
    }
  }
}

function copyToSaleRecord() {
  var sourceSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetTodaySalesRecordChupei);
  var destSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetSalesRecord);
  var lastRow = sourceSheet.getLastRow();
  var saleItems = sourceSheet.getRange("A6:X" + lastRow).getValues(); // 获取销售记录的数据范围

  var deleteIndex = 22;
  var idIndex = 0; // 假设 ID 在第一列

  // 複製當日結帳紀錄
  // 遍历销售记录，删除的行不複製到新的銷售紀錄sheetSalesRecord，其他就不複製
  for (var i = 0; i < saleItems.length; i++) {
    var id = saleItems[i][idIndex]; // 获取每一行的 ID
    var deleted = saleItems[i][deleteIndex]; // 假设“Y”表示已删除
    console.log(id+"-"+deleted);
    if (deleted !== "Y") {
      // 将未删除的行複製到新的銷售紀錄sheetSalesRecord
      destSheet.appendRow(saleItems[i]);
    }
  }
  sourceSheet.getRange("A6:X" + lastRow).clearContent();

}

function closeAccountBox() {
  // 變數初始化與資料讀取 (保持不變)
  var sourceSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetTodaySalesRecordChupei);
  var destSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetSalesRecord);
  var lastRow = sourceSheet.getLastRow();
  if (lastRow <= 6) {
    lastRow = 6;
  }
  var saleItems = sourceSheet.getRange("A6:X" + lastRow).getValues(); 

  var frontData = SpreadsheetApp.openById(appChupei).getSheetByName(sheetTodaySalesRecordChupei);
  var openCash = frontData.getRange("K2").getValue();
  var closeCash = frontData.getRange("L2").getValue();
  var todayCash = frontData.getRange("S4").getValue();
  var closeTransfer = frontData.getRange("M2").getValue();
  var todayTransfer = frontData.getRange("Q4").getValue();
  var closeCredit = frontData.getRange("N2").getValue();
  var todayCredit = frontData.getRange("R4").getValue();
  var cloaseRevenue = frontData.getRange("L4").getValue();


  // 檢查現金 (略... 保持不變)
  if (typeof openCash !== 'number' || isNaN(openCash) || openCash === null ||
      typeof closeCash !== 'number' || isNaN(closeCash) || closeCash === null ||
      typeof todayCash !== 'number' || isNaN(todayCash) || todayCash === null) {
    showErrorMessage('開盤金額、閉店金額和當日金額必須為有效數字。');
    return;
  }
  if (closeCash - openCash !== todayCash) {
    showErrorMessage('結帳現金與關櫃現金不匹配。');
    return;
  }
  // 檢查轉帳 (略... 保持不變)
  if (closeTransfer !== todayTransfer) {
    showErrorMessage('結帳金額的關櫃轉帳金額不匹配。');
    return;
  }
  //檢查信用卡 (略... 保持不變)
  if (closeCredit !== todayCredit) {
    showErrorMessage('結帳信用卡金額與關櫃信用卡金額不匹配。');
    return;
  }
  if (closeCredit + closeTransfer + closeCash - openCash !== cloaseRevenue) {
    showErrorMessage('關櫃金額與今日營業額不同，請確認是否多收或是少收。');
    return;
  }

  // 變數設定與第一階段資料處理 (略... 保持不變)
  var deleteIndex = 22;
  var idIndex = 0;
  var prizeIdIndex = 7;
  var pickMethodIndex= 4;
  var lotteryNumberIndex = 1;
  var lotteryPrizeNameIndex = 8;
  const pickMethodTake = "帶走";
  const pickMethodPoint = "點數";
  var lotteryTakeoutItem = [];
  var lotteryPointItem = [];
  var pointToItem = [];
  
  for (var i = 0; i < saleItems.length; i++) {
    var id = saleItems[i][idIndex]; 
    var deleted = saleItems[i][deleteIndex]; 
    console.log(id+"-"+deleted);

    if (deleted === "Y") {
      continue;
    }
    var lotteryNumber = saleItems[i][lotteryNumberIndex];
    var prizeId = saleItems[i][prizeIdIndex];
    var lotteryPrizeName = saleItems[i][lotteryPrizeNameIndex];
    var pickMethod = saleItems[i][pickMethodIndex];
    
    if (lotteryNumber !== "") {
      if (prizeId !== "") {
        if (pickMethod === pickMethodTake) {
          lotteryTakeoutItem.push(lotteryPrizeName);
          console.log(lotteryTakeoutItem+"-"+lotteryPrizeName);
          
        } else if (pickMethod === pickMethodPoint) {
          lotteryPointItem.push(lotteryPrizeName)
          console.log(lotteryPointItem+"-"+lotteryPrizeName);
        }
      }
    } else {
      var itemId = saleItems[i][2];
      if (pickMethod === pickMethodPoint && itemId !== "" && itemId < 100000) {
        pointToItem.push(lotteryPrizeName);
          console.log(pointToItem+"-"+lotteryPrizeName);
      }
    }
  }
  
  // 訊息建構 (保持不變)
  var message = "抽中GK帶走:\n";
  message += lotteryTakeoutItem.join("\n");
  message += "\n\n抽中GK換成點數:\n";
  message += lotteryPointItem.join("\n");
  message += "\n\n點數換GK:\n";
  message += pointToItem.join("\n");
  message += "\n\n正確請複製資訊貼到群組，並按  確定:\n錯誤請按 取消，修改後再關帳";
  

  var result = SpreadsheetApp.getUi().alert("關帳出貨資訊",message,SpreadsheetApp.getUi().ButtonSet.OK_CANCEL);
  
  if(result === SpreadsheetApp.getUi().Button.OK) {
    
    // === 核心修改：導入 LockService，只鎖定最關鍵的寫入操作 ===
    var lock = LockService.getDocumentLock();
    // 嘗試在 30 秒 (30000 毫秒) 內取得鎖定
    if (lock.tryLock(30000)) { 
      try {
        // 🔑 鎖定區塊開始：只有一個腳本能進入
        
        // 複製當日結帳紀錄
        for (var i = 0; i < saleItems.length; i++) {
          var id = saleItems[i][idIndex]; 
          var deleted = saleItems[i][deleteIndex]; 
          console.log(id+"-"+deleted);
          if (deleted !== "Y") {
            // 將未刪除的行複製到新的銷售紀錄sheetSalesRecord
            saleItems[i].push("竹北");
            destSheet.appendRow(saleItems[i]); // <--- 關鍵寫入
          }
        }

        //備份資料
        //dailyTodaySaleRecordBackupChupei();
        
        // 清空当天销售记录
        sourceSheet.getRange("A6:X" + lastRow).clear(); // <--- 關鍵清空
        frontData.getRange("K2:N2").clearContent();     // <--- 關鍵清空
        
        SpreadsheetApp.getActive().toast("關帳完畢");
        
        // 🔑 鎖定區塊結束
      } catch (e) {
        // 捕獲在鎖定區塊內發生的錯誤
        SpreadsheetApp.getActive().toast("關帳失敗，寫入錯誤: " + e.message);
        console.error("關帳寫入錯誤: ", e);
      } finally {
        // 無論成功或失敗，務必釋放鎖定，避免其他腳本被永久阻塞
        lock.releaseLock();
      }
    } else {
      // 未能在 30 秒內取得鎖定，表示系統正忙
      SpreadsheetApp.getActive().toast("系統繁忙，無法取得檔案鎖定，請稍後再試！");
      return; 
    }
    // === LockService 區塊結束 ===

  } else if (result === SpreadsheetApp.getUi().Button.CANCEL) {
    SpreadsheetApp.getActive().toast("關帳失敗，請修改本日銷貨資訊");
    return;
  }
}
