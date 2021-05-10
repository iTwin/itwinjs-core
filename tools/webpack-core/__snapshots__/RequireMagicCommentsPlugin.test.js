/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
exports['RequireMagicCommentsPlugin should work with external comments with custom handler 1'] = `
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(/*test*/2);

/***/ }),
/* 2 */
/***/ (function(module, exports) {

console.log("Module bar");

/***/ })
],[[0,1]]]);
`

exports['RequireMagicCommentsPlugin should work with external comments and addExternalPrefix handler 1'] = `
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(/*webpack: external*/2);

/***/ }),
/* 2 */
/***/ (function(module, exports) {

module.exports = require("foo");

/***/ })
],[[0,1]]]);
`

exports['RequireMagicCommentsPlugin should work with external comments and resolve not converted 1'] = `
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

/*require.resolve*/(/*test*/2);

/***/ }),
/* 2 */
/***/ (function(module, exports) {

console.log("Module bar");

/***/ })
],[[0,1]]]);
`

exports['RequireMagicCommentsPlugin should work with external comments and resolve converted 1'] = `
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(/*test*/2);

/***/ }),
/* 2 */
/***/ (function(module, exports) {

console.log("Module bar");

/***/ })
],[[0,1]]]);
`

exports['RequireMagicCommentsPlugin should work with external comments with resolve not converted and addExternalPrefix handler 1'] = `
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

/*require.resolve*/(/*webpack: external*/2);

/***/ }),
/* 2 */
/***/ (function(module, exports) {

module.exports = require("foo");

/***/ })
],[[0,1]]]);
`

exports['RequireMagicCommentsPlugin should work with external comments with resolve converted and addExternalPrefix handler 1'] = `
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(/*webpack: external*/2);

/***/ }),
/* 2 */
/***/ (function(module, exports) {

module.exports = require("foo");

/***/ })
],[[0,1]]]);
`

exports['RequireMagicCommentsPlugin should work with copyfile comments and addCopyFileSuffix handler 1'] = [
  "(window[\"webpackJsonp\"] = window[\"webpackJsonp\"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: copyfile*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/* WEBPACK VAR INJECTION */(function(__dirname) {module.exports = __webpack_require__(3).resolve(__dirname, __webpack_require__.p + \"static/bar.91b123.txt\");\n/* WEBPACK VAR INJECTION */}.call(this, \"/\"))\n\n/***/ }),\n"
]

exports['RequireMagicCommentsPlugin should work with copyfile comments, addCopyFileSuffix, and resolve converted 1'] = [
  "(window[\"webpackJsonp\"] = window[\"webpackJsonp\"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n__webpack_require__(/*webpack: copyfile*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/* WEBPACK VAR INJECTION */(function(__dirname) {module.exports = __webpack_require__(3).resolve(__dirname, __webpack_require__.p + \"static/bar.91b123.txt\");\n/* WEBPACK VAR INJECTION */}.call(this, \"/\"))\n\n/***/ }),\n"
]

exports['RequireMagicCommentsPlugin should work with copyfile comments, addCopyFileSuffix, and resolve not converted 1'] = [
  "(window[\"webpackJsonp\"] = window[\"webpackJsonp\"] || []).push([[0],[\n/* 0 */\n/***/ (function(module, exports, __webpack_require__) {\n\nmodule.exports = __webpack_require__(1);\n\n\n/***/ }),\n/* 1 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/*require.resolve*/(/*webpack: copyfile*/2);\n\n/***/ }),\n/* 2 */\n/***/ (function(module, exports, __webpack_require__) {\n\n/* WEBPACK VAR INJECTION */(function(__dirname) {module.exports = __webpack_require__(3).resolve(__dirname, __webpack_require__.p + \"static/bar.91b123.txt\");\n/* WEBPACK VAR INJECTION */}.call(this, \"/\"))\n\n/***/ }),\n"
]
