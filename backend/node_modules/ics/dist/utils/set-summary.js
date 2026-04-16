"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = setSummary;
var _formatText = _interopRequireDefault(require("./format-text"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function setSummary(summary) {
  return (0, _formatText["default"])(summary);
}