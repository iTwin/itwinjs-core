/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Range2dProps, XAndY } from "@itwin/core-geometry";
import { FontId } from "../Fonts";

export interface RunLayoutResult {
  sourceRunIndex: number;
  fontId: FontId;
  characterOffset: number;
  characterCount: number;
  range: Range2dProps;
  justificationRange?: Range2dProps;
  numeratorRange?: Range2dProps;
  denominatorRange?: Range2dProps;
  offsetFromLine: XAndY;
}

export interface LineLayoutResult {
  sourceParagraphIndex: number;
  runs: RunLayoutResult[];
  range: Range2dProps;
  justificationRange: Range2dProps;
  offsetFromDocument: XAndY;
}

export interface TextBlockLayoutResult {
  lines: LineLayoutResult[]
  range: Range2dProps;
}
