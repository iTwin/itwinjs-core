/*---------------------------------------------------------------------------------------------
* This code has been adapted from
* [tslint-react-set-state-usage](https://github.com/sutrkiller/tslint-react-set-state-usage).
*--------------------------------------------------------------------------------------------*/

import * as ts from "typescript";
import {
  isCallExpression,
  isPropertyAccessExpression,
  isParenthesizedExpression,
} from "tsutils";

import { isThisKeyword } from "./syntaxKindUtils";

export const isThisPropertyAccess = (node: ts.Node): node is ts.PropertyAccessExpression =>
  isPropertyAccessExpression(node) && isThisKeyword(node.expression);

export const isThisSetState = (node: ts.Node): node is ts.CallExpression =>
  isCallExpression(node)
  && isPropertyAccessExpression(node.expression)
  && isThisKeyword(node.expression.expression)
  && node.expression.name.text === "setState";

export function getFirstSetStateAncestor(node: ts.Node): ts.CallExpression | null {
  if (node.kind === ts.SyntaxKind.SourceFile) {
    return null;
  }

  if (isThisSetState(node)) {
    return node as ts.CallExpression;
  }

  return getFirstSetStateAncestor(node.parent);
}

export const removeParentheses = (node: ts.Node): ts.Node => isParenthesizedExpression(node)
  ? removeParentheses(node.expression)
  : node;
