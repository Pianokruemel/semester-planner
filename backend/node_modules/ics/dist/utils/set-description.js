"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = setDescription;
var _formatText = _interopRequireDefault(require("./format-text"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function setDescription(description) {
  return (0, _formatText["default"])(description);
}