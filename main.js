var Route ={};
Route.path = function(route, callback) {
  Route[route] = callback;
}

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
