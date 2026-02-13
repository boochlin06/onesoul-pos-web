function 結帳() {
  var sourceSheet = SpreadsheetApp.openById(appChupei).getSheetByName(sheetCheckout);
  var lotteryItems = sourceSheet.getRange("A6:L30").getValues(); 
  var sellItems = sourceSheet.getRange("A32:L40").getValues();
  // 获取当前时间并设置为台湾时区
  var currentDate = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd");
  var phoneNumbers = sourceSheet.getRange("B2").getValue();
  var memberName = sourceSheet.getRange("A2").getValue();
  var memberPoint = sourceSheet.getRange("E2").getValue();
  var costToPayPoint = sourceSheet.getRange("L2").getValue();
  var totalCheckPoint = sourceSheet.getRange("J4").getValue();
  var totalCheckMoney = sourceSheet.getRange("K4").getValue();
  var totalPayMoney = sourceSheet.getRange("H2").getValue();
  var saleMethodValues = sourceSheet.getRange("H2:M2").getValues();

  var targetData = [];
  var checkoutUID = phoneNumbers+"_"+currentDate+"_"+Math.floor(Math.random() * 1000000);;
  
  // 检查客户数据是否有效
  // showErrorMessage(phoneNumbers+"-3213"+memberName);
  if (phoneNumbers =='' || memberName == '錯誤') {
    showErrorMessage('客戶資料有錯-'+phoneNumbers);
    return;
  }

  if (totalCheckMoney != totalPayMoney) {
    showErrorMessage('結帳金額跟應付金額不符合');
    return;
  }
  
  // 处理彩票项目
  for (var i = 0; i < lotteryItems.length; i++) {
    var awardname = lotteryItems[i][4]; // 套名稱

    // 检查是否为有效的奖项信息
    if (awardname =='錯誤' || (lotteryItems[i][3] ==='' && awardname != '')) {
      showErrorMessage('結帳資料有誤: 第 ' + (i + 6) + ' 行');
      return;
    }
    
    // 将数据推入目标数组中
    if (awardname != '' ) {
      targetData.push([phoneNumbers].concat(lotteryItems[i]).concat([currentDate,checkoutUID]));
    }
  }
  
  // 处理销售项目
  for (var i = 0; i < sellItems.length; i++) {
    var name = sellItems[i][7]; // 商品名稱

    // 检查是否为有效的商品信息
    if (name =='錯誤' || (sellItems[i][3] ==='' && name != '')) {
      showErrorMessage('結帳資料有誤: 第 ' + (i + 32) + ' 行');
      return;
    }
    
    // 将数据推入目标数组中
    if (name != '' ) {
      targetData.push([phoneNumbers].concat(sellItems[i]).concat([currentDate,checkoutUID]));
    }
  }

  var success = false;
  var newPoints = 0;
  try {
    // 检查客户点数是否足够
    if (memberPoint + totalCheckPoint - costToPayPoint < 0) {
      showErrorMessage('客戶點數不足');
      return;
    } else {
      console.log("updateMemberPointsByPhone");
      newPoints = updateMemberPointsByPhone(phoneNumbers, memberPoint + totalCheckPoint-costToPayPoint);
      if (newPoints == memberPoint + totalCheckPoint-costToPayPoint) {
        success = true
      } else {
        showErrorMessage(phoneNumbers + '-結帳失敗');
        return;
      }
    }
  } catch (error) {
    showErrorMessage('发生异常: ' + error.toString());
    return;
  }
  
  // 将目标数组数据写入銷售紀錄的末尾
  var tempApp = SpreadsheetApp.openById(appBackground);
  var tempTodaySalesSheet = tempApp.getSheetByName(sheetTodaySalesRecordChupei);
  
try {
    var lastRow = tempTodaySalesSheet.getLastRow();
    var newData = targetData.map(function(row, index) {
      return index === 0 ? row.concat(saleMethodValues[0]).concat(totalCheckPoint-costToPayPoint) : row.concat(["","","","","","",""]);
    });
    tempTodaySalesSheet.getRange(lastRow + 1, 1, newData.length, newData[0].length).setValues(newData);
    tempTodaySalesSheet.getRange(lastRow + 1, 1, newData.length, newData[0].length).setBorder(true, false, true, false, false, false);

    // var saleMethod = [];
    //id	電話	實收金額	匯款	信用卡	現金	點數	備註	日期	點數異動
    // saleMethod.push([checkoutUID,phoneNumbers].concat(saleMethodValues[0]).concat(currentDate).concat(totalCheckPoint-costToPayPoint));
    //updateSaleMehod(saleMethod);
  } catch(error) {
    console.error(error);
    showErrorMessage('写入数据时发生异常');
  }



  // 重置页面数据
  resetAll(sourceSheet);
  
  // 显示结算成功消息
  if (success) {
    Browser.msgBox(phoneNumbers+"-"+memberName + '-結帳成功:' + newPoints);
  }

}

