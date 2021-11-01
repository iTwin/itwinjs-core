"use strict";
/*---------------------------------------------------------------------------------------------
* This code has been adapted from
* [tslint-react-set-state-usage](https://github.com/sutrkiller/tslint-react-set-state-usage).
*--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.isThisKeyword = void 0;
const ts = require("typescript");
const isThisKeyword = (expression) => expression.kind === ts.SyntaxKind.ThisKeyword;
exports.isThisKeyword = isThisKeyword;
