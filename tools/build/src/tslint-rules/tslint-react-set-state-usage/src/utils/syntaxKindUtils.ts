/*---------------------------------------------------------------------------------------------
* This code has been adapted from
* [tslint-react-set-state-usage](https://github.com/sutrkiller/tslint-react-set-state-usage).
*--------------------------------------------------------------------------------------------*/

import * as ts from "typescript";

export const isThisKeyword = (expression: ts.Expression) => expression.kind === ts.SyntaxKind.ThisKeyword;
