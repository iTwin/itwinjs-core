/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
exports['OptionalDependenciesPlugin should work without optional dependencies 1'] = `
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

const foo = __webpack_require__(2);

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

const bar = __webpack_require__(3);

/***/ }),
/* 3 */
/***/ (function(module, exports) {

console.log("This is bar");

/***/ })
],[[0,1]]]);
`

exports['OptionalDependenciesPlugin should ignore optional dependency in try/catch 1'] = `
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

const foo = __webpack_require__(2);

/***/ }),
/* 2 */
/***/ (function(module, exports) {

try {const bar = require("./bar");} catch {}

/***/ })
],[[0,1]]]);
`

exports['OptionalDependenciesPlugin should ignore critical dependency 1'] = `
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

const foo = __webpack_require__(2);

/***/ }),
/* 2 */
/***/ (function(module, exports) {

const pathBar = "./bar";const bar = require(pathBar);

/***/ })
],[[0,1]]]);
`

exports['OptionalDependenciesPlugin should ignore non-call use of require 1'] = `
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],[
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

const foo = __webpack_require__(2);

/***/ }),
/* 2 */
/***/ (function(module, exports) {

const optional = true;let req = (optional) ? require : console.log;const bar = req("./bar");

/***/ })
],[[0,1]]]);
`
