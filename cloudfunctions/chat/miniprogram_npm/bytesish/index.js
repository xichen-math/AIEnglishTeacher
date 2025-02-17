module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {}, _tempexports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = __MODS__[modId].m; m._exports = m._tempexports; var desp = Object.getOwnPropertyDescriptor(m, "exports"); if (desp && desp.configurable) Object.defineProperty(m, "exports", { set: function (val) { if(typeof val === "object" && val !== m._exports) { m._exports.__proto__ = val.__proto__; Object.keys(val).forEach(function (k) { m._exports[k] = val[k]; }); } m._tempexports = val }, get: function () { return m._tempexports; } }); __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1739447920251, function(require, module, exports) {

const crypto = require('crypto')
const fallback = require('./browser').from
const bytes = require('./core')

bytes.from = (_from, encoding) => {
  if (_from instanceof DataView) return _from
  if (_from instanceof ArrayBuffer) return new DataView(_from)
  if (typeof _from === 'string') {
    _from = Buffer.from(_from, encoding)
  }
  if (Buffer.isBuffer(_from)) {
    return new DataView(_from.buffer, _from.byteOffset, _from.byteLength)
  }
  return fallback(_from, encoding)
}
bytes.toString = (_from, encoding) => {
  _from = bytes(_from)
  return Buffer.from(_from.buffer, _from.byteOffset, _from.byteLength).toString(encoding)
}

bytes.native = (_from, encoding) => {
  if (Buffer.isBuffer(_from)) return _from
  _from = bytes(_from, encoding)
  return Buffer.from(_from.buffer, _from.byteOffset, _from.byteLength)
}

bytes._randomFill = crypto.randomFillSync

module.exports = bytes

}, function(modId) {var map = {"./browser":1739447920252,"./core":1739447920253}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1739447920252, function(require, module, exports) {
/* globals atob, btoa, crypto */
/* istanbul ignore file */

const bytes = require('./core')

bytes.from = (_from, _encoding) => {
  if (_from instanceof DataView) return _from
  if (_from instanceof ArrayBuffer) return new DataView(_from)
  let buffer
  if (typeof _from === 'string') {
    if (!_encoding) {
      _encoding = 'utf-8'
    } else if (_encoding === 'base64') {
      buffer = Uint8Array.from(atob(_from), c => c.charCodeAt(0)).buffer
      return new DataView(buffer)
    }
    if (_encoding !== 'utf-8') throw new Error('Browser support for encodings other than utf-8 not implemented')
    return new DataView((new TextEncoder()).encode(_from).buffer)
  } else if (typeof _from === 'object') {
    if (ArrayBuffer.isView(_from)) {
      if (_from.byteLength === _from.buffer.byteLength) return new DataView(_from.buffer)
      else return new DataView(_from.buffer, _from.byteOffset, _from.byteLength)
    }
  }
  throw new Error('Unkown type. Cannot convert to ArrayBuffer')
}

bytes.toString = (_from, encoding) => {
  _from = bytes(_from, encoding)
  const uint = new Uint8Array(_from.buffer, _from.byteOffset, _from.byteLength)
  const str = String.fromCharCode(...uint)
  if (encoding === 'base64') {
    /* would be nice to find a way to do this directly from a buffer
     * instead of doing two string conversions
     */
    return btoa(str)
  } else {
    return str
  }
}

bytes.native = (_from, encoding) => {
  if (_from instanceof Uint8Array) return _from
  _from = bytes.from(_from, encoding)
  return new Uint8Array(_from.buffer, _from.byteOffset, _from.byteLength)
}

if (process.browser) bytes._randomFill = (...args) => crypto.getRandomValues(...args)

module.exports = bytes

}, function(modId) { var map = {"./core":1739447920253}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1739447920253, function(require, module, exports) {


const length = (a, b) => {
  if (a.byteLength === b.byteLength) return a.byteLength
  else if (a.byteLength > b.byteLength) return a.byteLength
  return b.byteLength
}

const bytes = (_from, encoding) => bytes.from(_from, encoding)

bytes.sorter = (a, b) => {
  a = bytes(a)
  b = bytes(b)
  const len = length(a, b)
  let i = 0
  while (i < (len - 1)) {
    if (i >= a.byteLength) return 1
    else if (i >= b.byteLength) return -1

    if (a.getUint8(i) < b.getUint8(i)) return -1
    else if (a.getUint8(i) > b.getUint8(i)) return 1
    i++
  }
  return 0
}

bytes.compare = (a, b) => !bytes.sorter(a, b)
bytes.memcopy = (_from, encoding) => {
  const b = bytes(_from, encoding)
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
}
bytes.arrayBuffer = (_from, encoding) => {
  _from = bytes(_from, encoding)
  if (_from.buffer.byteLength === _from.byteLength) return _from.buffer
  return _from.buffer.slice(_from.byteOffset, _from.byteOffset + _from.byteLength)
}
const sliceOptions = (_from, start = 0, end = null) => {
  _from = bytes(_from)
  end = (end === null ? _from.byteLength : end) - start
  return [_from.buffer, _from.byteOffset + start, end]
}
bytes.slice = (_from, start, end) => new DataView(...sliceOptions(_from, start, end))

bytes.memcopySlice = (_from, start, end) => {
  const [buffer, offset, length] = sliceOptions(_from, start, end)
  return buffer.slice(offset, length + offset)
}
bytes.typedArray = (_from, _Class = Uint8Array) => {
  _from = bytes(_from)
  return new _Class(_from.buffer, _from.byteOffset, _from.byteLength / _Class.BYTES_PER_ELEMENT)
}

bytes.concat = (_from) => {
  _from = Array.from(_from)
  _from = _from.map(b => bytes(b))
  const length = _from.reduce((x, y) => x + y.byteLength, 0)
  const ret = new Uint8Array(length)
  let i = 0
  for (const part of _from) {
    const view = bytes.typedArray(part)
    ret.set(view, i)
    i += view.byteLength
  }
  return ret.buffer
}

const maxEntropy = 65536

bytes.random = length => {
  const ab = new ArrayBuffer(length)
  if (length > maxEntropy) {
    let i = 0
    while (i < ab.byteLength) {
      let len
      if (i + maxEntropy > ab.byteLength) len = ab.byteLength - i
      else len = maxEntropy
      const view = new Uint8Array(ab, i, len)
      i += maxEntropy
      bytes._randomFill(view)
    }
  } else {
    const view = new Uint8Array(ab)
    bytes._randomFill(view)
  }
  return ab
}

module.exports = bytes

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1739447920251);
})()
//miniprogram-npm-outsideDeps=["crypto"]
//# sourceMappingURL=index.js.map