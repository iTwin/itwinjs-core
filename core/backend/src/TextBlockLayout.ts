/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ###TODO
 */

import { BaselineShift, FontId, TextBlock, TextBlockLayoutResult, TextStyleSettings } from "@itwin/core-common";
import { Range2d } from "@itwin/core-geometry";
import { IModelDb } from "./IModelDb";

/** @internal */
export type ComputeRangeForTextLayout = (args: {
  chars: string,
  settings: TextStyleSettings,
  baselineShift: BaselineShift,
  fontId: FontId,
}) => Range2d;

/** @internal */
export type FindTextStyle = (name: string) => TextStyleSettings;

export interface LayoutTextBlockArgs {
  textBlock:TextBlock;
  iModel:IModelDb;
  /** @internal chiefly for tests */
  computeRangeForText?: ComputeRangeForTextLayout;
  /** @internal chiefly for tests */
  findTextStyle?: FindTextStyle;
}

export function layoutTextBlock(args: LayoutTextBlockArgs): TextBlockLayoutResult {
  if (undefined === args.computeRangeForText || undefined === args.findTextStyle) {
    throw new Error("###TODO use default implementations");
  }

  return doLayoutTextBlock(args.textBlock, args.computeRangeForText, args.findTextStyle);
}

function doLayoutTextBlock(block: TextBlock, computeTextRange: ComputeRangeForTextLayout, findStyle: FindTextStyle): TextBlockLayoutResult {

  // ###TODO
  return { lines: [], range: { } as any };
}
