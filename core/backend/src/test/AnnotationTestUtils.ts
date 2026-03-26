/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ElementGeometry, GeometryParams, TextBlock, TextString, TextStyleSettings } from "@itwin/core-common";
import { AnyCurvePrimitive, Range2d } from "@itwin/core-geometry";
import { ComputeRangesForTextLayoutArgs, FindFontId, FindTextStyle, layoutTextBlock, TextBlockLayout, TextLayoutRanges, TextStyleResolver } from "../core-backend";
import { Id64String } from "@itwin/core-bentley";


export function computeTextRangeAsStringLength(args: ComputeRangesForTextLayoutArgs): TextLayoutRanges {
  const range = new Range2d(0, 0, args.chars.length, args.textHeight);
  return { layout: range, justification: range };
}

export function doLayout(textBlock: TextBlock, args?: {
  textStyleId?: Id64String,
  findTextStyle?: FindTextStyle;
  findFontId?: FindFontId;
}): TextBlockLayout {
  const textStyleResolver = new TextStyleResolver({
    textBlock,
    textStyleId: args?.textStyleId ?? "",
    iModel: {} as any,
    findTextStyle: args?.findTextStyle ?? (() => TextStyleSettings.defaults)
  });
  const layout = layoutTextBlock({
    textBlock,
    iModel: {} as any,
    textStyleResolver,
    findFontId: args?.findFontId ?? (() => 0),
    computeTextRange: computeTextRangeAsStringLength,
  });

  return layout;
}

// Extending this because the ElementGeometry.Builder.entries attribute is hard to parse
export class MockBuilder extends ElementGeometry.Builder {
  public params: GeometryParams[] = [];
  public geometries: AnyCurvePrimitive[] = [];
  public textStrings: TextString[] = []

  public override appendGeometryParamsChange(params: GeometryParams): boolean {
    this.params.push(params.clone());
    return super.appendGeometryParamsChange(params);
  }
  public override appendGeometryQuery(geometry: AnyCurvePrimitive): boolean {
    this.geometries.push(geometry);
    return super.appendGeometryQuery(geometry);
  }

  public override appendTextString(text: TextString): boolean {
    this.textStrings.push(text);
    return super.appendTextString(text);
  }

}