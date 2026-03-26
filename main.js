/**
 * main.js — doGet 路由入口
 * 處理 Google Apps Script Web App 的 GET 請求
 */

var Route = {};

/**
 * 註冊路由
 * @param {string} route - 路由名稱
 * @param {Function} callback - 處理函數
 */
Route.path = function(route, callback) {
  Route[route] = callback;
}

/**
 * Web App GET 入口 — 根據 ?op= 參數決定要渲染的頁面
 * @param {Object} e - Google Apps Script 事件物件
 * @returns {HtmlOutput} 渲染後的頁面
 */
function doGet(e) {
  var menu = render('menu.html', {});

  Route.path("stocklist", stocklist);
  Route.path("about", about);

  if (Route[e.parameter.op]) {
    return Route[e.parameter.op](e, menu);
  } else {
    return index(e, menu);
  }
}
