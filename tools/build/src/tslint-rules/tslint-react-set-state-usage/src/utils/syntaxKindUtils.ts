/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as ts from "typescript";

export const isThisKeyword = (expression: ts.Expression) => expression.kind === ts.SyntaxKind.ThisKeyword;
