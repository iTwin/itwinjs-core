/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { LowAndHighXY, XAndY } from "@itwin/core-geometry";
import { FontId } from "../Fonts";

export interface RunLayoutResult {
  sourceRunIndex: number;
  fontId: FontId;
  characterOffset: number;
  characterCount: number;
  range: LowAndHighXY;
  justificationRange?: LowAndHighXY;
  numeratorRange?: LowAndHighXY;
  denominatorRange?: LowAndHighXY;
  offsetFromLine: XAndY;
}

export interface LineLayoutResult {
  sourceParagraphIndex: number;
  runs: RunLayoutResult[];
  range: LowAndHighXY;
  justificationRange: LowAndHighXY;
  offsetFromDocument: XAndY;
}

export interface TextBlockLayoutResult {
  lines: LineLayoutResult[]
  range: LowAndHighXY;
}
