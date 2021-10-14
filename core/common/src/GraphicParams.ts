/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Symbology
 */

import { ColorDef } from "./ColorDef";
import { Gradient } from "./Gradient";
import { LinePixels } from "./LinePixels";
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
 * @public
 */
export class GraphicParams {
  /** Describes how fill is applied to planar regions in wireframe mode. */
  public fillFlags = FillFlags.None;
  /** The line pattern applied to curves and edges. */
  public linePixels = LinePixels.Solid;
  /** The width, in pixels, of curves and edges. Values are clamped to [1..31] at display time. */
  public rasterWidth = 1;
  /** The color of curves and edges. */
  public lineColor = ColorDef.black;
  /** The color of surfaces. */
  public fillColor = ColorDef.black;
  /** Material applied to surfaces. */
  public material?: RenderMaterial;
  /** Gradient fill applied to surfaces. */
  public gradient?: Gradient.Symb;

  /** Set the transparency of the line color, where 0=fully opaque and 255=full transparent. */
  public setLineTransparency(transparency: number) { this.lineColor = this.lineColor.withTransparency(transparency); }

  /** Set the transparency of the fill color, where 0=fully opaque and 255=full transparent. */
  public setFillTransparency(transparency: number) { this.fillColor = this.fillColor.withTransparency(transparency); }

  public clone(out?: GraphicParams): GraphicParams {
    out = out ?? new GraphicParams();

    out.fillFlags = this.fillFlags;
    out.linePixels = this.linePixels;
    out.rasterWidth = this.rasterWidth;
    out.lineColor = this.lineColor;
    out.fillColor = this.fillColor;
    out.material = this.material;
    out.gradient = this.gradient;

    return out;
  }

  /** Conveniently create a GraphicParams the most commonly-used properties. */
  public static fromSymbology(lineColor: ColorDef, fillColor: ColorDef, lineWidth: number, linePixels = LinePixels.Solid): GraphicParams {
    const graphicParams = new GraphicParams();
    graphicParams.lineColor = lineColor;
    graphicParams.fillColor = fillColor;
    graphicParams.rasterWidth = lineWidth;
    graphicParams.linePixels = linePixels;
    return graphicParams;
  }

  /** Create a GraphicParams with blanking fill of the specified color.
   * @see [[FillFlags.Blanking]].
   */
  public static fromBlankingFill(fillColor: ColorDef): GraphicParams {
    const graphicParams = new GraphicParams();
    graphicParams.fillColor = fillColor;
    graphicParams.fillFlags = FillFlags.Blanking;
    return graphicParams;
  }
}
