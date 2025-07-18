/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ElementGeometry, GeometryParams, TextBlock, TextStyleSettings } from "@itwin/core-common";
import { AnyCurvePrimitive, Range2d } from "@itwin/core-geometry";
import { ComputeRangesForTextLayoutArgs, FindFontId, FindTextStyle, layoutTextBlock, TextBlockLayout, TextLayoutRanges } from "../core-backend";


export function computeTextRangeAsStringLength(args: ComputeRangesForTextLayoutArgs): TextLayoutRanges {
  const range = new Range2d(0, 0, args.chars.length, args.lineHeight);
  return { layout: range, justification: range };
}

export function doLayout(textBlock: TextBlock, args?: {
  findTextStyle?: FindTextStyle;
  findFontId?: FindFontId;
}): TextBlockLayout {
  const layout = layoutTextBlock({
    textBlock,
    iModel: {} as any,
    findTextStyle: args?.findTextStyle ?? (() => TextStyleSettings.defaults),
    findFontId: args?.findFontId ?? (() => 0),
    computeTextRange: computeTextRangeAsStringLength,
  });

  return layout;
}

// Extending this because the ElementGeometry.Builder.entries attribute is hard to parse
export class MockBuilder extends ElementGeometry.Builder {
  public params: GeometryParams[] = [];
  public geometries: AnyCurvePrimitive[] = [];
  public override appendGeometryParamsChange(params: GeometryParams): boolean {
    this.params.push(params.clone());
    return super.appendGeometryParamsChange(params);
  }
  public override appendGeometryQuery(geometry: AnyCurvePrimitive): boolean {
    this.geometries.push(geometry);
    return super.appendGeometryQuery(geometry);
  }
}