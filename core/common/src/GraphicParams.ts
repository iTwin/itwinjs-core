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
import { RenderTexture } from "./RenderTexture";

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
  public readonly lineColor = new ColorDef();
  public readonly fillColor = new ColorDef();
  public trueWidthStart = 0;
  public trueWidthEnd = 0;
  public lineTexture?: RenderTexture;
  public material?: RenderMaterial;
  public gradient?: Gradient.Symb;

  /** set the line color
   *  @param lineColor the new line color for this GraphicParams.
   */
  public setLineColor(lineColor: ColorDef) { this.lineColor.setFrom(lineColor); }
  public setLineTransparency(transparency: number) { this.lineColor.setAlpha(transparency); }

  /**
   * Set the current fill color for this GraphicParams.
   * @param fillColor the new fill color for this GraphicParams.
   */
  public setFillColor(fillColor: ColorDef) { this.fillColor.setFrom(fillColor); }
  public setFillTransparency(transparency: number) { this.fillColor.setAlpha(transparency); }

  /** Set the linear pixel pattern for this GraphicParams. This is only valid for overlay decorators in pixel mode. */
  public setLinePixels(code: LinePixels) { this.linePixels = code; this.lineTexture = undefined; }

  public static fromSymbology(lineColor: ColorDef, fillColor: ColorDef, lineWidth: number, linePixels = LinePixels.Solid): GraphicParams {
    const graphicParams = new GraphicParams();
    graphicParams.setLineColor(lineColor);
    graphicParams.setFillColor(fillColor);
    graphicParams.rasterWidth = lineWidth;
    graphicParams.setLinePixels(linePixels);
    return graphicParams;
  }

  public static fromBlankingFill(fillColor: ColorDef): GraphicParams {
    const graphicParams = new GraphicParams();
    graphicParams.setFillColor(fillColor);
    graphicParams.fillFlags = FillFlags.Blanking;
    return graphicParams;
  }
}
