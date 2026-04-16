"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildEvent = buildEvent;
exports.buildHeader = buildHeader;
var _defaults = require("../defaults");
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function removeUndefined(input) {
  return Object.entries(input).reduce(function (clean, entry) {
    return typeof entry[1] !== 'undefined' ? Object.assign(clean, _defineProperty({}, entry[0], entry[1])) : clean;
  }, {});
}
function buildHeader() {
  var attributes = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  // fill in default values where necessary
  var output = Object.assign({}, (0, _defaults.headerDefaults)(), attributes);
  return removeUndefined(output);
}
function buildEvent() {
  var attributes = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  // fill in default values where necessary
  var output = Object.assign({}, (0, _defaults.eventDefaults)(), attributes);
  return removeUndefined(output);
}