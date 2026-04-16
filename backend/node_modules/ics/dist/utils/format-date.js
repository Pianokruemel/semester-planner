"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = formatDate;
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
var pad = function pad(n) {
  return n < 10 ? "0".concat(n) : "".concat(n);
};
function formatDate() {
  var args = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var outputType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'utc';
  var inputType = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'local';
  if (typeof args === 'string') {
    return args;
  }
  if (Array.isArray(args) && args.length === 3) {
    var _args = _slicedToArray(args, 3),
      year = _args[0],
      month = _args[1],
      date = _args[2];
    return "".concat(year).concat(pad(month)).concat(pad(date));
  }
  var outDate = new Date();
  if (Array.isArray(args) && args.length > 0 && args[0]) {
    var _args2 = _slicedToArray(args, 6),
      _year = _args2[0],
      _month = _args2[1],
      _date = _args2[2],
      _args2$ = _args2[3],
      hours = _args2$ === void 0 ? 0 : _args2$,
      _args2$2 = _args2[4],
      minutes = _args2$2 === void 0 ? 0 : _args2$2,
      _args2$3 = _args2[5],
      seconds = _args2$3 === void 0 ? 0 : _args2$3;
    if (inputType === 'local') {
      outDate = new Date(_year, _month - 1, _date, hours, minutes, seconds);
    } else {
      outDate = new Date(Date.UTC(_year, _month - 1, _date, hours, minutes, seconds));
    }
  } else if (!Array.isArray(args)) {
    // it's a unix time stamp (ms)
    outDate = new Date(args);
  }
  if (outputType === 'local') {
    return [outDate.getFullYear(), pad(outDate.getMonth() + 1), pad(outDate.getDate()), 'T', pad(outDate.getHours()), pad(outDate.getMinutes()), pad(outDate.getSeconds())].join('');
  }
  return [outDate.getUTCFullYear(), pad(outDate.getUTCMonth() + 1), pad(outDate.getUTCDate()), 'T', pad(outDate.getUTCHours()), pad(outDate.getUTCMinutes()), pad(outDate.getUTCSeconds()), 'Z'].join('');
}