"use strict";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
* This code has been adapted from
* [tslint-react-set-state-usage](https://github.com/sutrkiller/tslint-react-set-state-usage).
*--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeParentheses = exports.getFirstSetStateAncestor = exports.isThisSetState = exports.isThisPropertyAccess = void 0;
const ts = require("typescript");
const tsutils_1 = require("tsutils");
const syntaxKindUtils_1 = require("./syntaxKindUtils");
const isThisPropertyAccess = (node) => tsutils_1.isPropertyAccessExpression(node) && syntaxKindUtils_1.isThisKeyword(node.expression);
exports.isThisPropertyAccess = isThisPropertyAccess;
const isThisSetState = (node) => tsutils_1.isCallExpression(node)
    && tsutils_1.isPropertyAccessExpression(node.expression)
    && syntaxKindUtils_1.isThisKeyword(node.expression.expression)
    && node.expression.name.text === "setState";
exports.isThisSetState = isThisSetState;
function getFirstSetStateAncestor(node) {
    if (node.kind === ts.SyntaxKind.SourceFile) {
        return null;
    }
    if (exports.isThisSetState(node)) {
        return node;
    }
    return getFirstSetStateAncestor(node.parent);
}
exports.getFirstSetStateAncestor = getFirstSetStateAncestor;
const removeParentheses = (node) => tsutils_1.isParenthesizedExpression(node)
    ? exports.removeParentheses(node.expression)
    : node;
exports.removeParentheses = removeParentheses;
