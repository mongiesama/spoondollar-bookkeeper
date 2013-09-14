var pageMod = require("sdk/page-mod");
var data = require("sdk/self").data;

pageMod.PageMod({
  include: "*.spoonflower.com", 
  contentScriptFile: [data.url("jquery-1.10.2.js"), data.url("jquery.sortElements.js"), data.url("bookkeeper.js")]
});
