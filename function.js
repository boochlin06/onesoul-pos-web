
/*========================================
  渲染網頁
=========================================*/
function render(file, argsObject, title='') {
  let tmp = HtmlService.createTemplateFromFile(file);
  for(let i in argsObject){
    tmp[i] = argsObject[i];
  }
  if(title){//主樣版
    return tmp.evaluate().setTitle(title).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }else{//子樣版
    return tmp.evaluate().getContent();
  }  
}
