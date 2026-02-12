var SCRIPT_PROP = PropertiesService.getScriptProperties();
//------------------------------------- 3. 全域變數
var global = get_global();
//------------------------------------- 4. 選單
var menu = render('menu', {});
var Route ={};
Route.path = function(route, callback) {
  Route[route] = callback;
}

/*=====================================
  取得全域變數
=====================================*/
function get_global() {
  // 從指令碼屬性 取得 global
  global = SCRIPT_PROP.getProperty('global') ? JSON.parse(SCRIPT_PROP.getProperty('global')) : {};
  // 網頁應用程式網址
  global['url'] = ScriptApp.getService().getUrl();
  global['webTitle'] = '玩獸'

  return global;
}

function doGet(e) {

  Route.path("stocklist",stocklist);
  Route.path("about",about);
  if (Route[e.parameter.op]) {
    return Route[e.parameter.op](e);
  } else {
    return index(e);
  }
}