function updateMemberPointsByPhone(phoneNumber, newPoints) {

  var tempApp = SpreadsheetApp.openById(appBackground);
  var memberSheet = tempApp.getSheetByName(sheetMemberList);
  var data = memberSheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) { // 从第二行开始遍历，因为第一行是标题
    if (data[i][2] == phoneNumber) { // 手机号码在第三列（索引为2）
      memberSheet.getRange("G" + (i + 1)).setValue(newPoints); // 更新会员点数信息，F 列是点数所在列
      return newPoints; // 返回更新成功的消息
    }
  }
  
  return -1; // 如果未找到匹配的会员信息，返回消息

}

function addMemberPointsByPhone(phoneNumber, pointsToAdd) {
  var tempApp = SpreadsheetApp.openById(appBackground);
  var memberSheet = tempApp.getSheetByName(sheetMemberList);
  var data = memberSheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) { // 从第二行开始遍历，因为第一行是标题
    if (data[i][2] == phoneNumber) { // 手机号码在第三列（索引为2）
      var currentPoints = data[i][6]; // 第7列（索引为6）是当前会员点数
      var newPoints = currentPoints + pointsToAdd;
      memberSheet.getRange("G" + (i + 1)).setValue(newPoints); // 更新会员点数信息，F 列是点数所在列
      return newPoints; // 返回更新后的会员点数
    }
  }
  
  return -1; // 如果未找到匹配的会员信息，返回消息
}

function showErrorMessage(message) {
  Browser.msgBox(message);
}

function resetPage(sheet) {
  var lotteryItemsClear = sheet.getRange("A6:D30");
  var sellItemsClear = sheet.getRange("B32:E40");
  lotteryItemsClear.clearContent(); // 仅清除内容
  sellItemsClear.clearContent(); // 仅清除内容
  sheet.getRange("D6:D30").setValue('點數');
  sheet.getRange("D32:D40").setValue('點數');
  console.log("resetPage");
  sheet.getRange("I2:M2").clearContent();
  sheet.getRange("B1").clearContent();
  for (var i = 0; i < 25; i++) {
    var row = i + 6;
    var product ="=C" +row +"*"+ "F" + row;
    var point = "=IF(D"+row+"=\"帶走\",0,I"+row+"*C"+row+")";
    console.log(point);
    sheet.getRange("K" + row).setValue(product);
    sheet.getRange("J" + row).setValue(point);
  }
}

function resetChupei() {
  resetAll(SpreadsheetApp.openById(appChupei).getSheetByName(sheetCheckout));
}

function resetAll (sheet) {
  var lotteryItemsClear = sheet.getRange("A6:D30");
  var sellItemsClear = sheet.getRange("B32:E40");
  lotteryItemsClear.clearContent(); // 仅清除内容
  sellItemsClear.clearContent(); // 仅清除内容
  sheet.getRange("D6:D30").setValue('點數');
  sheet.getRange("D32:D40").setValue('點數');
  console.log("resetPage");
  sheet.getRange("I2:M2").clearContent();
  sheet.getRange("B1").clearContent();
  for (var i = 0; i < 25; i++) {
    var row = i + 6;
    var product ="=C" +row +"*"+ "F" + row;
    var point = "=IF(D"+row+"=\"帶走\",0,I"+row+"*C"+row+")";
    console.log(point);
    sheet.getRange("K" + row).setValue(product);
    sheet.getRange("J" + row).setValue(point);

    // 添加你提供的数值运算
    var formula = "=IF(AND(ISBLANK(A" + row + "), ISBLANK(B" + row + "), ISBLANK(C" + row + ")), \"\", IF(ISBLANK(C" + row + "), \"錯誤\", IFERROR(QUERY(lotteryDatabase, \"SELECT Col2,Col3, Col5 ,Col6,Col7 WHERE LOWER(Col4) = '\" & LOWER(B" + row + ") & \"' AND Col1 = \" & A" + row + " & \" ORDER BY Col1 DESC LIMIT 1\"), \"錯誤\")))";
    sheet.getRange("E" + row).setFormula(formula);
  }
  for (var i = 0; i < 9; i++) {
    var row = i + 32;
    var formula2 = "=IF(AND(ISBLANK(B" + row + "), ISBLANK(C" + row + ")), \"\", IF(ISBLANK(C" + row + "), \"錯誤\", IFERROR(QUERY({'貨品資料庫'!A2:L500;'盲盒資料庫'!A2:L500}, \"SELECT Col2,Col5 WHERE Col1 = \" & B" + row + " & \" ORDER BY Col1 DESC LIMIT 1\"), \"錯誤\")))";
    sheet.getRange("H" + row).setFormula(formula2);
  }
  for (var i = 0; i < 9; i++) {
    var row = i + 32;
    var formula3 = "=IF(AND(ISBLANK(B" + row + "), ISBLANK(C" + row + ")), \"\", IF(ISBLANK(C" + row + "), \"錯誤\", IF(B" + row + " < 100000, 0, IFERROR(QUERY({'貨品資料庫'!A$2:L500; '盲盒資料庫'!A$2:L500}, \"SELECT Col3 WHERE Col1 = \" & B" + row + " & \" ORDER BY Col1 DESC LIMIT 1\"), \"錯誤\"))))";
    sheet.getRange("F" + row).setFormula(formula3);
  }
  SpreadsheetApp.flush();
}