/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { ColorDef } from "./ColorDef";
import { LinePixels } from "./LinePixels";
import { Gradient } from "./Gradient";
import { RenderMaterial } from "./RenderMaterial";

/** Flags indicating whether and how the interiors of closed planar regions is displayed within a view.
 * @public
 */
export enum FillFlags {
  /** No fill */
  None = 0,
  /** Use the element's fill color when fill is enabled in the view's [[ViewFlags]]. */
  ByView = 1 << 0,
  /** Use the element's fill color even when fill is disabled in the view's [[ViewFlags]]. */
  Always = 1 << 1,
  /** Render the fill behind other geometry belonging to the same element.
   * For example if an element's geometry contains text with background fill, the text always renders in front of the fill.
   */
  Behind = 1 << 2,
  /** Combines Behind and Always flags. */
  Blanking = Behind | Always,
  /** Use the view's background color instead of the element's fill color. */
  Background = 1 << 3,
}

/** The "cooked" material and symbology for a [[RenderGraphic]]. This determines the appearance
 * (e.g. texture, color, width, linestyle, etc.) used to draw Geometry.
 * @beta
 */
export class GraphicParams {
  public fillFlags = FillFlags.None;
  public linePixels = LinePixels.Solid;
  public rasterWidth = 1;
  public lineColor = ColorDef.black;
  public fillColor = ColorDef.black;
  public trueWidthStart = 0;
  public trueWidthEnd = 0;
  public material?: RenderMaterial;
  public gradient?: Gradient.Symb;

  public setLineTransparency(transparency: number) { this.lineColor = this.lineColor.withAlpha(transparency); }

  public setFillTransparency(transparency: number) { this.fillColor = this.fillColor.withAlpha(transparency); }

  public static fromSymbology(lineColor: ColorDef, fillColor: ColorDef, lineWidth: number, linePixels = LinePixels.Solid): GraphicParams {
    const graphicParams = new GraphicParams();
    graphicParams.lineColor = lineColor;
    graphicParams.fillColor = fillColor;
    graphicParams.rasterWidth = lineWidth;
    graphicParams.linePixels = linePixels;
    return graphicParams;
  }

  public static fromBlankingFill(fillColor: ColorDef): GraphicParams {
    const graphicParams = new GraphicParams();
    graphicParams.fillColor = fillColor;
    graphicParams.fillFlags = FillFlags.Blanking;
    return graphicParams;
  }
}
