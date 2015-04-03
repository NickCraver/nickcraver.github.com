(function(c){
  if(!('hidden' in c('a'))) {
    'header nav section article aside footer hgroup'.replace(/\w+/g,function(e) { c(e); });
  }
})(document.createElement);