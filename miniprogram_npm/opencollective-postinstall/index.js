module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {}, _tempexports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = __MODS__[modId].m; m._exports = m._tempexports; var desp = Object.getOwnPropertyDescriptor(m, "exports"); if (desp && desp.configurable) Object.defineProperty(m, "exports", { set: function (val) { if(typeof val === "object" && val !== m._exports) { m._exports.__proto__ = val.__proto__; Object.keys(val).forEach(function (k) { m._exports[k] = val[k]; }); } m._tempexports = val }, get: function () { return m._tempexports; } }); __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1739447920947, function(require, module, exports) {


function isTrue(value) {
  return !!value && value !== "0" && value !== "false"
}

var envDisable = isTrue(process.env.DISABLE_OPENCOLLECTIVE) || isTrue(process.env.OPEN_SOURCE_CONTRIBUTOR) || isTrue(process.env.CI);
var logLevel = process.env.npm_config_loglevel;
var logLevelDisplay = ['silent', 'error', 'warn'].indexOf(logLevel) > -1;

if (!envDisable && !logLevelDisplay) {
  var pkg = require(require('path').resolve('./package.json'));
  if (pkg.collective) {
    console.log(`\u001b[96m\u001b[1mThank you for using ${pkg.name}!\u001b[96m\u001b[1m`);
    console.log(`\u001b[0m\u001b[96mIf you rely on this package, please consider supporting our open collective:\u001b[22m\u001b[39m`);
    console.log(`> \u001b[94m${pkg.collective.url}/donate\u001b[0m\n`);
  }
}

}, function(modId) {var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1739447920947);
})()
//miniprogram-npm-outsideDeps=["path"]
//# sourceMappingURL=index.js.map